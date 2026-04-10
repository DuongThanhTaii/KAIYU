import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  parseSubtitleFile,
  tokenizeChinese,
  segmentHanziWithPinyin,
  ParsedToken,
} from '../videos/subtitle-parser.js';

export interface RecommendationOverrideRow {
  action: 'pin' | 'hide';
  lane: 'nextUp' | 'suited' | null;
  hskLevel: number | null;
  priority: number;
  isActive: boolean;
}

interface RecommendationOverrideDelegate {
  findMany: (...args: unknown[]) => Promise<RecommendationOverrideRow[]>;
  create: (...args: unknown[]) => Promise<RecommendationOverrideRow>;
  findUnique: (...args: unknown[]) => Promise<RecommendationOverrideRow | null>;
  update: (...args: unknown[]) => Promise<RecommendationOverrideRow>;
  delete: (...args: unknown[]) => Promise<RecommendationOverrideRow>;
}

interface SubtitleCreateManyAndReturnDelegate {
  createManyAndReturn(args: {
    data: Array<{
      videoId: string;
      startTime: number;
      endTime: number;
      hanzi: string;
      pinyin: string;
      meaningEn: string;
      meaningVi: string;
      sequenceOrder: number;
    }>;
  }): Promise<Array<{ id: string }>>;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  private getRecommendationOverrideDelegate() {
    const delegate = (
      this.prisma as PrismaService & {
        videoRecommendationOverride?: RecommendationOverrideDelegate;
      }
    ).videoRecommendationOverride;
    if (!delegate) {
      throw new NotFoundException(
        'Recommendation override model is not available. Please run prisma migrate + prisma generate.',
      );
    }
    return delegate;
  }

  private normalizeSearchInput(input: string): string {
    return String(input || '')
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private stripEdgePunctuation(input: string): string {
    if (!input) return '';
    const edgePunctuation =
      /^[\s\u3000.,!?;:'"`~@#$%^&*()_+\-=\[\]{}<>/\\|，。！？；：、（）【】《》〈〉「」『』“”‘’·…—]+|[\s\u3000.,!?;:'"`~@#$%^&*()_+\-=\[\]{}<>/\\|，。！？；：、（）【】《》〈〉「」『』“”‘’·…—]+$/g;
    return input.replace(edgePunctuation, '').trim();
  }

  private foldSearchText(input: string): string {
    return String(input || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private buildSearchCandidates(rawSearch: string): string[] {
    const normalized = this.normalizeSearchInput(rawSearch);
    if (!normalized) return [];

    const stripped = this.stripEdgePunctuation(normalized);
    const candidates = new Set<string>([normalized]);
    if (stripped) candidates.add(stripped);

    return Array.from(candidates).filter(Boolean);
  }

  // ============ Dashboard Stats ============
  async getOverviewStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [
      userCount,
      videoCount,
      vocabCount,
      recentUsers,
      todayLearningCount,
      publishedVideos,
      userCount30DaysAgo,
      vocabCount30DaysAgo,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.video.count(),
      this.prisma.vocabulary.count(),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, email: true, createdAt: true },
      }),
      // Count of flashcard reviews today
      this.prisma.flashcardReview.count({
        where: {
          lastReviewAt: { gte: today },
        },
      }),
      this.prisma.video.count({
        where: { isPublished: true },
      }),
      // Trends: compare with 30 days ago
      this.prisma.user.count({
        where: { createdAt: { lt: thirtyDaysAgo } },
      }),
      this.prisma.vocabulary.count({
        where: { createdAt: { lt: thirtyDaysAgo } },
      }),
    ]);

    // Helper to calculate trend percentage
    const calculateTrend = (current: number, previous: number) => {
      if (previous === 0)
        return { value: current > 0 ? 100 : 0, isPositive: true };
      const diff = current - previous;
      const percent = Math.round((diff / previous) * 100);
      return {
        value: Math.abs(percent),
        isPositive: percent >= 0,
      };
    };

