import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    CreateVocabularyDto,
    UpdateVocabularyDto,
    ImportVocabularyItemDto,
    ImportRequestDto,
    ImportResultDto,
    ExampleSentenceDto,
    RelatedWordDto,
} from './dto';

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
            where.partOfSpeech = { contains: partOfSpeech, mode: 'insensitive' };
        }

        if (search) {
            where.OR = [
                { hanzi: { contains: search } },
                { pinyin: { contains: search, mode: 'insensitive' } },
                { meaningVi: { contains: search, mode: 'insensitive' } },
                { meaningEn: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [vocabulary, total] = await Promise.all([
            this.prisma.vocabulary.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ sequenceOrder: 'asc' }, { hskLevel: 'asc' }, { hanzi: 'asc' }],
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

    /**
     * Smart lookup - find by exact match, or break down into characters
     */
    async smartLookup(input: string): Promise<any[]> {
        // Level 1: Exact match
        const exact = await this.prisma.vocabulary.findUnique({
            where: { hanzi: input },
        });
        if (exact) return [exact];

        // Level 2: Contains match (for compound words)
        const contains = await this.prisma.vocabulary.findMany({
            where: { hanzi: { contains: input } },
            take: 5,
        });
        if (contains.length > 0) return contains;

        // Level 3: Character-by-character breakdown
        if (input.length >= 2) {
            const chars = input.split('');
            const results = await Promise.all(
                chars.map(char =>
                    this.prisma.vocabulary.findUnique({ where: { hanzi: char } })
                )
            );
            const validResults = results.filter(Boolean);
            if (validResults.length > 0) return validResults;
        }

        // Level 4: Pinyin/meaning search
        const fuzzy = await this.prisma.vocabulary.findMany({
            where: {
                OR: [
                    { pinyin: { contains: input, mode: 'insensitive' } },
                    { meaningVi: { contains: input, mode: 'insensitive' } },
                ],
            },
            take: 10,
        });
        return fuzzy;
    }

    // Admin methods
    async create(data: CreateVocabularyDto) {
        const existing = await this.prisma.vocabulary.findUnique({
            where: { hanzi: data.hanzi },
        });

        if (existing) {
            throw new ConflictException(`Từ vựng "${data.hanzi}" đã tồn tại trong hệ thống. Vui lòng sử dụng chức năng Sửa để cập nhật.`);
        }

        // If meanings array is provided, generate primary meaningVi from first entry
        let primaryMeaningVi = data.meaningVi;
        let primaryPartOfSpeech = data.partOfSpeech;
        if (data.meanings && data.meanings.length > 0) {
            const firstMeaning = data.meanings[0];
            primaryPartOfSpeech = data.meanings.map(m => m.partOfSpeech).join(', ');
            // Combine all meanings for quick display
            primaryMeaningVi = data.meanings
                .flatMap(m => m.meanings)
                .join('; ');
        }

        return this.prisma.vocabulary.create({
            data: {
                hanzi: data.hanzi,
                pinyin: data.pinyin,
                meaningVi: primaryMeaningVi,
                meaningEn: data.meaningEn,
                radical: data.radical,
                radicalMeaning: data.radicalMeaning,
                strokeCount: data.strokeCount,
                partOfSpeech: primaryPartOfSpeech,
                hskLevel: data.hskLevel,
                tags: data.tags || [],
                audioUrl: data.audioUrl,
                examples: data.examples || [],
                synonyms: data.synonyms || [],
                antonyms: data.antonyms || [],
                mnemonic: data.mnemonic,
                meanings: data.meanings || [],
            } as any,
        });
    }

    async update(id: string, data: UpdateVocabularyDto) {
        const vocab = await this.prisma.vocabulary.findUnique({ where: { id } });

        if (!vocab) {
            throw new NotFoundException('Vocabulary not found');
        }

        // Build update data, only include defined fields
        const updateData: any = {};
        if (data.hanzi !== undefined) updateData.hanzi = data.hanzi;
        if (data.pinyin !== undefined) updateData.pinyin = data.pinyin;
        if (data.meaningVi !== undefined) updateData.meaningVi = data.meaningVi;
        if (data.meaningEn !== undefined) updateData.meaningEn = data.meaningEn;
        if (data.radical !== undefined) updateData.radical = data.radical;
        if (data.radicalMeaning !== undefined) updateData.radicalMeaning = data.radicalMeaning;
        if (data.strokeCount !== undefined) updateData.strokeCount = data.strokeCount;
        if (data.partOfSpeech !== undefined) updateData.partOfSpeech = data.partOfSpeech;
        if (data.hskLevel !== undefined) updateData.hskLevel = data.hskLevel;
        if (data.tags !== undefined) updateData.tags = data.tags;
        if (data.audioUrl !== undefined) updateData.audioUrl = data.audioUrl;
        if (data.examples !== undefined) updateData.examples = data.examples;
        if (data.synonyms !== undefined) updateData.synonyms = data.synonyms;
        if (data.antonyms !== undefined) updateData.antonyms = data.antonyms;
        if (data.mnemonic !== undefined) updateData.mnemonic = data.mnemonic;
        if (data.meanings !== undefined) updateData.meanings = data.meanings;

        return this.prisma.vocabulary.update({
            where: { id },
            data: updateData,
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

    /**
     * Validate import data before proceeding
     * Returns the list of duplicate hanzi in the system
     */
    async validateImport(items: ImportVocabularyItemDto[]): Promise<{ duplicates: string[], total: number }> {
        const uniqueHanzis = Array.from(new Set(items.map(i => i.hanzi).filter(Boolean)));

        const existing = await this.prisma.vocabulary.findMany({
            where: { hanzi: { in: uniqueHanzis } },
            select: { hanzi: true }
        });

        return {
            duplicates: existing.map(e => e.hanzi),
            total: items.length
        };
    }

    /**
     * Import vocabulary from XLSX/CSV data
     */
    async importVocabulary(request: ImportRequestDto): Promise<ImportResultDto> {
        const { items, duplicateAction = 'skip' } = request;

        const result: ImportResultDto = {
            created: 0,
            skipped: 0,
            merged: 0,
            errors: 0,
            errorDetails: [],
        };

        // Get current max sequenceOrder
        const maxSeqRes = await this.prisma.vocabulary.aggregate({
            _max: { sequenceOrder: true }
        });
        let currentSequence = maxSeqRes._max.sequenceOrder || 0;

        for (const item of items) {
            currentSequence++;
            const itemSequence = currentSequence;

            try {
                // Validate required fields (pinyin is optional - some words missing it)
                if (!item.hanzi || !item.meaningVi) {
                    result.errors++;
                    result.errorDetails?.push({
                        hanzi: item.hanzi || '(trống)',
                        error: 'Thiếu thông tin bắt buộc (hanzi, meaningVi)',
                    });
                    continue;
                }

                // Check for existing
                const existing = await this.prisma.vocabulary.findUnique({
                    where: { hanzi: item.hanzi },
                });

                // Parse examples from flattened format
                const examples: ExampleSentenceDto[] = [];
                if (item.example1_cn && item.example1_vi) {
                    examples.push({
                        chinese: item.example1_cn,
                        pinyin: item.example1_py,
                        vietnamese: item.example1_vi,
                    });
                }
                if (item.example2_cn && item.example2_vi) {
                    examples.push({
                        chinese: item.example2_cn,
                        pinyin: item.example2_py,
                        vietnamese: item.example2_vi,
                    });
                }
                if (item.example3_cn && item.example3_vi) {
                    examples.push({
                        chinese: item.example3_cn,
                        pinyin: item.example3_py,
                        vietnamese: item.example3_vi,
                    });
                }

                // Parse synonyms from flattened format
                const synonyms: RelatedWordDto[] = [];
                if (item.synonym1) {
                    synonyms.push({
                        hanzi: item.synonym1,
                        pinyin: item.synonym1_py || '',
                        meaningVi: item.synonym1_vi || '',
                    });
                }
                if (item.synonym2) {
                    synonyms.push({
                        hanzi: item.synonym2,
                        pinyin: item.synonym2_py || '',
                        meaningVi: item.synonym2_vi || '',
                    });
                }

                // Parse antonyms from flattened format
                const antonyms: RelatedWordDto[] = [];
                if (item.antonym1) {
                    antonyms.push({
                        hanzi: item.antonym1,
                        pinyin: item.antonym1_py || '',
                        meaningVi: item.antonym1_vi || '',
                    });
                }
                if (item.antonym2) {
                    antonyms.push({
                        hanzi: item.antonym2,
                        pinyin: item.antonym2_py || '',
                        meaningVi: item.antonym2_vi || '',
                    });
                }

                const vocabData = {
                    hanzi: item.hanzi,
                    pinyin: item.pinyin || '',
                    meaningVi: item.meaningVi,
                    meaningEn: item.meaningEn,
                    radical: item.radical,
                    radicalMeaning: item.radicalMeaning,
                    strokeCount: item.strokeCount,
                    partOfSpeech: item.partOfSpeech,
                    hskLevel: item.hskLevel ?? 1,
                    tags: item.tags || [],
                    examples: examples.length > 0 ? examples : [],
                    synonyms: synonyms.length > 0 ? synonyms : [],
                    antonyms: antonyms.length > 0 ? antonyms : [],
                    mnemonic: item.mnemonic,
                } as any;

                if (existing) {
                    if (duplicateAction === 'skip') {
                        result.skipped++;
                        continue;
                    }

                    // Update existing: merge richer data, keep lower HSK level
                    const updateData: any = {};
                    if (item.pinyin && !existing.pinyin) updateData.pinyin = item.pinyin;
                    if (item.meaningEn && !existing.meaningEn) updateData.meaningEn = item.meaningEn;
                    if (item.partOfSpeech && !existing.partOfSpeech) updateData.partOfSpeech = item.partOfSpeech;
                    if (item.meaningVi) updateData.meaningVi = item.meaningVi;
                    if (item.hskLevel < existing.hskLevel) updateData.hskLevel = item.hskLevel;

                    if (examples.length > 0) updateData.examples = examples;
                    if (synonyms.length > 0) updateData.synonyms = synonyms;
                    if (antonyms.length > 0) updateData.antonyms = antonyms;

                    // Merge meanings logic for duplicates
                    const existingMeanings = (existing.meanings as any[]) || [];
                    const isAlreadyInMeanings = existingMeanings.some(m =>
                        m.pinyin === (item.pinyin || '') &&
                        m.partOfSpeech === (item.partOfSpeech || '') &&
                        (m.meanings as string[] || []).includes(item.meaningVi)
                    );
                    const isIdenticalToPrimary = (existing.pinyin || '') === (item.pinyin || '') &&
                        existing.meaningVi === item.meaningVi &&
                        (existing.partOfSpeech || '') === (item.partOfSpeech || '');

                    let hasMerged = false;
                    if (!isAlreadyInMeanings && !isIdenticalToPrimary) {
                        existingMeanings.push({
                            partOfSpeech: item.partOfSpeech || '',
                            pinyin: item.pinyin || '',
                            meanings: [item.meaningVi]
                        });
                        updateData.meanings = existingMeanings;
                        hasMerged = true;
                    }

                    if (Object.keys(updateData).length > 0) {
                        await this.prisma.vocabulary.update({
                            where: { hanzi: item.hanzi },
                            data: updateData,
                        });
                    }
                    if (hasMerged) {
                        result.merged = (result.merged || 0) + 1;
                    } else {
                        result.skipped++;
                    }
                } else {
                    // Create new
                    vocabData.sequenceOrder = itemSequence;
                    await this.prisma.vocabulary.create({ data: vocabData });
                    result.created++;
                }
            } catch (error) {
                result.errors++;
                result.errorDetails?.push({
                    hanzi: item.hanzi || '(unknown)',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        return result;
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

    /**
     * Get total vocabulary count
     */
    async getTotalCount(): Promise<number> {
        return this.prisma.vocabulary.count();
    }

    /**
     * Search vocabulary by multiple criteria
     */
    async searchAll(query: string, limit: number = 20) {
        return this.prisma.vocabulary.findMany({
            where: {
                OR: [
                    { hanzi: { contains: query } },
                    { pinyin: { contains: query, mode: 'insensitive' } },
                    { meaningVi: { contains: query, mode: 'insensitive' } },
                    { meaningEn: { contains: query, mode: 'insensitive' } },
                ],
            },
            take: limit,
            orderBy: [{ sequenceOrder: 'asc' }, { hskLevel: 'asc' }, { hanzi: 'asc' }],
        });
    }

    /**
     * Bulk update vocabulary from XLSX/CSV data
     * Only updates existing vocabulary, skips new ones
     */
    async bulkUpdateVocabulary(items: ImportVocabularyItemDto[]): Promise<{
        updated: number;
        skipped: number;
        errors: number;
        errorDetails?: { hanzi: string; error: string }[];
    }> {
        const result = {
            updated: 0,
            skipped: 0,
            errors: 0,
            errorDetails: [] as { hanzi: string; error: string }[],
        };

        for (const item of items) {
            try {
                // Validate required field
                if (!item.hanzi) {
                    result.errors++;
                    result.errorDetails.push({
                        hanzi: '(trống)',
                        error: 'Thiếu hanzi',
                    });
                    continue;
                }

                // Check if vocabulary exists
                const existing = await this.prisma.vocabulary.findUnique({
                    where: { hanzi: item.hanzi },
                });

                if (!existing) {
                    // Skip if not exists
                    result.skipped++;
                    continue;
                }

                // Parse examples from flattened format
                const examples: ExampleSentenceDto[] = [];
                if (item.example1_cn && item.example1_vi) {
                    examples.push({
                        chinese: item.example1_cn,
                        pinyin: item.example1_py,
                        vietnamese: item.example1_vi,
                    });
                }
                if (item.example2_cn && item.example2_vi) {
                    examples.push({
                        chinese: item.example2_cn,
                        pinyin: item.example2_py,
                        vietnamese: item.example2_vi,
                    });
                }

                // Parse synonyms
                const synonyms: RelatedWordDto[] = [];
                if (item.synonym1) {
                    synonyms.push({
                        hanzi: item.synonym1,
                        pinyin: item.synonym1_py || '',
                        meaningVi: item.synonym1_vi || '',
                    });
                }
                if (item.synonym2) {
                    synonyms.push({
                        hanzi: item.synonym2,
                        pinyin: item.synonym2_py || '',
                        meaningVi: item.synonym2_vi || '',
                    });
                }

                // Parse antonyms
                const antonyms: RelatedWordDto[] = [];
                if (item.antonym1) {
                    antonyms.push({
                        hanzi: item.antonym1,
                        pinyin: item.antonym1_py || '',
                        meaningVi: item.antonym1_vi || '',
                    });
                }
                if (item.antonym2) {
                    antonyms.push({
                        hanzi: item.antonym2,
                        pinyin: item.antonym2_py || '',
                        meaningVi: item.antonym2_vi || '',
                    });
                }

                // Build update data - only include non-empty fields
                const updateData: any = {};
                if (item.pinyin) updateData.pinyin = item.pinyin;
                if (item.meaningVi) updateData.meaningVi = item.meaningVi;
                if (item.meaningEn) updateData.meaningEn = item.meaningEn;
                if (item.radical) updateData.radical = item.radical;
                if (item.radicalMeaning) updateData.radicalMeaning = item.radicalMeaning;
                if (item.strokeCount) updateData.strokeCount = item.strokeCount;
                if (item.partOfSpeech) updateData.partOfSpeech = item.partOfSpeech;
                if (item.hskLevel !== undefined && item.hskLevel !== null) updateData.hskLevel = item.hskLevel;
                if (item.mnemonic) updateData.mnemonic = item.mnemonic;
                if (examples.length > 0) updateData.examples = examples;
                if (synonyms.length > 0) updateData.synonyms = synonyms;
                if (antonyms.length > 0) updateData.antonyms = antonyms;

                // Update vocabulary
                await this.prisma.vocabulary.update({
                    where: { hanzi: item.hanzi },
                    data: updateData,
                });

                result.updated++;
            } catch (error) {
                result.errors++;
                result.errorDetails.push({
                    hanzi: item.hanzi || '(unknown)',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        return result;
    }

    /**
     * Delete all vocabulary (for re-import)
     * Cascades: deletes related UserVocabulary, VideoVocabulary, VocabularyEmbedding, FlashcardReview records
     * Sets SubtitleToken.vocabularyId to null
     */
    async deleteAll(): Promise<number> {
        return this.prisma.$transaction(async (tx) => {
            // Delete related records first (foreign key constraints)
            await tx.flashcardReview.deleteMany({});
            await tx.userVocabulary.deleteMany({});
            await tx.videoVocabulary.deleteMany({});
            await tx.vocabularyEmbedding.deleteMany({});
            // SubtitleToken has optional vocabularyId, just null it
            await tx.subtitleToken.updateMany({
                where: { vocabularyId: { not: null } },
                data: { vocabularyId: null },
            });

            // Now delete all vocabulary
            const { count } = await tx.vocabulary.deleteMany({});
            return count;
        });
    }
}
