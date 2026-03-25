import { Test, TestingModule } from '@nestjs/testing';
import { UserVocabularyService } from './user-vocabulary.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UserVocabularyService', () => {
  let service: UserVocabularyService;

  const mockPrisma = {
    userVocabulary: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserVocabularyService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UserVocabularyService>(UserVocabularyService);
  });

  it('should match copied hanzi with surrounding punctuation', async () => {
    mockPrisma.userVocabulary.findMany.mockResolvedValue([
      {
        id: 'uv-1',
        userId: 'user-1',
        savedAt: new Date('2026-01-01T00:00:00Z'),
        vocabulary: {
          id: 'v-1',
          hanzi: '你好',
          pinyin: 'nǐ hǎo',
          meaningVi: 'xin chào',
          meaningEn: 'hello',
        },
        sourceVideo: null,
      },
    ]);

    const result = await service.findAll('user-1', {
      page: 1,
      limit: 20,
      search: '「你好」',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].vocabulary.hanzi).toBe('你好');
    expect(result.meta.total).toBe(1);
  });

  it('should match pinyin without tone marks', async () => {
    mockPrisma.userVocabulary.findMany.mockResolvedValue([
      {
        id: 'uv-2',
        userId: 'user-1',
        savedAt: new Date('2026-01-01T00:00:00Z'),
        vocabulary: {
          id: 'v-2',
          hanzi: '学习',
          pinyin: 'xué xí',
          meaningVi: 'học tập',
          meaningEn: 'study',
        },
        sourceVideo: null,
      },
    ]);

    const result = await service.findAll('user-1', {
      page: 1,
      limit: 20,
      search: 'xue xi',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].vocabulary.hanzi).toBe('学习');
    expect(result.meta.total).toBe(1);
  });
});
