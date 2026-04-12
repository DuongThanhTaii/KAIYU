import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

interface MeaningEntry {
  partOfSpeech: string;
  pinyin: string;
  meanings: string[];
}

@Injectable()
export class VocabularyService {
  private readonly logger = new Logger(VocabularyService.name);

  constructor(private prisma: PrismaService) {}

  private toJsonValue<T>(value: T): Prisma.InputJsonValue {
    return value as unknown as Prisma.InputJsonValue;
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
  }

  private normalizeOptionalText(value?: string): string | undefined {
    if (typeof value !== 'string') return value;
    const normalized = this.normalizeText(value);
    return normalized.length > 0 ? normalized : undefined;
  }

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
        orderBy: [
          { sequenceOrder: 'asc' },
          { hskLevel: 'asc' },
          { hanzi: 'asc' },
        ],
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
        chars.map((char) =>
          this.prisma.vocabulary.findUnique({ where: { hanzi: char } }),
        ),
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
    const normalizedHanzi = this.normalizeText(data.hanzi);
    const normalizedPinyin = this.normalizeText(data.pinyin);
    const normalizedMeaningVi = this.normalizeText(data.meaningVi);

    const existing = await this.prisma.vocabulary.findUnique({
      where: { hanzi: normalizedHanzi },
    });

    if (existing) {
      throw new ConflictException(
        `Từ vựng "${normalizedHanzi}" đã tồn tại trong hệ thống. Vui lòng sử dụng chức năng Sửa để cập nhật.`,
      );
    }

    // If meanings array is provided, generate primary meaningVi from first entry
    let primaryMeaningVi = normalizedMeaningVi;
    let primaryPartOfSpeech = this.normalizeOptionalText(data.partOfSpeech);
    if (data.meanings && data.meanings.length > 0) {
      primaryPartOfSpeech = data.meanings
        .map((m) => this.normalizeText(m.partOfSpeech))
        .join(', ');
      // Combine all meanings for quick display
      primaryMeaningVi = data.meanings
        .flatMap((m) => m.meanings)
        .map((m) => this.normalizeText(m))
        .join('; ');
    }