    // Get daily activity for last 7 days
    const dailyActivity = await this.getDailyActivityStats(7);

    return {
      users: userCount,
      userTrend: calculateTrend(userCount, userCount30DaysAgo),
      videos: videoCount,
      publishedVideos,
      vocabulary: vocabCount,
      vocabTrend: calculateTrend(vocabCount, vocabCount30DaysAgo),
      recentUsers,
      todayLearningCount,
      dailyActivity,
    };
  }

  // Method to get daily stats for the activity chart (public for direct API access)
  async getDailyActivityStats(days: number) {
    const safeDays = Math.max(1, Math.min(90, Number(days) || 7));
    const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - (safeDays - 1));
    startDate.setHours(0, 0, 0, 0);

    const [userRows, viewRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>(
        Prisma.sql`
          SELECT date_trunc('day', created_at) AS day, COUNT(*)::bigint AS count
          FROM users
          WHERE created_at >= ${startDate} AND created_at <= ${now}
          GROUP BY 1
        `,
      ),
      this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>(
        Prisma.sql`
          SELECT date_trunc('day', last_watched_at) AS day, COUNT(*)::bigint AS count
          FROM video_progress
          WHERE last_watched_at >= ${startDate} AND last_watched_at <= ${now}
          GROUP BY 1
        `,
      ),
    ]);

    const toDayKey = (value: Date) => {
      const d = new Date(value);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().split('T')[0];
    };

    const userCountByDay = new Map<string, number>(
      userRows.map((row) => [toDayKey(row.day), Number(row.count || 0)]),
    );
    const viewCountByDay = new Map<string, number>(
      viewRows.map((row) => [toDayKey(row.day), Number(row.count || 0)]),
    );

    const result: {
      date: string;
      label: string;
      newUsers: number;
      videoViews: number;
    }[] = [];

    for (let i = safeDays - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dayKey = date.toISOString().split('T')[0];

      result.push({
        date: dayKey,
        label: dayLabels[date.getDay()],
        newUsers: userCountByDay.get(dayKey) || 0,
        videoViews: viewCountByDay.get(dayKey) || 0,
      });
    }

    return result;
  }

  // ============ Notifications ============
  async getNotifications(limit: number = 10) {
    const notifications: {
      id: string;
      type: 'user' | 'video' | 'achievement' | 'vocabulary';
      message: string;
      time: string;
      createdAt: Date;
    }[] = [];

    // Get recent user registrations
    const recentUsers = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, email: true, createdAt: true },
    });

    for (const user of recentUsers) {
      notifications.push({
        id: `user-${user.id}`,
        type: 'user',
        message: `Người dùng mới đăng ký: ${user.name}`,
        time: this.formatTimeAgo(user.createdAt),
        createdAt: user.createdAt,
      });
    }

    // Get recent videos created
    const recentVideos = await this.prisma.video.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, createdAt: true },
    });

    for (const video of recentVideos) {
      notifications.push({
        id: `video-${video.id}`,
        type: 'video',
        message: `Video mới: ${video.title}`,
        time: this.formatTimeAgo(video.createdAt),
        createdAt: video.createdAt,
      });
    }

    // Get recent achievements earned
    const recentAchievements = await this.prisma.achievementEarned.findMany({
      orderBy: { earnedAt: 'desc' },
      take: 5,
      include: {
        user: { select: { name: true } },
        achievement: { select: { title: true } },
      },
    });

    for (const earned of recentAchievements) {
      notifications.push({
        id: `achievement-${earned.id}`,
        type: 'achievement',
        message: `${earned.user.name} đạt thành tựu: ${earned.achievement.title}`,
        time: this.formatTimeAgo(earned.earnedAt),
        createdAt: earned.earnedAt,
      });
    }

    // Sort all notifications by createdAt and take top N
    notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return notifications.slice(0, limit).map(({ createdAt, ...rest }) => rest);
  }

  // Helper to format relative time
  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  }

  // ============ Video Management ============
  async getAllVideos(query: {
    page?: number;
    limit?: number;
    isPublished?: boolean;
  }) {
    const { page = 1, limit = 20, isPublished } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (isPublished !== undefined) {
      where.isPublished = isPublished;
    }

    const [videos, total] = await Promise.all([
      this.prisma.video.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { subtitles: true } },
        },
      }),
      this.prisma.video.count({ where }),
    ]);

    return {
      data: videos,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async createVideo(data: any) {
    return this.prisma.video.create({ data });
  }

  async updateVideo(id: string, data: any) {
    const video = await this.prisma.video.findUnique({ where: { id } });
    if (!video) throw new NotFoundException('Video not found');
    return this.prisma.video.update({ where: { id }, data });
  }

  async deleteVideo(id: string) {
    const video = await this.prisma.video.findUnique({ where: { id } });
    if (!video) throw new NotFoundException('Video not found');

    try {
      await this.prisma.$transaction(async (tx) => {
        // Keep user vocabulary history while removing broken source references.
        await tx.userVocabulary.updateMany({
          where: { sourceVideoId: id },
          data: { sourceVideoId: null },
        });

        // Progress rows use a non-cascade relation in schema, so clear them explicitly.
        await tx.videoProgress.deleteMany({ where: { videoId: id } });

        await tx.video.delete({ where: { id } });
      });
    } catch (error: any) {
      if (error?.code === 'P2003') {
        throw new ConflictException(
          'Không thể xóa video vì còn dữ liệu liên quan',
        );
      }
      throw error;
    }

    return { message: 'Video deleted' };
  }

  async publishVideo(id: string) {
    const video = await this.prisma.video.findUnique({ where: { id } });
    if (!video) throw new NotFoundException('Video not found');
    return this.prisma.video.update({
      where: { id },
      data: { isPublished: true },
    });
  }

  // ============ Subtitle Management ============
  async addSubtitles(videoId: string, subtitlesData: any[]) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
    });
    if (!video) throw new NotFoundException('Video not found');

    // Delete existing subtitles
    await this.prisma.subtitle.deleteMany({ where: { videoId } });

    // Create new subtitles
    // Use createManyAndReturn if possible, or sequential creates
    const subtitleDelegate = this.prisma
      .subtitle as unknown as SubtitleCreateManyAndReturnDelegate;
    const createdSubtitles = await subtitleDelegate.createManyAndReturn({
      data: subtitlesData.map((sub, index) => ({
        videoId,
        startTime: sub.startTime,
        endTime: sub.endTime,
        hanzi: sub.hanzi,
        pinyin: sub.pinyin || '',
        meaningEn: sub.meaningEn || '',
        meaningVi: sub.meaningVi,
        sequenceOrder: index,
      })),
    });

    // Generate tokens for each subtitle
    const allTokens: any[] = [];
    for (let i = 0; i < subtitlesData.length; i++) {
      const sub = subtitlesData[i];
      const dbSub = createdSubtitles[i];
      if (!dbSub) continue;

      let tokens: ParsedToken[] = [];
      if (sub.hanzi && sub.pinyin) {
        tokens = segmentHanziWithPinyin(sub.hanzi, sub.pinyin);
      } else if (sub.hanzi) {
        tokens = tokenizeChinese(sub.hanzi);
      }

      allTokens.push(
        ...tokens.map((t) => ({
          subtitleId: dbSub.id,
          hanzi: t.hanzi,
          pinyin: t.pinyin || '',
          position: t.position,
        })),
      );
    }

    // Batch create tokens
    if (allTokens.length > 0) {
      const chunkSize = 1000;
      for (let i = 0; i < allTokens.length; i += chunkSize) {
        const chunk = allTokens.slice(i, i + chunkSize);
        await this.prisma.subtitleToken.createMany({ data: chunk });
      }
    }

    // Update video vocab count and languages
    await this.prisma.video.update({
      where: { id: videoId },
      data: {
        vocabCount: allTokens.length,
        subtitleLanguages: ['zh', 'vi'],
      },
    });

    return {
      message: `Created ${createdSubtitles.length} subtitles and ${allTokens.length} tokens`,
    };
  }

  async updateSubtitle(id: string, data: any) {
    const { tokens, updateGlobal, ...subtitleData } = data;

    // Update subtitle metadata
    const updatedSubtitle = await this.prisma.subtitle.update({
      where: { id },
      data: subtitleData,
    });

    // If tokens are provided, replace them
    if (tokens && Array.isArray(tokens)) {
      const existingTokens = await this.prisma.subtitleToken.findMany({
        where: { subtitleId: id },
        orderBy: { position: 'asc' },
      });

      const incomingVocabularyIds = Array.from(
        new Set(
          tokens
            .map((t: any) =>
              typeof t?.vocabularyId === 'string' ? t.vocabularyId.trim() : '',
            )
            .filter((v: string) => v.length > 0),
        ),
      );

      const vocabularyPinyinMap = new Map<string, string>();
      if (incomingVocabularyIds.length > 0) {
        const vocabRows = await this.prisma.vocabulary.findMany({
          where: { id: { in: incomingVocabularyIds } },
          select: { id: true, pinyin: true },
        });
        for (const row of vocabRows) {
          const py = typeof row.pinyin === 'string' ? row.pinyin.trim() : '';
          if (py) vocabularyPinyinMap.set(row.id, py);
        }
      }

      // Delete old tokens
      await this.prisma.subtitleToken.deleteMany({
        where: { subtitleId: id },
      });

      // Process tokens
      const finalTokens: any[] = [];
      for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index];
        const normalizedHanzi =
          typeof token?.hanzi === 'string' ? token.hanzi.trim() : '';
        if (!normalizedHanzi) continue;

        let normalizedPinyin =
          typeof token?.pinyin === 'string' ? token.pinyin.trim() : '';
        const normalizedMeaning =
          typeof token?.meaning === 'string' ? token.meaning.trim() : '';
        const normalizedPartOfSpeech =
          typeof token?.partOfSpeech === 'string'
            ? token.partOfSpeech.trim()
            : '';
        const normalizedPosition = Number.isInteger(token?.position)
          ? token.position
          : index;

        let vocabularyId = token?.vocabularyId;

        // Preserve pinyin when re-segmentation sends empty pinyin values.
        if (!normalizedPinyin) {
          const normalizedVocabularyId =
            typeof vocabularyId === 'string' ? vocabularyId.trim() : '';
          if (normalizedVocabularyId) {
            normalizedPinyin =
              vocabularyPinyinMap.get(normalizedVocabularyId) || '';
          }

          if (!normalizedPinyin) {
            const samePositionAndHanzi = existingTokens.find(
              (t) =>
                t.position === normalizedPosition &&
                t.hanzi === normalizedHanzi &&
                typeof t.pinyin === 'string' &&
                t.pinyin.trim().length > 0,
            );
            if (samePositionAndHanzi?.pinyin) {
              normalizedPinyin = samePositionAndHanzi.pinyin.trim();
            }
          }

          if (!normalizedPinyin) {
            const sameHanzi = existingTokens.find(
              (t) =>
                t.hanzi === normalizedHanzi &&
                typeof t.pinyin === 'string' &&
                t.pinyin.trim().length > 0,
            );
            if (sameHanzi?.pinyin) {
              normalizedPinyin = sameHanzi.pinyin.trim();
            }
          }
        }

        // If global update is requested, update or create vocabulary entry
        if (updateGlobal) {
          if (vocabularyId) {
            try {
              await this.prisma.vocabulary.update({
                where: { id: vocabularyId },
                data: {
                  pinyin: normalizedPinyin || undefined,
                  meaningVi: normalizedMeaning || undefined,
                  hskLevel: token.hskLevel,
                  partOfSpeech: normalizedPartOfSpeech || undefined,
                },
              });
            } catch (error) {
              this.logger.warn(
                `Skip stale vocabularyId=${vocabularyId} while updating subtitle=${id}: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
              // Stale or invalid vocabularyId, continue with hanzi-based fallback.
              vocabularyId = undefined;
            }
          }

          if (!vocabularyId) {
            // Try to find by hanzi first to avoid duplicates
            const existingVocab = await this.prisma.vocabulary.findUnique({
              where: { hanzi: normalizedHanzi },
            });

            if (existingVocab) {
              vocabularyId = existingVocab.id;
              await this.prisma.vocabulary.update({
                where: { id: vocabularyId },
                data: {
                  pinyin: normalizedPinyin || undefined,
                  meaningVi: normalizedMeaning || undefined,
                  hskLevel: token.hskLevel,
                  partOfSpeech: normalizedPartOfSpeech || undefined,
                },
              });
            } else {
              // Create new
              const newVocab = await this.prisma.vocabulary.create({
                data: {
                  hanzi: normalizedHanzi,
                  pinyin: normalizedPinyin,
                  meaningVi: normalizedMeaning,
                  hskLevel: token.hskLevel || 1,
                  partOfSpeech: normalizedPartOfSpeech,
                },
              });
              vocabularyId = newVocab.id;
            }
          }
        }

        finalTokens.push({
          subtitleId: id,
          hanzi: normalizedHanzi,
          pinyin: normalizedPinyin,
          meaning: normalizedMeaning,
          position: normalizedPosition,
          hskLevel: token.hskLevel,
          partOfSpeech: normalizedPartOfSpeech,
          vocabularyId,
        });
      }

      // Create new ones
      if (finalTokens.length > 0) {
        await this.prisma.subtitleToken.createMany({
          data: finalTokens,
        });
      }
    }

    // Return fresh subtitle with newly created tokens so all clients get verified data
    return this.prisma.subtitle.findUnique({
      where: { id },
      include: { tokens: { orderBy: { position: 'asc' } } },
    });
  }

  // ============ Vocabulary Management ============
  async getAllVocabulary(query: {
    page?: number;
    limit?: number;
    hskLevel?: number;
    search?: string;
  }) {
    const { page = 1, limit = 50, hskLevel, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (hskLevel) where.hskLevel = hskLevel;

    const candidates = this.buildSearchCandidates(search || '');
    if (candidates.length > 0) {
      const allRows = await this.prisma.vocabulary.findMany({
        where,
        orderBy: [{ hskLevel: 'asc' }, { hanzi: 'asc' }],
      });

      const foldedCandidates = candidates.map((c) => this.foldSearchText(c));

      const scoreRow = (row: any): number => {
        const hanzi = this.normalizeSearchInput(row.hanzi || '');
        const pinyin = this.normalizeSearchInput(row.pinyin || '');
        const meaningVi = this.normalizeSearchInput(row.meaningVi || '');
        const meaningEn = this.normalizeSearchInput(row.meaningEn || '');

        const foldedPinyin = this.foldSearchText(pinyin);
        const foldedMeaningVi = this.foldSearchText(meaningVi);
        const foldedMeaningEn = this.foldSearchText(meaningEn);

        let best = -1;
        for (let i = 0; i < candidates.length; i++) {
          const candidate = candidates[i];
          const folded = foldedCandidates[i];

          if (hanzi === candidate) best = Math.max(best, 1000);
          else if (hanzi.includes(candidate)) best = Math.max(best, 800);

          if (pinyin.toLowerCase().includes(candidate.toLowerCase())) {
            best = Math.max(best, 700);
          }

          if (folded && foldedPinyin.includes(folded))
            best = Math.max(best, 650);
          if (folded && foldedMeaningVi.includes(folded))
            best = Math.max(best, 500);
          if (folded && foldedMeaningEn.includes(folded))
            best = Math.max(best, 450);
        }

        return best;
      };

      const matched = allRows
        .map((row) => ({ row, score: scoreRow(row) }))
        .filter((item) => item.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.row);

      const paged = matched.slice(skip, skip + limit);
      const total = matched.length;

      return {
        data: paged,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    const [vocab, total] = await Promise.all([
      this.prisma.vocabulary.findMany({
        where,
        skip,
        take: limit,
        orderBy: { hskLevel: 'asc' },
      }),
      this.prisma.vocabulary.count({ where }),
    ]);

    return {
      data: vocab,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async createVocabulary(data: any) {
    const normalizedHanzi = String(data?.hanzi || '').trim();
    if (!normalizedHanzi) {
      throw new Error('Hanzi is required');
    }

    const existing = await this.prisma.vocabulary.findUnique({
      where: { hanzi: normalizedHanzi },
    });

    if (existing) {
      return this.prisma.vocabulary.update({
        where: { id: existing.id },
        data: {
          pinyin: data?.pinyin,
          meaningVi: data?.meaningVi,
          meaningEn: data?.meaningEn,
          radical: data?.radical,
          radicalMeaning: data?.radicalMeaning,
          strokeCount: data?.strokeCount,
          partOfSpeech: data?.partOfSpeech,
          hskLevel: data?.hskLevel,
          tags: data?.tags,
          audioUrl: data?.audioUrl,
          examples: data?.examples,
          synonyms: data?.synonyms,
          antonyms: data?.antonyms,
          mnemonic: data?.mnemonic,
          meanings: data?.meanings,
        },
      });
    }

    return this.prisma.vocabulary.create({
      data: {
        ...data,
        hanzi: normalizedHanzi,
      },
    });
  }

  async updateVocabulary(id: string, data: any) {
    const vocab = await this.prisma.vocabulary.findUnique({ where: { id } });
    if (!vocab) throw new NotFoundException('Vocabulary not found');
    return this.prisma.vocabulary.update({ where: { id }, data });
  }

  async deleteVocabulary(id: string) {
    const vocab = await this.prisma.vocabulary.findUnique({ where: { id } });
    if (!vocab) throw new NotFoundException('Vocabulary not found');
    await this.prisma.vocabulary.delete({ where: { id } });
    return { message: 'Vocabulary deleted' };
  }

  async importVocabulary(vocabList: any[]) {
    const results = {
      created: 0,
      skipped: 0,
      errors: 0,
      errorItems: [] as Array<{ hanzi: string; reason: string }>,
    };

    const validItems = vocabList.filter((item) => {
      const hanzi = String(item?.hanzi || '').trim();
      if (!hanzi) {
        results.skipped += 1;
        return false;
      }
      return true;
    });

    const chunkSize = 200;
    for (let i = 0; i < validItems.length; i += chunkSize) {
      const chunk = validItems.slice(i, i + chunkSize);
      const settled = await Promise.allSettled(
        chunk.map((item) =>
          this.prisma.vocabulary.upsert({
            where: { hanzi: item.hanzi },
            create: {
              hanzi: item.hanzi,
              pinyin: item.pinyin,
              meaningEn: item.meaningEn,
              meaningVi: item.meaningVi,
              partOfSpeech: item.partOfSpeech,
              hskLevel: item.hskLevel || 1,
              tags: item.tags || [],
            },
            update: {
              pinyin: item.pinyin,
              meaningEn: item.meaningEn,
              meaningVi: item.meaningVi,
              partOfSpeech: item.partOfSpeech,
              hskLevel: item.hskLevel,
            },
          }),
        ),
      );

      settled.forEach((entry, index) => {
        if (entry.status === 'fulfilled') {
          results.created += 1;
          return;
        }

        results.errors += 1;
        const failedItem = chunk[index];
        if (results.errorItems.length < 50) {
          results.errorItems.push({
            hanzi: String(failedItem?.hanzi || ''),
            reason:
              entry.reason instanceof Error
                ? entry.reason.message
                : String(entry.reason),
          });
        }
      });
    }

    return results;
  }

  // ============ User Management ============
  async getAllUsers(query: {
    page?: number;
    limit?: number;
    role?: string;
    search?: string;
  }) {
    const { page = 1, limit = 20, role, search } = query;
    const skip = (page - 1) * limit;

    const baseWhere: any = {};
    if (role) baseWhere.role = role;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If search provided, perform a global search across name/email and then paginate the matched set
    const candidates = this.buildSearchCandidates(search || '');
    if (candidates.length > 0) {
      const orClauses: Prisma.UserWhereInput[] = [];
      for (const c of candidates) {
        orClauses.push({ name: { contains: c, mode: 'insensitive' } });
        orClauses.push({ email: { contains: c, mode: 'insensitive' } });
      }

      const matched = await this.prisma.user.findMany({
        where: { AND: [baseWhere, { OR: orClauses }] },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          hskLevel: true,
          streak: true,
          isPremium: true,
          role: true,
          createdAt: true,
          lastActiveDate: true,
          _count: { select: { userVocabulary: true } },
        },
      });

      const total = matched.length;
      const paged = matched.slice(skip, skip + limit);

      const premiumCount = matched.filter((u) => u.isPremium).length;
      const adminCount = matched.filter((u) => u.role === 'admin').length;
      const activeTodayCount = matched.filter(
        (u) =>
          new Date(u.createdAt) >= today ||
          (u.lastActiveDate ? new Date(u.lastActiveDate) >= today : false),
      ).length;

      return {
        data: paged,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        stats: {
          total,
          premium: premiumCount,
          admins: adminCount,
          activeToday: activeTodayCount,
        },
      };
    }

    const where = baseWhere;

    const [users, total, premiumCount, adminCount, activeTodayCount] =
      await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            hskLevel: true,
            streak: true,
            isPremium: true,
            role: true,
            createdAt: true,
            lastActiveDate: true,
            _count: { select: { userVocabulary: true } },
          },
        }),
        this.prisma.user.count({ where }),
        this.prisma.user.count({ where: { isPremium: true } }),
        this.prisma.user.count({ where: { role: 'admin' } }),
        this.prisma.user.count({
          where: {
            lastActiveDate: { gte: today },
          },
        }),
      ]);

    return {
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      stats: {
        total,
        premium: premiumCount,
        admins: adminCount,
        activeToday: activeTodayCount,
      },
    };
  }

  async updateUserRole(id: string, role: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // Prisma cascade sẽ tự động xóa các data liên quan
    // vì đã cấu hình onDelete: Cascade trong schema
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  }

  // ============ Recommendation Overrides ============
  async getRecommendationOverrides(query: {
    hskLevel?: number;
    isActive?: boolean;
  }) {
    const where: any = {};
    if (query.hskLevel !== undefined) where.hskLevel = query.hskLevel;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    return this.getRecommendationOverrideDelegate().findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        video: {
          select: {
            id: true,
            title: true,
            hskLevel: true,
            thumbnailUrl: true,
            isPublished: true,
          },
        },
      },
    });
  }

  async createRecommendationOverride(data: {
    videoId: string;
    hskLevel?: number | null;
    action: 'pin' | 'hide';
    lane?: 'nextUp' | 'suited' | null;
    priority?: number;
    isActive?: boolean;
  }) {
    const video = await this.prisma.video.findUnique({
      where: { id: data.videoId },
    });
    if (!video) throw new NotFoundException('Video not found');

    if (data.action === 'pin' && !data.lane) {
      throw new ConflictException('lane is required when action is pin');
    }

    return this.getRecommendationOverrideDelegate().create({
      data: {
        videoId: data.videoId,
        hskLevel:
          data.hskLevel === null || data.hskLevel === undefined
            ? null
            : Number(data.hskLevel),
        action: data.action,
        lane: data.action === 'hide' ? null : data.lane || 'suited',
        priority: Number(data.priority ?? 0),
        isActive: data.isActive ?? true,
      },
      include: {
        video: {
          select: {
            id: true,
            title: true,
            hskLevel: true,
            thumbnailUrl: true,
            isPublished: true,
          },
        },
      },
    });
  }

  async updateRecommendationOverride(
    id: string,
    data: {
      hskLevel?: number | null;
      action?: 'pin' | 'hide';
      lane?: 'nextUp' | 'suited' | null;
      priority?: number;
      isActive?: boolean;
    },
  ) {
    const existing = await this.getRecommendationOverrideDelegate().findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException('Recommendation override not found');

    const nextAction = data.action || existing.action;
    const nextLane = data.lane !== undefined ? data.lane : existing.lane;

    if (nextAction === 'pin' && !nextLane) {
      throw new ConflictException('lane is required when action is pin');
    }

    return this.getRecommendationOverrideDelegate().update({
      where: { id },
      data: {
        hskLevel:
          data.hskLevel === undefined
            ? existing.hskLevel
            : data.hskLevel === null
              ? null
              : Number(data.hskLevel),
        action: nextAction,
        lane: nextAction === 'hide' ? null : nextLane || 'suited',
        priority:
          data.priority === undefined
            ? existing.priority
            : Number(data.priority),
        isActive: data.isActive ?? existing.isActive,
      },
      include: {
        video: {
          select: {
            id: true,
            title: true,
            hskLevel: true,
            thumbnailUrl: true,
            isPublished: true,
          },
        },
      },
    });
  }

  async deleteRecommendationOverride(id: string) {
    const existing = await this.getRecommendationOverrideDelegate().findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException('Recommendation override not found');

    await this.getRecommendationOverrideDelegate().delete({ where: { id } });
    return { message: 'Recommendation override deleted' };
  }

  // ============ Achievement Management ============
  async getAllAchievements(query: { page?: number; limit?: number }) {
    const { page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const [achievements, total] = await Promise.all([
      this.prisma.achievement.findMany({
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          _count: { select: { earnedBy: true } },
        },
      }),
      this.prisma.achievement.count(),
    ]);

    // Transform data to include earnedCount
    const data = achievements.map((a) => ({
      ...a,
      earnedCount: a._count.earnedBy,
      _count: undefined,
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async createAchievement(data: {
    code: string;
    title: string;
    description?: string;
    icon?: string;
    iconColor?: string;
    xpReward?: number;
  }) {
    return this.prisma.achievement.create({
      data: {
        code: data.code,
        title: data.title,
        description: data.description,
        icon: data.icon,
        iconColor: data.iconColor,
        xpReward: data.xpReward || 0,
      },
    });
  }

  async updateAchievement(
    id: string,
    data: {
      code?: string;
      title?: string;
      description?: string;
      icon?: string;
      iconColor?: string;
      xpReward?: number;
    },
  ) {
    const achievement = await this.prisma.achievement.findUnique({
      where: { id },
    });
    if (!achievement) throw new NotFoundException('Achievement not found');

    return this.prisma.achievement.update({
      where: { id },
      data,
    });
  }

  async deleteAchievement(id: string) {
    const achievement = await this.prisma.achievement.findUnique({
      where: { id },
    });
    if (!achievement) throw new NotFoundException('Achievement not found');

    // Delete related earned achievements first
    await this.prisma.achievementEarned.deleteMany({
      where: { achievementId: id },
    });
    await this.prisma.achievement.delete({ where: { id } });

    return { message: 'Achievement deleted successfully' };
  }
}
