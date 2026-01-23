import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserVocabularyService {
    constructor(private prisma: PrismaService) { }

    async findAll(userId: string, query: {
        page?: number;
        limit?: number;
        proficiency?: string;
        search?: string;
        sourceVideoId?: string;
    }) {
        const { page = 1, limit = 20, proficiency, search, sourceVideoId } = query;
        const skip = (page - 1) * limit;

        const where: any = { userId };

        if (proficiency) {
            where.proficiency = proficiency;
        }

        if (sourceVideoId) {
            where.sourceVideoId = sourceVideoId;
        }

        if (search) {
            where.vocabulary = {
                OR: [
                    { hanzi: { contains: search } },
                    { pinyin: { contains: search, mode: 'insensitive' } },
                    { meaningVi: { contains: search, mode: 'insensitive' } },
                ],
            };
        }

        const [userVocab, total] = await Promise.all([
            this.prisma.userVocabulary.findMany({
                where,
                skip,
                take: limit,
                orderBy: { savedAt: 'desc' },
                include: {
                    vocabulary: true,
                    sourceVideo: {
                        select: { id: true, title: true, thumbnailUrl: true },
                    },
                },
            }),
            this.prisma.userVocabulary.count({ where }),
        ]);

        return {
            data: userVocab,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async saveVocabulary(userId: string, data: {
        vocabularyId: string;
        sourceVideoId?: string;
    }) {
        // Check if already saved
        const existing = await this.prisma.userVocabulary.findUnique({
            where: {
                userId_vocabularyId: {
                    userId,
                    vocabularyId: data.vocabularyId,
                },
            },
        });

        if (existing) {
            throw new ConflictException('Vocabulary already saved');
        }

        // Verify vocabulary exists
        const vocab = await this.prisma.vocabulary.findUnique({
            where: { id: data.vocabularyId },
        });

        if (!vocab) {
            throw new NotFoundException('Vocabulary not found');
        }

        const userVocab = await this.prisma.userVocabulary.create({
            data: {
                userId,
                vocabularyId: data.vocabularyId,
                sourceVideoId: data.sourceVideoId,
            },
            include: {
                vocabulary: true,
            },
        });

        // Also create a flashcard review entry
        await this.prisma.flashcardReview.upsert({
            where: {
                userId_vocabularyId: {
                    userId,
                    vocabularyId: data.vocabularyId,
                },
            },
            create: {
                userId,
                vocabularyId: data.vocabularyId,
                nextReviewAt: new Date(),
                status: 'new',
            },
            update: {},
        });

        return userVocab;
    }

    /**
     * Save a word from dictionary lookup
     * IMPORTANT: Only allows saving words that exist in system vocabulary (Admin-managed)
     * Users cannot create new vocabulary entries
     */
    async saveWord(userId: string, data: {
        hanzi: string;
        pinyin?: string;
        meaningVi?: string;
        sourceVideoId?: string;
        folderId?: string;
        // Context fields for SRS enhancement
        sourceTimestamp?: number;
        sourceSentence?: string;
        sourcePinyin?: string;
        // Media URLs from Cloudinary
        sourceImageUrl?: string;
        sourceAudioUrl?: string;
    }) {
        // Find vocabulary in system library (Admin-managed)
        const vocab = await this.prisma.vocabulary.findUnique({
            where: { hanzi: data.hanzi },
        });

        // BLOCK: Users cannot save words that don't exist in system
        if (!vocab) {
            throw new BadRequestException(
                'Từ này chưa có trong thư viện hệ thống. Chỉ Admin mới có thể thêm từ mới.'
            );
        }

        // Check if already saved
        const existing = await this.prisma.userVocabulary.findUnique({
            where: {
                userId_vocabularyId: {
                    userId,
                    vocabularyId: vocab.id,
                },
            },
        });

        if (existing) {
            throw new ConflictException('Vocabulary already saved');
        }

        const userVocab = await this.prisma.userVocabulary.create({
            data: {
                userId,
                vocabularyId: vocab.id,
                sourceVideoId: data.sourceVideoId,
                folderId: data.folderId,
                // Store context from video
                sourceTimestamp: data.sourceTimestamp,
                sourceSentence: data.sourceSentence,
                sourcePinyin: data.sourcePinyin,
                // Store media URLs
                sourceImageUrl: data.sourceImageUrl,
                sourceAudioUrl: data.sourceAudioUrl,
            },
            include: {
                vocabulary: true,
            },
        });

        // Also create a flashcard review entry
        await this.prisma.flashcardReview.upsert({
            where: {
                userId_vocabularyId: {
                    userId,
                    vocabularyId: vocab.id,
                },
            },
            create: {
                userId,
                vocabularyId: vocab.id,
                nextReviewAt: new Date(),
                status: 'new',
            },
            update: {},
        });

        return userVocab;
    }

    async updateProficiency(userId: string, id: string, data: {
        proficiency: string;
        proficiencyPercent: number;
    }) {
        const userVocab = await this.prisma.userVocabulary.findFirst({
            where: { id, userId },
        });

        if (!userVocab) {
            throw new NotFoundException('User vocabulary not found');
        }

        return this.prisma.userVocabulary.update({
            where: { id },
            data: {
                proficiency: data.proficiency,
                proficiencyPercent: data.proficiencyPercent,
                lastReviewedAt: new Date(),
            },
            include: { vocabulary: true },
        });
    }

    async remove(userId: string, id: string) {
        const userVocab = await this.prisma.userVocabulary.findFirst({
            where: { id, userId },
        });

        if (!userVocab) {
            throw new NotFoundException('User vocabulary not found');
        }

        await this.prisma.userVocabulary.delete({ where: { id } });

        // Also remove associated flashcard review
        await this.prisma.flashcardReview.deleteMany({
            where: {
                userId,
                vocabularyId: userVocab.vocabularyId,
            },
        });

        return { message: 'Vocabulary removed from collection' };
    }

    async getStats(userId: string) {
        const [total, byProficiency, recentlySaved] = await Promise.all([
            this.prisma.userVocabulary.count({ where: { userId } }),
            this.prisma.userVocabulary.groupBy({
                by: ['proficiency'],
                where: { userId },
                _count: { id: true },
            }),
            this.prisma.userVocabulary.count({
                where: {
                    userId,
                    savedAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    },
                },
            }),
        ]);

        const proficiencyStats = byProficiency.reduce((acc, curr) => {
            acc[curr.proficiency] = curr._count.id;
            return acc;
        }, {} as Record<string, number>);

        return {
            total,
            new: proficiencyStats.new || 0,
            learning: proficiencyStats.learning || 0,
            review: proficiencyStats.review || 0,
            mastered: proficiencyStats.mastered || 0,
            savedThisWeek: recentlySaved,
        };
    }
}
