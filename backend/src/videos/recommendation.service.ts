import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface VideoRecommendationOverrideDelegate {
  findMany(args: {
    where: {
      isActive: boolean;
      OR: Array<{ hskLevel: null } | { hskLevel: number }>;
    };
    orderBy: Array<{ priority: 'desc' } | { createdAt: 'desc' }>;
    include: { video: true };
  }): Promise<any[]>;
}

export type RecommendationContext = 'learn' | 'dashboard';
export type RecommendationLane = 'nextUp' | 'suited' | 'review';

export interface RecommendationItem {
  video: any;
  lane: RecommendationLane;
  score: number;
  reasons: string[];
  estimatedComprehension: number;
  estimatedNewWords: number;
}

export interface RecommendationsResponse {
  generatedAt: string;
  context: RecommendationContext;
  nextUp: RecommendationItem | null;
  suited: RecommendationItem[];
  review: RecommendationItem[];
}

type VideoFeatures = {
  video: any;
  userLevel: number;
  totalVocab: number;
  knownVocab: number;
  knownRatio: number | null;
  levelDelta: number;
  progressPercent: number;
  hasProgress: boolean;
  isCompleted: boolean;
  lastWatchedAt?: Date | null;
};

const estimateNewWords = (
  totalVocab: number,
  knownVocab: number,
  videoLevel: number,
  userLevel: number,
): number => {
  if (totalVocab > 0) return Math.max(0, totalVocab - knownVocab);
  return Math.max(3, Math.round((videoLevel - userLevel + 1) * 4));
};

export const levelFitScore = (delta: number): number => {
  if (delta <= 0) return 100;
  if (delta === 1) return 75;
  if (delta === 2) return 45;
  return 20;
};

export const knownWordFitScore = (knownRatio: number | null): number => {
  if (knownRatio === null) return 60;
  const target = 0.85;
  const distance = Math.abs(knownRatio - target);
  return Math.max(0, Math.round(100 - distance * 400));
};

export const freshnessScore = (lastWatchedAt?: Date | null): number => {
  if (!lastWatchedAt) return 90;
  const elapsedMs = Date.now() - new Date(lastWatchedAt).getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  if (elapsedHours < 12) return 20;
  if (elapsedHours < 24) return 35;
  if (elapsedHours < 72) return 55;
  return 80;
};

export const reviewNeedScore = (
  progressPercent: number,
  lastWatchedAt?: Date | null,
): number => {
  if (progressPercent >= 20 && progressPercent < 95) return 100;
  if (progressPercent > 0 && progressPercent < 20) return 65;
  if (!lastWatchedAt) return 20;

  const elapsedMs = Date.now() - new Date(lastWatchedAt).getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  if (elapsedDays >= 1 && elapsedDays <= 7) return 55;
  return 25;
};

