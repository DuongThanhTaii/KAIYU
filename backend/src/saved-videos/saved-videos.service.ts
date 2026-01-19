import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SavedVideosService {
    constructor(private prisma: PrismaService) { }

    async getSavedVideos(userId: string) {
        return this.prisma.savedVideo.findMany({
            where: { userId },
            orderBy: { savedAt: 'desc' },
            include: {
                video: {
                    select: {
                        id: true,
                        title: true,
                        thumbnailUrl: true,
                        durationSeconds: true,
                        hskLevel: true,
                        category: true,
                        viewCount: true,
                    },
                },
            },
        });
    }

    async getSavedVideoIds(userId: string): Promise<string[]> {
        const saved = await this.prisma.savedVideo.findMany({
            where: { userId },
            select: { videoId: true },
        });
        return saved.map(s => s.videoId);
    }

    async saveVideo(userId: string, videoId: string) {
        return this.prisma.savedVideo.upsert({
            where: {
                userId_videoId: { userId, videoId },
            },
            create: { userId, videoId },
            update: {},
        });
    }

    async unsaveVideo(userId: string, videoId: string) {
        try {
            await this.prisma.savedVideo.delete({
                where: {
                    userId_videoId: { userId, videoId },
                },
            });
            return { success: true };
        } catch {
            return { success: false };
        }
    }

    async isVideoSaved(userId: string, videoId: string): Promise<boolean> {
        const saved = await this.prisma.savedVideo.findUnique({
            where: {
                userId_videoId: { userId, videoId },
            },
        });
        return !!saved;
    }
}
