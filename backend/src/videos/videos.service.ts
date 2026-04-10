import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { XpStreakService } from '../xp-streak/xp-streak.service';
import { CreateVideoDto, UpdateVideoDto, VideoQueryDto } from './dto';
import {
  parseSubtitleFile,
  tokenizeChinese,
  segmentHanziWithPinyin,
  ParsedToken,
} from './subtitle-parser.js';

interface SubtitleCreateManyAndReturnDelegate {
  createManyAndReturn(args: {
    data: Array<{
      videoId: string;
      startTime: number;
      endTime: number;
      hanzi: string;
      pinyin: string;
      meaningVi?: string;
      sequenceOrder: number;
    }>;
  }): Promise<Array<{ id: string }>>;
}

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    private prisma: PrismaService,
    private xpStreak: XpStreakService,
  ) {}

  async findAll(query: VideoQueryDto, includeUnpublished = false) {
    const { page = 1, limit = 10, hskLevel, category, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.VideoWhereInput = {};

    if (!includeUnpublished) {
      where.isPublished = true;
    }

    if (hskLevel) {
      where.hskLevel = hskLevel;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [videos, total] = await Promise.all([
      this.prisma.video.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.video.count({ where }),
    ]);

    return {
      data: videos,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      include: {
        _count: {
          select: { subtitles: true },
        },
      },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    return video;
  }

  async getSubtitles(videoId: string) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const subtitles = await this.prisma.subtitle.findMany({
      where: { videoId },
      orderBy: { sequenceOrder: 'asc' },
      include: {
        tokens: {
          orderBy: { position: 'asc' },
        },
      },
    });

    return subtitles;
  }

  async getVocabulary(videoId: string) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const vocabulary = await this.prisma.videoVocabulary.findMany({
      where: { videoId },
      include: {
        vocabulary: true,
      },
    });

    return vocabulary.map((v) => v.vocabulary);
  }

  /**
   * Record a video view with anti-spam protection
   * - 6 hour cooldown between views from same user
   * - Saves view history for analytics
   */
  async incrementViewCount(videoId: string, userId: string) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const wasCounted = await this.prisma.$transaction(async (tx) => {
      const lockKey = `${userId}:${videoId}`;
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
      `;

      // Check cooldown while holding transaction lock to avoid double count races.
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const recentView = await tx.videoView.findFirst({
        where: {
          userId,
          videoId,
          viewedAt: { gte: sixHoursAgo },
        },
        select: { id: true },
      });

      if (recentView) {
        return false;
      }

      await tx.videoView.create({ data: { userId, videoId } });
      await tx.video.update({
        where: { id: videoId },
        data: { viewCount: { increment: 1 } },
      });

      return true;
    });

    if (!wasCounted) {
      return { counted: false, message: 'View already counted within 6 hours' };
    }

    // Award XP for watching video (use video.xpReward)
    await this.xpStreak.recordActivity(
      userId,
      video.xpReward || 10,
      'video_view',
    );

    return {
      counted: true,
      message: 'View recorded',
      xpAwarded: video.xpReward || 10,
    };
  }

  // Admin methods
  async create(dto: CreateVideoDto) {
    return this.prisma.video.create({
      data: {
        title: dto.title,
        description: dto.description,
        videoUrl: dto.videoUrl,
        thumbnailUrl: dto.thumbnailUrl,
        durationSeconds: dto.durationSeconds || 0,
        hskLevel: dto.hskLevel,
        category: dto.category,
        accent: dto.accent,
        subtitleLanguages: dto.subtitleLanguages || [],
        xpReward: dto.xpReward || 0,
      },
    });
  }

  async update(id: string, dto: UpdateVideoDto) {
    const video = await this.prisma.video.findUnique({ where: { id } });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    return this.prisma.video.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const video = await this.prisma.video.findUnique({ where: { id } });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    await this.prisma.video.delete({ where: { id } });

    return { message: 'Video deleted successfully' };
  }

  async publish(id: string) {
    const video = await this.prisma.video.findUnique({ where: { id } });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    return this.prisma.video.update({
      where: { id },
      data: { isPublished: true },
    });
  }

  async getCategories() {
    const result = await this.prisma.video.groupBy({
      by: ['category'],
      where: {
        isPublished: true,
        category: { not: null, notIn: [''] },
      },
      _count: { id: true },
    });

    return result.map((r) => ({
      category: r.category,
      count: r._count.id,
    }));
  }

  /**
   * Upload and parse subtitles for a video
   * Supports SRT and VTT formats
   */
  async uploadSubtitles(videoId: string, content: string, filename: string) {
    try {
      this.logger.debug(`uploadSubtitles called for video: ${videoId}`);
      this.logger.debug(`Content length: ${content.length}`);
      this.logger.debug(`Filename: ${filename}`);

      const video = await this.prisma.video.findUnique({
        where: { id: videoId },
      });
      if (!video) {
        throw new NotFoundException('Video not found');
      }
      this.logger.debug(`Video found: ${video.id}`);

      // Parse subtitles using imported functions
      const parsedSubtitles = parseSubtitleFile(content, filename);
      this.logger.debug(`Parsed subtitles count: ${parsedSubtitles.length}`);

      if (parsedSubtitles.length === 0) {
        throw new Error('No subtitles found in file');
      }

      // Delete existing subtitles for this video
      await this.prisma.subtitle.deleteMany({ where: { videoId } });
      this.logger.debug('Deleted existing subtitles');

      // Prepare subtitle data for batch insert
      const subtitleData = parsedSubtitles.map((sub) => ({
        videoId,
        startTime: sub.startTime,
        endTime: sub.endTime,
        hanzi: sub.hanzi,
        pinyin: sub.pinyin || '',
        meaningVi: sub.meaningVi,
        sequenceOrder: sub.sequenceOrder,
      }));

      // 1. Create all subtitles and get their IDs
      // Use createManyAndReturn which is available in Prisma 5.14.0+
      const subtitleDelegate = this.prisma
        .subtitle as unknown as SubtitleCreateManyAndReturnDelegate;
      const createdSubtitles = await subtitleDelegate.createManyAndReturn({
        data: subtitleData,
      });
      this.logger.debug(`Created subtitles count: ${createdSubtitles.length}`);

      // 2. Generate tokens for each subtitle
      const allTokens: {
        subtitleId: string;
        hanzi: string;
        pinyin: string;
        position: number;
      }[] = [];

      for (let i = 0; i < parsedSubtitles.length; i++) {
        const sub = parsedSubtitles[i];
        const dbSub = createdSubtitles[i];

        if (!dbSub) continue;

        let tokens: ParsedToken[] = [];

        if (sub.hanzi && sub.pinyin) {
          // Use pinyin-based segmentation
          tokens = segmentHanziWithPinyin(sub.hanzi, sub.pinyin);
        } else if (sub.hanzi) {
          // Fallback to character-level if pinyin is missing
          tokens = tokenizeChinese(sub.hanzi);
        }

        // Map to DB structure
        const tokenData = tokens.map((t) => ({
          subtitleId: dbSub.id,
          hanzi: t.hanzi,
          pinyin: t.pinyin || '',
          position: t.position,
        }));

        allTokens.push(...tokenData);
      }

      // 3. Batch create all tokens
      if (allTokens.length > 0) {
        // Split into chunks of 1000 to avoid database parameter limits
        const chunkSize = 1000;
        for (let i = 0; i < allTokens.length; i += chunkSize) {
          const chunk = allTokens.slice(i, i + chunkSize);
          await this.prisma.subtitleToken.createMany({
            data: chunk,
          });
        }
        this.logger.debug(`Created tokens count: ${allTokens.length}`);
      }

      // Update video subtitle count and languages
      await this.prisma.video.update({
        where: { id: videoId },
        data: {
          subtitleLanguages: ['zh', 'vi'],
          vocabCount: allTokens.length, // Update vocab count with token count
        },
      });

      return {
        message: 'Subtitles uploaded successfully',
        count: subtitleData.length,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`uploadSubtitles error: ${message}`, stack);
      throw error;
    }
  }

  /**
   * Get YouTube video information using YouTube Data API v3
   * Requires YOUTUBE_API_KEY environment variable
   */
  async getYouTubeVideoInfo(youtubeUrl: string) {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        error: 'YouTube API key not configured',
        configured: false,
      };
    }

    // Extract video ID from various YouTube URL formats
    const videoId = this.extractYouTubeVideoId(youtubeUrl);

    if (!videoId) {
      return {
        success: false,
        error: 'Invalid YouTube URL',
        configured: true,
      };
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoId}&key=${apiKey}`,
      );

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error?.message || 'Failed to fetch video info',
          configured: true,
        };
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        return {
          success: false,
          error: 'Video not found',
          configured: true,
        };
      }

      const videoInfo = data.items[0];
      const duration = this.parseISO8601Duration(
        videoInfo.contentDetails.duration,
      );

      return {
        success: true,
        configured: true,
        data: {
          videoId,
          title: videoInfo.snippet.title,
          description: videoInfo.snippet.description,
          thumbnailUrl:
            videoInfo.snippet.thumbnails?.maxres?.url ||
            videoInfo.snippet.thumbnails?.high?.url ||
            videoInfo.snippet.thumbnails?.medium?.url,
          durationSeconds: duration,
          channelTitle: videoInfo.snippet.channelTitle,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to connect to YouTube API',
        configured: true,
      };
    }
  }

  /**
   * Extract YouTube video ID from various URL formats
   */
  private extractYouTubeVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Parse ISO 8601 duration (PT1H2M3S) to seconds
   */
  private parseISO8601Duration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
  }
}