@Injectable()
export class RecommendationService {
  private readonly cacheTtlMs = 15 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  private async getOverridesSafe(userHskLevel: number): Promise<any[]> {
    const overrideDelegate = (
      this.prisma as PrismaService & {
        videoRecommendationOverride?: VideoRecommendationOverrideDelegate;
      }
    ).videoRecommendationOverride;
    if (!overrideDelegate || typeof overrideDelegate.findMany !== 'function') {
      // Prisma client not regenerated/migrated yet -> fallback without overrides
      return [];
    }

    return overrideDelegate.findMany({
      where: {
        isActive: true,
        OR: [{ hskLevel: null }, { hskLevel: userHskLevel }],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: { video: true },
    });
  }

  async getRecommendations(
    userId: string,
    context: RecommendationContext,
    limit = 4,
    forceRefresh = false,
  ): Promise<RecommendationsResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, hskLevel: true },
    });

    if (!user) {
      return {
        generatedAt: new Date().toISOString(),
        context,
        nextUp: null,
        suited: [],
        review: [],
      };
    }

    const cacheKey = `video_reco_v1_${context}`;
    const maxNormalLevel = Math.min(6, user.hskLevel + 1);
    if (!forceRefresh) {
      const cached = await this.prisma.aiRecommendation.findFirst({
        where: {
          userId,
          recommendationType: cacheKey,
          isDismissed: false,
          createdAt: { gte: new Date(Date.now() - this.cacheTtlMs) },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (cached?.content) {
        const payload = cached.content as unknown as RecommendationsResponse;
        const hasTooHardVideo =
          (payload.nextUp?.video?.hskLevel ?? 0) > maxNormalLevel ||
          (payload.suited || []).some(
            (x) => (x.video?.hskLevel ?? 0) > maxNormalLevel,
          );
        const hasNoRecommendations =
          !payload.nextUp && (payload.suited?.length || 0) === 0;
        if (!hasTooHardVideo && !hasNoRecommendations) return payload;
      }
    }

    const candidateVideos = await this.loadCandidateVideos(
      user.hskLevel,
      limit,
    );
    const videoIds = candidateVideos.map((v) => v.id);

    const [
      progressRows,
      knownWords,
      videoVocabRows,
      subtitleTokenRows,
      overrides,
    ] = await Promise.all([
      this.prisma.videoProgress.findMany({
        where: { userId, videoId: { in: videoIds } },
        select: {
          videoId: true,
          progressPercent: true,
          lastWatchedAt: true,
        },
      }),
      this.prisma.userVocabulary.findMany({
        where: {
          userId,
          proficiency: { in: ['learning', 'review', 'mastered'] },
        },
        select: { vocabularyId: true },
      }),
      this.prisma.videoVocabulary.findMany({
        where: { videoId: { in: videoIds } },
        select: { videoId: true, vocabularyId: true },
      }),
      this.prisma.subtitleToken.findMany({
        where: {
          vocabularyId: { not: null },
          subtitle: { videoId: { in: videoIds } },
        },
        select: {
          vocabularyId: true,
          subtitle: { select: { videoId: true } },
        },
      }),
      this.getOverridesSafe(user.hskLevel),
    ]);

    const progressByVideoId = new Map(progressRows.map((p) => [p.videoId, p]));
    const knownWordSet = new Set(knownWords.map((x) => x.vocabularyId));
    const vocabMap = new Map<string, Set<string>>();

    for (const row of videoVocabRows) {
      const set = vocabMap.get(row.videoId) ?? new Set<string>();
      set.add(row.vocabularyId);
      vocabMap.set(row.videoId, set);
    }

    for (const row of subtitleTokenRows) {
      if (!row.vocabularyId) continue;
      const videoId = row.subtitle.videoId;
      if (vocabMap.has(videoId)) continue;
      const set = vocabMap.get(videoId) ?? new Set<string>();
      set.add(row.vocabularyId);
      vocabMap.set(videoId, set);
    }

    const featureRows: Array<
      VideoFeatures & { rawScore: number; reasons: string[] }
    > = candidateVideos.map((video) => {
      const progress = progressByVideoId.get(video.id);
      const progressPercent = progress?.progressPercent ?? 0;
      const isCompleted = progressPercent >= 95;
      const levelDelta = Math.abs((video.hskLevel ?? 1) - user.hskLevel);
      const vocabSet = vocabMap.get(video.id);
      const totalVocab = vocabSet?.size ?? 0;
      let knownVocab = 0;
      if (vocabSet) {
        for (const id of vocabSet) {
          if (knownWordSet.has(id)) knownVocab += 1;
        }
      }
      const knownRatio = totalVocab > 0 ? knownVocab / totalVocab : null;

      const lvScore = levelFitScore(levelDelta);
      const kwScore = knownWordFitScore(knownRatio);
      const frScore = freshnessScore(progress?.lastWatchedAt);
      const rvScore = reviewNeedScore(progressPercent, progress?.lastWatchedAt);
      const momentumScore = this.completionMomentumScore(
        progressPercent,
        levelDelta,
      );

      const hasVocabCoverage = knownRatio !== null;
      const w = hasVocabCoverage
        ? { level: 0.4, known: 0.25, momentum: 0.15, fresh: 0.1, review: 0.1 }
        : { level: 0.5, known: 0.05, momentum: 0.15, fresh: 0.2, review: 0.1 };

      const rawScore = Math.round(
        lvScore * w.level +
          kwScore * w.known +
          momentumScore * w.momentum +
          frScore * w.fresh +
          rvScore * w.review,
      );

      const estimatedComprehension = this.estimateComprehension(
        knownRatio,
        levelDelta,
      );
      const estimatedNewWords = estimateNewWords(
        totalVocab,
        knownVocab,
        video.hskLevel ?? 1,
        user.hskLevel,
      );

      return {
        video,
        userLevel: user.hskLevel,
        totalVocab,
        knownVocab,
        knownRatio,
        levelDelta,
        progressPercent,
        hasProgress: Boolean(progress),
        isCompleted,
        lastWatchedAt: progress?.lastWatchedAt,
        rawScore,
        reasons: this.buildReasons({
          userLevel: user.hskLevel,
          videoLevel: video.hskLevel,
          estimatedComprehension,
          estimatedNewWords,
          isReview: progressPercent > 0 && progressPercent < 95,
        }),
      };
    });

    const hideIds = new Set(
      overrides.filter((o) => o.action === 'hide').map((o) => o.videoId),
    );

    let scored = featureRows
      .filter((row) => !hideIds.has(row.video.id))
      .sort((a, b) => b.rawScore - a.rawScore);

    const normalLevelRows = scored.filter(
      (row) => (row.video.hskLevel ?? 1) <= maxNormalLevel,
    );

    const reviewCandidates = scored
      .filter((row) => row.progressPercent > 0 && row.progressPercent < 95)
      .sort(
        (a, b) =>
          reviewNeedScore(b.progressPercent, b.lastWatchedAt) -
          reviewNeedScore(a.progressPercent, a.lastWatchedAt),
      )
      .slice(0, 3);

    let nextUpRow =
      normalLevelRows.find(
        (row) => !row.isCompleted && row.progressPercent < 95,
      ) ?? null;

    // Guarantee fallback for cold-start/new users: always provide one suggestion
    // when published videos exist (pick easiest available if level-bounded set is empty).
    if (!nextUpRow) {
      const unfinishedInAnyLevel = scored.find(
        (row) => !row.isCompleted && row.progressPercent < 95,
      );
      if (unfinishedInAnyLevel) {
        nextUpRow = unfinishedInAnyLevel;
      }
    }

    const pinNextUp = overrides.find(
      (o) =>
        o.action === 'pin' && o.lane === 'nextUp' && !hideIds.has(o.videoId),
    );
    if (pinNextUp) {
      const pinnedFeature = featureRows.find(
        (row) =>
          row.video.id === pinNextUp.videoId &&
          row.progressPercent < 95 &&
          !row.isCompleted,
      );
      if (pinnedFeature) nextUpRow = pinnedFeature;
    }

    const baseForSuited = normalLevelRows.length > 0 ? normalLevelRows : scored;
    const suitedBase = baseForSuited.filter(
      (row) =>
        row.video.id !== nextUpRow?.video.id &&
        !reviewCandidates.some((r) => r.video.id === row.video.id),
    );

    const pinSuited = overrides
      .filter(
        (o) =>
          o.action === 'pin' && o.lane === 'suited' && !hideIds.has(o.videoId),
      )
      .map((o) => featureRows.find((row) => row.video.id === o.videoId))
      .filter(
        (x): x is VideoFeatures & { rawScore: number; reasons: string[] } =>
          Boolean(x),
      );

    const suitedRows = [
      ...pinSuited.filter((row) => row.video.id !== nextUpRow?.video.id),
      ...suitedBase,
    ]
      .filter(
        (row, index, arr) =>
          arr.findIndex((x) => x.video.id === row.video.id) === index,
      )
      .slice(0, Math.min(Math.max(limit, 3), 6));

    // Final safety net for cold-start/new users:
    // if scoring produced no actionable lanes but there are published candidates,
    // force-fill from easiest scored videos.
    const safeNextUp = nextUpRow ?? scored[0] ?? null;
    const safeSuitedRows =
      suitedRows.length > 0
        ? suitedRows
        : scored
            .filter((row) => row.video.id !== safeNextUp?.video.id)
            .slice(0, Math.min(Math.max(limit, 3), 6));

    const payload: RecommendationsResponse = {
      generatedAt: new Date().toISOString(),
      context,
      nextUp: safeNextUp ? this.toItem(safeNextUp, 'nextUp') : null,
      suited: safeSuitedRows.map((row) => this.toItem(row, 'suited')),
      review: reviewCandidates
        .filter((row) => row.video.id !== safeNextUp?.video.id)
        .slice(0, 4)
        .map((row) => this.toItem(row, 'review')),
    };

    await this.prisma.aiRecommendation.create({
      data: {
        userId,
        recommendationType: cacheKey,
        content: payload as unknown as object,
        score: nextUpRow ? nextUpRow.rawScore / 100 : null,
      },
    });

    return payload;
  }

  private async loadCandidateVideos(userLevel: number, limit: number) {
    const narrow = await this.prisma.video.findMany({
      where: {
        isPublished: true,
        hskLevel: {
          gte: Math.max(1, userLevel - 1),
          lte: Math.min(6, userLevel + 1),
        },
      },
      orderBy: [
        { hskLevel: 'asc' },
        { viewCount: 'desc' },
        { durationSeconds: 'asc' },
      ],
      take: 120,
    });

    if (narrow.length >= Math.max(limit * 3, 12)) return narrow;

    const slightlyBroader = await this.prisma.video.findMany({
      where: {
        isPublished: true,
        hskLevel: {
          gte: Math.max(1, userLevel - 1),
          lte: Math.min(6, userLevel + 2),
        },
      },
      orderBy: [
        { hskLevel: 'asc' },
        { viewCount: 'desc' },
        { durationSeconds: 'asc' },
      ],
      take: 150,
    });

    if (slightlyBroader.length > 0) return slightlyBroader;

    return this.prisma.video.findMany({
      where: { isPublished: true },
      orderBy: [{ viewCount: 'desc' }, { durationSeconds: 'asc' }],
      take: 180,
    });
  }

  private completionMomentumScore(progressPercent: number, levelDelta: number) {
    if (progressPercent >= 95) return 20;
    if (progressPercent >= 40) return 85;
    if (progressPercent > 0) return 72;
    return Math.max(45, 78 - levelDelta * 8);
  }

  private estimateComprehension(knownRatio: number | null, levelDelta: number) {
    if (knownRatio !== null)
      return Math.max(35, Math.min(99, Math.round(knownRatio * 100)));
    if (levelDelta <= 0) return 88;
    if (levelDelta === 1) return 78;
    if (levelDelta === 2) return 65;
    return 55;
  }

  private buildReasons(input: {
    userLevel: number;
    videoLevel: number;
    estimatedComprehension: number;
    estimatedNewWords: number;
    isReview: boolean;
  }): string[] {
    const reasons: string[] = [];
    const delta = input.videoLevel - input.userLevel;
    if (delta === 0) reasons.push(`Phù hợp HSK ${input.userLevel}`);
    else if (delta === 1) reasons.push('Nâng nhẹ độ khó');
    else if (delta < 0) reasons.push('Ôn nền tảng chắc hơn');
    else reasons.push(`HSK ${input.videoLevel} thử thách hơn`);

    reasons.push(`~${input.estimatedNewWords} từ mới`);
    if (input.isReview) reasons.push('Đang cần ôn lại');
    else reasons.push(`Ước tính hiểu ${input.estimatedComprehension}%`);
    return reasons.slice(0, 2);
  }

  private toItem(
    row: VideoFeatures & { rawScore: number; reasons: string[] },
    lane: RecommendationLane,
  ): RecommendationItem {
    const estimatedComprehension = this.estimateComprehension(
      row.knownRatio,
      row.levelDelta,
    );
    const estimatedNewWords = estimateNewWords(
      row.totalVocab,
      row.knownVocab,
      row.video.hskLevel ?? 1,
      row.userLevel,
    );
    return {
      video: row.video,
      lane,
      score: row.rawScore,
      reasons: row.reasons,
      estimatedComprehension,
      estimatedNewWords,
    };
  }
}
