import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VocabularyService {
    constructor(private prisma: PrismaService) { }

    async findAll(query: {
        page?: number;
        limit?: number;
        hskLevel?: number;
        search?: string;
        partOfSpeech?: string;
    }) {
        const { page = 1, limit = 20, hskLevel, search, partOfSpeech } = query;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (hskLevel) {
            where.hskLevel = hskLevel;
        }

        if (partOfSpeech) {
            where.partOfSpeech = partOfSpeech;
        }

        if (search) {
            where.OR = [
                { hanzi: { contains: search } },
                { pinyin: { contains: search, mode: 'insensitive' } },
                { meaningEn: { contains: search, mode: 'insensitive' } },
                { meaningVi: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [vocabulary, total] = await Promise.all([
            this.prisma.vocabulary.findMany({
                where,
                skip,
                take: limit,
                orderBy: { hskLevel: 'asc' },
            }),
            this.prisma.vocabulary.count({ where }),
        ]);

        return {
            data: vocabulary,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findOne(id: string) {
        const vocab = await this.prisma.vocabulary.findUnique({
            where: { id },
        });

        if (!vocab) {
            throw new NotFoundException('Vocabulary not found');
        }

        return vocab;
    }

    async findByHanzi(hanzi: string) {
        const vocab = await this.prisma.vocabulary.findUnique({
            where: { hanzi },
        });

        if (!vocab) {
            throw new NotFoundException('Vocabulary not found');
        }

        return vocab;
    }

    // Admin methods
    async create(data: {
        hanzi: string;
        pinyin: string;
        meaningEn: string;
        meaningVi?: string;
        partOfSpeech?: string;
        hskLevel: number;
        tags?: string[];
        audioUrl?: string;
        examples?: any;
    }) {
        const existing = await this.prisma.vocabulary.findUnique({
            where: { hanzi: data.hanzi },
        });

        if (existing) {
            throw new ConflictException('Vocabulary with this hanzi already exists');
        }

        return this.prisma.vocabulary.create({
            data: {
                hanzi: data.hanzi,
                pinyin: data.pinyin,
                meaningEn: data.meaningEn,
                meaningVi: data.meaningVi,
                partOfSpeech: data.partOfSpeech,
                hskLevel: data.hskLevel,
                tags: data.tags || [],
                audioUrl: data.audioUrl,
                examples: data.examples || [],
            },
        });
    }

    async update(id: string, data: Partial<{
        hanzi: string;
        pinyin: string;
        meaningEn: string;
        meaningVi: string;
        partOfSpeech: string;
        hskLevel: number;
        tags: string[];
        audioUrl: string;
        examples: any;
    }>) {
        const vocab = await this.prisma.vocabulary.findUnique({ where: { id } });

        if (!vocab) {
            throw new NotFoundException('Vocabulary not found');
        }

        return this.prisma.vocabulary.update({
            where: { id },
            data,
        });
    }

    async remove(id: string) {
        const vocab = await this.prisma.vocabulary.findUnique({ where: { id } });

        if (!vocab) {
            throw new NotFoundException('Vocabulary not found');
        }

        await this.prisma.vocabulary.delete({ where: { id } });

        return { message: 'Vocabulary deleted successfully' };
    }

    async getHskLevelStats() {
        const result = await this.prisma.vocabulary.groupBy({
            by: ['hskLevel'],
            _count: { id: true },
        });

        return result.map((r) => ({
            hskLevel: r.hskLevel,
            count: r._count.id,
        }));
    }
}
