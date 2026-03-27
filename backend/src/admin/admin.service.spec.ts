import { Test, TestingModule } from '@nestjs/testing';

// Mock the parser BEFORE importing the service to avoid module resolution errors
jest.mock('../videos/subtitle-parser', () => ({
  parseSubtitleFile: jest.fn(),
  tokenizeChinese: jest.fn(),
  segmentHanziWithPinyin: jest.fn(),
}));

import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;

  const mockPrisma = {
    subtitle: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    subtitleToken: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    user: { count: jest.fn(), findMany: jest.fn() },
    video: { count: jest.fn() },
    vocabulary: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    flashcardReview: { count: jest.fn() },
    videoProgress: { count: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<PrismaService>(PrismaService);

    mockPrisma.subtitleToken.findMany.mockResolvedValue([]);
    mockPrisma.vocabulary.findMany.mockResolvedValue([]);
    // Default: return a subtitle with tokens for updateSubtitle's final findUnique
    mockPrisma.subtitle.findUnique.mockResolvedValue({ id: 'sub-1', tokens: [] });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateSubtitle', () => {
    const subtitleId = 'sub-1';
    const updateData = {
      meaningVi: 'Nghĩa mới',
      tokens: [
        {
          hanzi: '你好',
          pinyin: 'nǐ hǎo',
          meaning: 'Hello',
          position: 0,
          hskLevel: 1,
          partOfSpeech: 'Phiên âm',
        },
      ],
    };

    it('should update subtitle metadata and tokens', async () => {
      mockPrisma.subtitle.update.mockResolvedValue({
        id: subtitleId,
        ...updateData,
      });
      mockPrisma.subtitleToken.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.subtitleToken.createMany.mockResolvedValue({ count: 1 });

      const result = await service.updateSubtitle(subtitleId, updateData);

      expect(prisma.subtitle.update).toHaveBeenCalledWith({
        where: { id: subtitleId },
        data: { meaningVi: 'Nghĩa mới' },
      });

      expect(prisma.subtitleToken.deleteMany).toHaveBeenCalledWith({
        where: { subtitleId },
      });

      expect(prisma.subtitleToken.createMany).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should update global vocabulary when updateGlobal is true', async () => {
      const dataWithGlobal = {
        ...updateData,
        updateGlobal: true,
        tokens: [
          {
            hanzi: '你好',
            pinyin: 'nǐ hǎo',
            meaning: 'Hello Global',
            position: 0,
            hskLevel: 1,
            partOfSpeech: 'Phiên âm',
            vocabularyId: 'vocab-1',
          },
        ],
      };

      mockPrisma.subtitle.update.mockResolvedValue({ id: subtitleId });
      mockPrisma.vocabulary.update.mockResolvedValue({ id: 'vocab-1' });

      await service.updateSubtitle(subtitleId, dataWithGlobal);

      expect(prisma.vocabulary.update).toHaveBeenCalledWith({
        where: { id: 'vocab-1' },
        data: expect.objectContaining({
          meaningVi: 'Hello Global',
        }),
      });
    });

    it('should create new vocabulary if missing and updateGlobal is true', async () => {
      const dataWithCreate = {
        ...updateData,
        updateGlobal: true,
        tokens: [
          {
            hanzi: '新词',
            pinyin: 'xīn cí',
            meaning: 'New Word',
            position: 0,
            hskLevel: 2,
            partOfSpeech: 'Danh từ',
          },
        ],
      };

      mockPrisma.subtitle.update.mockResolvedValue({ id: subtitleId });
      mockPrisma.vocabulary.findUnique.mockResolvedValue(null);
      mockPrisma.vocabulary.create.mockResolvedValue({ id: 'new-vocab-id' });

      await service.updateSubtitle(subtitleId, dataWithCreate);

      expect(prisma.vocabulary.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          hanzi: '新词',
          meaningVi: 'New Word',
        }),
      });

      expect(prisma.subtitleToken.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            vocabularyId: 'new-vocab-id',
          }),
        ],
      });
    });

    it('should correctly reorder tokens when positions are changed', async () => {
      const subtitleId = 'sub-123';
      // Reorder: A (pos 0), B (pos 1)
      const reorderedTokens = [
        {
          hanzi: 'A',
          position: 0,
          pinyin: 'A',
          meaning: '',
          hskLevel: 1,
          partOfSpeech: 'n',
        },
        {
          hanzi: 'B',
          position: 1,
          pinyin: 'B',
          meaning: '',
          hskLevel: 1,
          partOfSpeech: 'v',
        },
      ];

      mockPrisma.subtitle.update.mockResolvedValue({ id: subtitleId });
      mockPrisma.subtitleToken.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.subtitleToken.createMany.mockResolvedValue({ count: 2 });

      await service.updateSubtitle(subtitleId, { tokens: reorderedTokens });

      // Verify deleteMany was called
      expect(prisma.subtitleToken.deleteMany).toHaveBeenCalledWith({
        where: { subtitleId },
      });

      // Verify createMany was called with the REORDERED tokens
      expect(prisma.subtitleToken.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ hanzi: 'A', position: 0 }),
          expect.objectContaining({ hanzi: 'B', position: 1 }),
        ]),
      });
    });

    it('should preserve pinyin from existing tokens when incoming token pinyin is empty', async () => {
      const subtitleId = 'sub-restore-pinyin';
      mockPrisma.subtitle.update.mockResolvedValue({ id: subtitleId });
      mockPrisma.subtitleToken.findMany.mockResolvedValue([
        {
          subtitleId,
          hanzi: '偶',
          pinyin: 'ou3',
          position: 0,
        },
      ]);

      await service.updateSubtitle(subtitleId, {
        tokens: [
          {
            hanzi: '偶',
            pinyin: '',
            meaning: 'thỉnh thoảng',
            position: 0,
            hskLevel: 4,
            partOfSpeech: 'phó từ',
          },
        ],
      });

      expect(prisma.subtitleToken.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            hanzi: '偶',
            pinyin: 'ou3',
            position: 0,
          }),
        ],
      });
    });
  });

  describe('getAllVocabulary', () => {
    it('should match copied hanzi with surrounding punctuation', async () => {
      mockPrisma.vocabulary.findMany.mockResolvedValue([
        {
          id: 'v1',
          hanzi: '你好',
          pinyin: 'nǐ hǎo',
          meaningVi: 'xin chào',
          meaningEn: 'hello',
          hskLevel: 1,
        },
      ]);

      const result = await service.getAllVocabulary({
        page: 1,
        limit: 50,
        search: '「你好」',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].hanzi).toBe('你好');
      expect(result.meta.total).toBe(1);
    });

    it('should match pinyin without tone marks', async () => {
      mockPrisma.vocabulary.findMany.mockResolvedValue([
        {
          id: 'v2',
          hanzi: '学习',
          pinyin: 'xué xí',
          meaningVi: 'học tập',
          meaningEn: 'study',
          hskLevel: 1,
        },
      ]);

      const result = await service.getAllVocabulary({
        page: 1,
        limit: 50,
        search: 'xue xi',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].hanzi).toBe('学习');
      expect(result.meta.total).toBe(1);
    });
  });
});
