import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XpStreakService } from '../xp-streak/xp-streak.service';
import { CreateVideoDto, UpdateVideoDto, VideoQueryDto } from './dto';
import { parseSubtitleFile, tokenizeChinese } from './subtitle-parser.js';

@Injectable()
export class VideosService {
    constructor(
        private prisma: PrismaService,
        private xpStreak: XpStreakService,
    ) { }

    async findAll(query: VideoQueryDto, includeUnpublished = false) {
        const { page = 1, limit = 10, hskLevel, category, search } = query;
        const skip = (page - 1) * limit;

        const where: any = {};

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
        const video = await this.prisma.video.findUnique({ where: { id: videoId } });

        if (!video) {
            throw new NotFoundException('Video not found');
        }

        // Check if user has viewed this video in the last 6 hours
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const recentView = await this.prisma.videoView.findFirst({
            where: {
                userId,
                videoId,
                viewedAt: { gte: sixHoursAgo },
            },
        });

        if (recentView) {
            return { counted: false, message: 'View already counted within 6 hours' };
        }

        // Create view record and increment count in transaction
        await this.prisma.$transaction([
            this.prisma.videoView.create({
                data: { userId, videoId },
            }),
            this.prisma.video.update({
                where: { id: videoId },
                data: { viewCount: { increment: 1 } },
            }),
        ]);

        // Award XP for watching video (use video.xpReward)
        await this.xpStreak.recordActivity(userId, video.xpReward || 10, 'video_view');

        return { counted: true, message: 'View recorded', xpAwarded: video.xpReward || 10 };
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
            where: { isPublished: true },
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
            console.log('uploadSubtitles called for video:', videoId);
            console.log('Content length:', content.length);
            console.log('Filename:', filename);

            const video = await this.prisma.video.findUnique({ where: { id: videoId } });
            if (!video) {
                throw new NotFoundException('Video not found');
            }
            console.log('Video found:', video.id);

            // Parse subtitles using imported functions
            const parsedSubtitles = parseSubtitleFile(content, filename);
            console.log('Parsed subtitles count:', parsedSubtitles.length);

            if (parsedSubtitles.length === 0) {
                throw new Error('No subtitles found in file');
            }

            // Delete existing subtitles for this video
            await this.prisma.subtitle.deleteMany({ where: { videoId } });
            console.log('Deleted existing subtitles');

            // Prepare subtitle data for batch insert
            const subtitleData = parsedSubtitles.map(sub => ({
                videoId,
                startTime: sub.startTime,
                endTime: sub.endTime,
                hanzi: sub.hanzi,
                pinyin: sub.pinyin || '',
                meaningVi: sub.meaningVi,
                sequenceOrder: sub.sequenceOrder,
            }));

            // Batch create all subtitles at once
            await this.prisma.subtitle.createMany({
                data: subtitleData,
            });
            console.log('Created subtitles count:', subtitleData.length);

            // Skip token creation for now to avoid timeout
            // Tokens can be created on-demand when viewing subtitles

            // Update video subtitle count and languages
            await this.prisma.video.update({
                where: { id: videoId },
                data: {
                    subtitleLanguages: ['zh', 'vi'],
                },
            });

            return {
                message: 'Subtitles uploaded successfully',
                count: subtitleData.length,
            };
        } catch (error) {
            console.error('uploadSubtitles error:', error);
            console.error('Error stack:', error.stack);
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
                `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoId}&key=${apiKey}`
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
            const duration = this.parseISO8601Duration(videoInfo.contentDetails.duration);

            return {
                success: true,
                configured: true,
                data: {
                    videoId,
                    title: videoInfo.snippet.title,
                    description: videoInfo.snippet.description,
                    thumbnailUrl: videoInfo.snippet.thumbnails?.maxres?.url
                        || videoInfo.snippet.thumbnails?.high?.url
                        || videoInfo.snippet.thumbnails?.medium?.url,
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
