import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserVocabularyService {
  constructor(private prisma: PrismaService) {}

  private normalizeHanziInput(input: string): string {
    return String(input || '')
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
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

  async findAll(
    userId: string,
    query: {
      page?: number;
      limit?: number;
      proficiency?: string;
      search?: string;
      sourceVideoId?: string;
      hskLevel?: number;
    },
  ) {
    const {
      page = 1,
      limit = 20,
      proficiency,
      search,
      sourceVideoId,
      hskLevel,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (proficiency) {
      where.proficiency = proficiency;
    }

    if (sourceVideoId) {
      where.sourceVideoId = sourceVideoId;
    }

    if (hskLevel) {
      where.vocabulary = { hskLevel };
    }

    const candidates = this.buildSearchCandidates(search || '');
    if (candidates.length > 0) {
      const allRows = await this.prisma.userVocabulary.findMany({
        where,
        orderBy: { savedAt: 'desc' },
        include: {
          vocabulary: true,
          sourceVideo: {
            select: { id: true, title: true, thumbnailUrl: true },
          },
        },
      });

      const foldedCandidates = candidates.map((c) => this.foldSearchText(c));

      const scoreRow = (row: any): number => {
        const hanzi = this.normalizeSearchInput(row?.vocabulary?.hanzi || '');
        const pinyin = this.normalizeSearchInput(row?.vocabulary?.pinyin || '');
        const meaningVi = this.normalizeSearchInput(
          row?.vocabulary?.meaningVi || '',
        );
        const meaningEn = this.normalizeSearchInput(
          row?.vocabulary?.meaningEn || '',
        );

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
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
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

  async saveVocabulary(
    userId: string,
    data: {
      vocabularyId: string;
      sourceVideoId?: string;
    },
  ) {
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
  async saveWord(
    userId: string,
    data: {
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
    },
  ) {
    // Find vocabulary in system library (Admin-managed)
    const vocab = await this.prisma.vocabulary.findUnique({
      where: { hanzi: data.hanzi },
    });

    // BLOCK: Users cannot save words that don't exist in system
    if (!vocab) {
      throw new BadRequestException(
        'Từ này chưa có trong thư viện hệ thống. Chỉ Admin mới có thể thêm từ mới.',
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

  async updateProficiency(
    userId: string,
    id: string,
    data: {
      proficiency: string;
      proficiencyPercent: number;
    },
  ) {
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

    const proficiencyStats = byProficiency.reduce(
      (acc, curr) => {
        acc[curr.proficiency] = curr._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total,
      new: proficiencyStats.new || 0,
      learning: proficiencyStats.learning || 0,
      review: proficiencyStats.review || 0,
      mastered: proficiencyStats.mastered || 0,
      savedThisWeek: recentlySaved,
    };
  }

  async checkSavedWord(userId: string, hanzi: string) {
    const normalizedHanzi = this.normalizeHanziInput(hanzi);
    if (!normalizedHanzi) {
      throw new BadRequestException('hanzi is required');
    }

    const vocab = await this.prisma.vocabulary.findUnique({
      where: { hanzi: normalizedHanzi },
      select: { id: true, hanzi: true },
    });

    if (!vocab) {
      return {
        hanzi: normalizedHanzi,
        vocabularyId: null,
        saved: false,
        userVocabularyId: null,
        folderId: null,
        savedAt: null,
      };
    }

    const userVocab = await this.prisma.userVocabulary.findUnique({
      where: {
        userId_vocabularyId: {
          userId,
          vocabularyId: vocab.id,
        },
      },
      select: {
        id: true,
        folderId: true,
        savedAt: true,
      },
    });

    return {
      hanzi: vocab.hanzi,
      vocabularyId: vocab.id,
      saved: Boolean(userVocab),
      userVocabularyId: userVocab?.id || null,
      folderId: userVocab?.folderId || null,
      savedAt: userVocab?.savedAt || null,
    };
  }

  async checkSavedWordsBatch(userId: string, hanziList: string[]) {
    const normalizedWords = Array.from(
      new Set(
        (hanziList || [])
          .map((word) => this.normalizeHanziInput(word))
          .filter(Boolean),
      ),
    );

    if (normalizedWords.length === 0) {
      return {
        savedHanzi: [],
        items: [],
      };
    }

    const vocabRows = await this.prisma.vocabulary.findMany({
      where: { hanzi: { in: normalizedWords } },
      select: { id: true, hanzi: true },
    });

    if (vocabRows.length === 0) {
      return {
        savedHanzi: [],
        items: normalizedWords.map((hanzi) => ({
          hanzi,
          vocabularyId: null,
          saved: false,
          userVocabularyId: null,
          folderId: null,
          savedAt: null,
        })),
      };
    }

    const vocabIdToHanzi = new Map(vocabRows.map((row) => [row.id, row.hanzi]));
    const userRows = await this.prisma.userVocabulary.findMany({
      where: {
        userId,
        vocabularyId: { in: vocabRows.map((row) => row.id) },
      },
      select: {
        id: true,
        vocabularyId: true,
        folderId: true,
        savedAt: true,
      },
    });

    const userByHanzi = new Map(
      userRows
        .map((row) => {
          const hanzi = vocabIdToHanzi.get(row.vocabularyId);
          if (!hanzi) return null;
          return [hanzi, row] as const;
        })
        .filter(
          (entry): entry is readonly [string, (typeof userRows)[number]] =>
            Boolean(entry),
        ),
    );

    const vocabByHanzi = new Map(vocabRows.map((row) => [row.hanzi, row.id]));

    const items = normalizedWords.map((hanzi) => {
      const vocabId = vocabByHanzi.get(hanzi) || null;
      const userRow = userByHanzi.get(hanzi);

      return {
        hanzi,
        vocabularyId: vocabId,
        saved: Boolean(userRow),
        userVocabularyId: userRow?.id || null,
        folderId: userRow?.folderId || null,
        savedAt: userRow?.savedAt || null,
      };
    });

    return {
      savedHanzi: items.filter((item) => item.saved).map((item) => item.hanzi),
      items,
    };
  }
}