    return this.prisma.vocabulary.create({
      data: {
        hanzi: normalizedHanzi,
        pinyin: normalizedPinyin,
        meaningVi: primaryMeaningVi,
        meaningEn: this.normalizeOptionalText(data.meaningEn),
        radical: this.normalizeOptionalText(data.radical),
        radicalMeaning: this.normalizeOptionalText(data.radicalMeaning),
        strokeCount: data.strokeCount,
        partOfSpeech: primaryPartOfSpeech,
        hskLevel: data.hskLevel,
        tags: data.tags || [],
        audioUrl: this.normalizeOptionalText(data.audioUrl),
        examples: this.toJsonValue(data.examples || []),
        synonyms: this.toJsonValue(data.synonyms || []),
        antonyms: this.toJsonValue(data.antonyms || []),
        mnemonic: this.normalizeOptionalText(data.mnemonic),
        meanings: this.toJsonValue(data.meanings || []),
      } as Prisma.VocabularyCreateInput,
    });
  }

  async update(id: string, data: UpdateVocabularyDto) {
    const vocab = await this.prisma.vocabulary.findUnique({ where: { id } });

    if (!vocab) {
      throw new NotFoundException('Vocabulary not found');
    }

    // Build update data, only include defined fields
    const updateData: any = {};
    if (data.hanzi !== undefined)
      updateData.hanzi = this.normalizeText(data.hanzi);
    if (data.pinyin !== undefined)
      updateData.pinyin = this.normalizeText(data.pinyin);
    if (data.meaningVi !== undefined)
      updateData.meaningVi = this.normalizeText(data.meaningVi);
    if (data.meaningEn !== undefined)
      updateData.meaningEn = this.normalizeOptionalText(data.meaningEn);
    if (data.radical !== undefined)
      updateData.radical = this.normalizeOptionalText(data.radical);
    if (data.radicalMeaning !== undefined)
      updateData.radicalMeaning = this.normalizeOptionalText(
        data.radicalMeaning,
      );
    if (data.strokeCount !== undefined)
      updateData.strokeCount = data.strokeCount;
    if (data.partOfSpeech !== undefined)
      updateData.partOfSpeech = this.normalizeOptionalText(data.partOfSpeech);
    if (data.hskLevel !== undefined) updateData.hskLevel = data.hskLevel;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.audioUrl !== undefined)
      updateData.audioUrl = this.normalizeOptionalText(data.audioUrl);
    if (data.examples !== undefined) updateData.examples = data.examples;
    if (data.synonyms !== undefined) updateData.synonyms = data.synonyms;
    if (data.antonyms !== undefined) updateData.antonyms = data.antonyms;
    if (data.mnemonic !== undefined)
      updateData.mnemonic = this.normalizeOptionalText(data.mnemonic);
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
  async validateImport(
    items: ImportVocabularyItemDto[],
  ): Promise<{ duplicates: string[]; total: number }> {
    const uniqueHanzis = Array.from(
      new Set(items.map((i) => i.hanzi).filter(Boolean)),
    );

    const existing = await this.prisma.vocabulary.findMany({
      where: { hanzi: { in: uniqueHanzis } },
      select: { hanzi: true },
    });

    return {
      duplicates: existing.map((e) => e.hanzi),
      total: items.length,
    };
  }

  /**
   * Helper: check if a string is empty/placeholder
   */
  private isEmptyValue(val: string | undefined | null): boolean {
    if (!val) return true;
    const trimmed = val.trim();
    return (
      trimmed === '' || trimmed === '-' || trimmed === '—' || trimmed === 'N/A'
    );
  }

  /**
   * Import vocabulary from XLSX/CSV data
   * Enhanced with detailed skip/error logging
   */
  async importVocabulary(request: ImportRequestDto): Promise<ImportResultDto> {
    const { items, duplicateAction = 'skip' } = request;

    const result: ImportResultDto = {
      created: 0,
      skipped: 0,
      merged: 0,
      errors: 0,
      errorDetails: [],
      skippedDetails: [],
    };

    this.logger.log(
      `[IMPORT START] Total items: ${items.length}, duplicateAction: ${duplicateAction}`,
    );

    // Get current max sequenceOrder
    const maxSeqRes = await this.prisma.vocabulary.aggregate({
      _max: { sequenceOrder: true },
    });
    let currentSequence = maxSeqRes._max.sequenceOrder || 0;

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      currentSequence++;
      const itemSequence = currentSequence;

      try {
        // Normalize hanzi: trim whitespace
        const hanzi = (item.hanzi || '').trim();

        // Validate required field: hanzi
        if (!hanzi) {
          const reason = `Row ${idx + 1}: Thiếu hanzi (trống)`;
          this.logger.warn(`[IMPORT SKIP] ${reason}`);
          result.errors++;
          result.errorDetails!.push({
            hanzi: '(trống)',
            error: reason,
          });
          continue;
        }

        // Auto-fill meaningVi if missing or placeholder
        let meaningVi = (item.meaningVi || '').trim();
        if (this.isEmptyValue(meaningVi)) {
          meaningVi = '(chưa có nghĩa)';
          this.logger.debug(
            `[IMPORT] hanzi='${hanzi}': meaningVi was empty/'-', auto-filled`,
          );
        }

        // Check for existing
        const existing = await this.prisma.vocabulary.findUnique({
          where: { hanzi },
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

        const vocabData: Prisma.VocabularyCreateInput = {
          hanzi,
          pinyin: (item.pinyin || '').trim() || '',
          meaningVi,
          meaningEn: item.meaningEn ? item.meaningEn.trim() : undefined,
          radical: item.radical ? item.radical.trim() : undefined,
          radicalMeaning: item.radicalMeaning,
          strokeCount: item.strokeCount,
          partOfSpeech: item.partOfSpeech
            ? item.partOfSpeech.trim()
            : undefined,
          hskLevel: item.hskLevel ?? 1,
          tags: item.tags || [],
          examples: this.toJsonValue(examples.length > 0 ? examples : []),
          synonyms: this.toJsonValue(synonyms.length > 0 ? synonyms : []),
          antonyms: this.toJsonValue(antonyms.length > 0 ? antonyms : []),
          mnemonic: item.mnemonic,
        };

        if (existing) {
          if (duplicateAction === 'skip') {
            result.skipped++;
            result.skippedDetails!.push({
              hanzi,
              reason: `Đã tồn tại trong DB (duplicate, action=skip)`,
            });
            continue;
          }

          // Update existing: merge richer data, keep lower HSK level
          const updateData: any = {};
          if (item.pinyin && !existing.pinyin) updateData.pinyin = item.pinyin;
          if (item.meaningEn && !existing.meaningEn)
            updateData.meaningEn = item.meaningEn;
          if (item.partOfSpeech && !existing.partOfSpeech)
            updateData.partOfSpeech = item.partOfSpeech;
          if (meaningVi && meaningVi !== '(chưa có nghĩa)')
            updateData.meaningVi = meaningVi;
          if (item.hskLevel != null && item.hskLevel < existing.hskLevel)
            updateData.hskLevel = item.hskLevel;

          if (examples.length > 0) updateData.examples = examples;
          if (synonyms.length > 0) updateData.synonyms = synonyms;
          if (antonyms.length > 0) updateData.antonyms = antonyms;

          // Merge meanings logic for duplicates
          const existingMeanings =
            (existing.meanings as unknown as MeaningEntry[]) || [];
          const isAlreadyInMeanings = existingMeanings.some(
            (m) =>
              m.pinyin === (item.pinyin || '') &&
              m.partOfSpeech === (item.partOfSpeech || '') &&
              (m.meanings || []).includes(meaningVi),
          );
          const isIdenticalToPrimary =
            (existing.pinyin || '') === (item.pinyin || '') &&
            existing.meaningVi === meaningVi &&
            (existing.partOfSpeech || '') === (item.partOfSpeech || '');

          let hasMerged = false;
          if (
            !isAlreadyInMeanings &&
            !isIdenticalToPrimary &&
            meaningVi !== '(chưa có nghĩa)'
          ) {
            existingMeanings.push({
              partOfSpeech: item.partOfSpeech || '',
              pinyin: item.pinyin || '',
              meanings: [meaningVi],
            });
            updateData.meanings = existingMeanings;
            hasMerged = true;
          }

          if (Object.keys(updateData).length > 0) {
            await this.prisma.vocabulary.update({
              where: { hanzi },
              data: updateData,
            });
          }
          if (hasMerged) {
            result.merged = (result.merged || 0) + 1;
          } else {
            result.skipped++;
            result.skippedDetails!.push({
              hanzi,
              reason: `Đã tồn tại, không có dữ liệu mới để merge (action=overwrite)`,
            });
          }
        } else {
          // Create new
          vocabData.sequenceOrder = itemSequence;
          await this.prisma.vocabulary.create({ data: vocabData });
          result.created++;
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `[IMPORT ERROR] hanzi='${item.hanzi || '?'}': ${errMsg}`,
        );
        result.errors++;
        result.errorDetails!.push({
          hanzi: item.hanzi || '(unknown)',
          error: errMsg,
        });
      }
    }

    // Log summary
    this.logger.log(
      `[IMPORT DONE] created=${result.created} skipped=${result.skipped} merged=${result.merged} errors=${result.errors}`,
    );
    if (
      result.skippedDetails!.length > 0 &&
      result.skippedDetails!.length <= 50
    ) {
      this.logger.log(
        `[IMPORT SKIPPED DETAILS] ${JSON.stringify(result.skippedDetails)}`,
      );
    } else if (result.skippedDetails!.length > 50) {
      this.logger.log(
        `[IMPORT SKIPPED] ${result.skippedDetails!.length} items skipped (too many to log individually)`,
      );
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
      orderBy: [
        { sequenceOrder: 'asc' },
        { hskLevel: 'asc' },
        { hanzi: 'asc' },
      ],
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
        if (item.radicalMeaning)
          updateData.radicalMeaning = item.radicalMeaning;
        if (item.strokeCount) updateData.strokeCount = item.strokeCount;
        if (item.partOfSpeech) updateData.partOfSpeech = item.partOfSpeech;
        if (item.hskLevel !== undefined && item.hskLevel !== null)
          updateData.hskLevel = item.hskLevel;
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
