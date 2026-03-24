import { Test, TestingModule } from '@nestjs/testing';
import { CustomDictionaryService } from './custom-dictionary.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CustomDictionaryService', () => {
    let service: CustomDictionaryService;
    let prisma: PrismaService;

    const mockPrisma = {
        vocabulary: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CustomDictionaryService,
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        service = module.get<CustomDictionaryService>(CustomDictionaryService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('lookup', () => {
        it('should return found: true and include ID for existing words', async () => {
            const mockWord = {
                id: 'test-id',
                hanzi: '你好',
                pinyin: 'nǐ hǎo',
                meaningVi: 'Xin chào',
                partOfSpeech: 'Phiên âm',
                hskLevel: 1,
            };

            mockPrisma.vocabulary.findUnique.mockResolvedValue(mockWord);
            mockPrisma.vocabulary.findMany.mockResolvedValue([mockWord]);

            const result = await service.lookup('你好');

            expect(result.found).toBe(true);
            expect(result.id).toBe('test-id');
            expect(result.hanzi).toBe('你好');
            expect(result.pinyin).toBe('nǐ hǎo');
        });

        it('should return found: false for non-existent words', async () => {
            mockPrisma.vocabulary.findUnique.mockResolvedValue(null);
            
            const result = await service.lookup('unknown');

            expect(result.found).toBe(false);
            expect(result.hanzi).toBe('unknown');
        });
    });
});
