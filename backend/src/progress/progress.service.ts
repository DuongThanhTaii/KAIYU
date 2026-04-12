import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XpStreakService } from '../xp-streak/xp-streak.service';

export interface DailyProgress {
  date: string;
  dayName: string;
  vocabularySaved: number;
  reviewsCompleted: number;
}

@Injectable()
export class ProgressService {
  constructor(
    private prisma: PrismaService,
    private xpStreak: XpStreakService,
  ) {}

  private getVietnamDayRange(baseDate: Date = new Date()) {
    const vietnamOffsetMs = 7 * 60 * 60 * 1000;
    const vietnamNow = new Date(
      baseDate.getTime() +
        baseDate.getTimezoneOffset() * 60 * 1000 +
        vietnamOffsetMs,
    );

    const localMidnight = new Date(vietnamNow);
    localMidnight.setHours(0, 0, 0, 0);

    const nextLocalMidnight = new Date(localMidnight);
    nextLocalMidnight.setDate(nextLocalMidnight.getDate() + 1);

    return {
      startUtc: new Date(localMidnight.getTime() - vietnamOffsetMs),
      endUtc: new Date(nextLocalMidnight.getTime() - vietnamOffsetMs),
      dateKey: `${localMidnight.getFullYear()}-${String(localMidnight.getMonth() + 1).padStart(2, '0')}-${String(localMidnight.getDate()).padStart(2, '0')}`,
    };
  }

  async getVideoProgress(userId: string) {
    const progress = await this.prisma.videoProgress.findMany({
      where: { userId },
      orderBy: { lastWatchedAt: 'desc' },
      include: {
        video: {
          select: {
            id: true,
            title: true,
            thumbnailUrl: true,
            durationSeconds: true,
            hskLevel: true,
            category: true,
          },
        },
      },
    });

    return progress;
  }

  async updateVideoProgress(
    userId: string,
    videoId: string,
    data: { progressPercent: number; lastPositionSeconds: number },
  ) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const progress = await this.prisma.videoProgress.upsert({
      where: {
        userId_videoId: { userId, videoId },
      },
      create: {
        userId,
        videoId,
        progressPercent: data.progressPercent,
        lastPositionSeconds: data.lastPositionSeconds,
        lastWatchedAt: new Date(),
      },
      update: {
        progressPercent: data.progressPercent,
        lastPositionSeconds: data.lastPositionSeconds,
        lastWatchedAt: new Date(),
      },
    });

    // Streak should be driven by actual study activity, not only login.
    if (data.lastPositionSeconds > 0 || data.progressPercent > 0) {
      await this.xpStreak.updateStreak(userId);
    }

    return progress;
  }

  async getDailyProgress(userId: string) {
    const { startUtc, dateKey } = this.getVietnamDayRange();

    const [todayVocab, todayReviews, videoProgress] = await Promise.all([
      // Vocabulary saved today
      this.prisma.userVocabulary.count({
        where: {
          userId,
          savedAt: { gte: startUtc },
        },
      }),
      // Reviews done today
      this.prisma.flashcardReview.count({
        where: {
          userId,
          lastReviewAt: { gte: startUtc },
        },
      }),
      // Videos watched today
      this.prisma.videoProgress.findMany({
        where: {
          userId,
          lastWatchedAt: { gte: startUtc },
        },
        include: { video: true },
      }),
    ]);

    // Calculate total watch time today (approximation based on progress)
    const watchTimeMinutes = videoProgress.reduce((total, vp) => {
      const videoMinutes = vp.video.durationSeconds / 60;
      const watchedMinutes = (vp.progressPercent / 100) * videoMinutes;
      return total + watchedMinutes;
    }, 0);

    return {
      date: dateKey,
      vocabularySaved: todayVocab,
      reviewsCompleted: todayReviews,
      videosWatched: videoProgress.length,
      watchTimeMinutes: Math.round(watchTimeMinutes),
    };
  }

  async getWeeklyProgress(userId: string) {
    const now = new Date();
    const vietnamOffsetMs = 7 * 60 * 60 * 1000;
    const vietnamNow = new Date(
      now.getTime() + now.getTimezoneOffset() * 60 * 1000 + vietnamOffsetMs,
    );
    const today = new Date(vietnamNow);
    today.setHours(0, 0, 0, 0);

    const dailyData: DailyProgress[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      // Convert back to UTC for database queries
      const dateForQuery = new Date(date.getTime() - vietnamOffsetMs);
      const nextDateForQuery = new Date(nextDate.getTime() - vietnamOffsetMs);

      const [vocabCount, reviewCount] = await Promise.all([
        this.prisma.userVocabulary.count({
          where: {
            userId,
            savedAt: { gte: dateForQuery, lt: nextDateForQuery },
          },
        }),
        this.prisma.flashcardReview.count({
          where: {
            userId,
            lastReviewAt: { gte: dateForQuery, lt: nextDateForQuery },
          },
        }),
      ]);

      // Format date in Vietnam timezone (YYYY-MM-DD)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      dailyData.push({
        date: `${year}-${month}-${day}`,
        dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
          date.getDay()
        ],
        vocabularySaved: vocabCount,
        reviewsCompleted: reviewCount,
      });
    }

    // Calculate totals
    const totals = {
      totalVocab: dailyData.reduce((sum, d) => sum + d.vocabularySaved, 0),
      totalReviews: dailyData.reduce((sum, d) => sum + d.reviewsCompleted, 0),
    };

    return {
      days: dailyData,
      totals,
    };
  }

  async getOverallStats(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const [totalVocab, masteredVocab, videoCount, streakDays] =
      await Promise.all([
        this.prisma.userVocabulary.count({ where: { userId } }),
        this.prisma.userVocabulary.count({
          where: { userId, proficiency: 'mastered' },
        }),
        this.prisma.videoProgress.count({
          where: { userId, progressPercent: { gte: 80 } },
        }),
        Promise.resolve(user?.streak || 0),
      ]);

    return {
      totalVocabulary: totalVocab,
      masteredVocabulary: masteredVocab,
      videosCompleted: videoCount,
      currentStreak: streakDays,
      hskLevel: user?.hskLevel || 1,
    };
  }
}
