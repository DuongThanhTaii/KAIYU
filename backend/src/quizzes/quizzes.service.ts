import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto } from './dto';

@Injectable()
export class QuizzesService {
    constructor(private prisma: PrismaService) { }

    // Get quiz for a video
    async findByVideoId(videoId: string) {
        const quiz = await this.prisma.videoQuiz.findUnique({
            where: { videoId },
            include: {
                questions: {
                    orderBy: { sequenceOrder: 'asc' },
                },
                video: {
                    select: { id: true, title: true, hskLevel: true },
                },
            },
        });
        return quiz;
    }

    // Get quiz by ID
    async findOne(id: string) {
        const quiz = await this.prisma.videoQuiz.findUnique({
            where: { id },
            include: {
                questions: {
                    orderBy: { sequenceOrder: 'asc' },
                },
                video: {
                    select: { id: true, title: true, hskLevel: true },
                },
            },
        });
        if (!quiz) {
            throw new NotFoundException('Quiz not found');
        }
        return quiz;
    }

    // Create quiz manually (without auto-generation)
    async create(dto: CreateQuizDto) {
        // Check if video exists
        const video = await this.prisma.video.findUnique({
            where: { id: dto.videoId },
        });
        if (!video) {
            throw new NotFoundException('Video not found');
        }

        // Delete existing quiz if any
        await this.prisma.videoQuiz.deleteMany({
            where: { videoId: dto.videoId },
        });

        // Create new quiz
        const quiz = await this.prisma.videoQuiz.create({
            data: {
                videoId: dto.videoId,
                title: dto.title || `Bài tập: ${video.title}`,
                description: dto.description || 'Bài tập điền từ vào chỗ trống',
            },
            include: {
                questions: { orderBy: { sequenceOrder: 'asc' } },
                video: { select: { id: true, title: true, hskLevel: true } },
            },
        });

        return quiz;
    }

    // Auto-generate quiz from video subtitles
    async generateFromSubtitles(videoId: string) {
        // Check if video exists
        const video = await this.prisma.video.findUnique({
            where: { id: videoId },
            include: {
                subtitles: {
                    orderBy: { sequenceOrder: 'asc' },
                    include: {
                        tokens: {
                            include: { vocabulary: true },
                        },
                    },
                },
            },
        });

        if (!video) {
            throw new NotFoundException('Video not found');
        }

        // Delete existing quiz if any
        await this.prisma.videoQuiz.deleteMany({
            where: { videoId },
        });

        // Create new quiz
        const quiz = await this.prisma.videoQuiz.create({
            data: {
                videoId,
                title: `Bài tập: ${video.title}`,
                description: `Bài tập điền từ vào chỗ trống từ nội dung video`,
            },
        });

        // Generate questions from subtitles
        const questions: CreateQuestionDto[] = [];
        let sequenceOrder = 0;

        // Get vocabulary for wrong options
        const vocabulary = await this.prisma.vocabulary.findMany({
            where: { hskLevel: { lte: video.hskLevel + 1 } },
            select: { hanzi: true },
            take: 200,
        });
        const vocabWords = vocabulary.map((v) => v.hanzi);

        for (const subtitle of video.subtitles) {
            // Skip if subtitle has no tokens or no Chinese text
            if (!subtitle.tokens || subtitle.tokens.length === 0) continue;
            if (!subtitle.hanzi || subtitle.hanzi.trim() === '') continue;

            // Find tokens that are vocabulary words (good candidates for blanks)
            const vocabTokens = subtitle.tokens.filter(
                (t) => t.vocabulary && t.hanzi.length >= 1
            );

            if (vocabTokens.length === 0) continue;

            // Pick a random token to be the blank
            const targetToken = vocabTokens[Math.floor(Math.random() * vocabTokens.length)];
            const blankWord = targetToken.hanzi;

            // Generate wrong options from vocabulary (same HSK level preferred)
            const wrongOptions = this.getWrongOptions(blankWord, vocabWords, 3);

            // Shuffle options with correct answer
            const options = this.shuffleArray([blankWord, ...wrongOptions]);

            questions.push({
                sentenceHanzi: subtitle.hanzi,
                blankWord,
                blankPosition: targetToken.position,
                options,
                meaningVi: subtitle.meaningVi || undefined,
                sequenceOrder: sequenceOrder++,
                subtitleId: subtitle.id,
            });
        }

        // Limit to reasonable number of questions (max 20)
        const limitedQuestions = questions.slice(0, 20);

        // Create all questions
        if (limitedQuestions.length > 0) {
            await this.prisma.quizQuestion.createMany({
                data: limitedQuestions.map((q) => ({
                    quizId: quiz.id,
                    ...q,
                })),
            });
        }

        // Return quiz with questions
        return this.findOne(quiz.id);
    }

    // Get wrong options for a word
    private getWrongOptions(correctWord: string, vocabPool: string[], count: number): string[] {
        const options: string[] = [];
        const shuffled = this.shuffleArray([...vocabPool]);

        for (const word of shuffled) {
            if (word !== correctWord && !options.includes(word)) {
                options.push(word);
                if (options.length >= count) break;
            }
        }

        // Fallback if not enough options
        while (options.length < count) {
            options.push('___');
        }

        return options;
    }

    // Shuffle array
    private shuffleArray<T>(array: T[]): T[] {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // Update quiz
    async update(id: string, dto: UpdateQuizDto) {
        const quiz = await this.prisma.videoQuiz.findUnique({ where: { id } });
        if (!quiz) {
            throw new NotFoundException('Quiz not found');
        }

        return this.prisma.videoQuiz.update({
            where: { id },
            data: dto,
            include: {
                questions: { orderBy: { sequenceOrder: 'asc' } },
            },
        });
    }

    // Publish quiz
    async publish(id: string) {
        const quiz = await this.prisma.videoQuiz.findUnique({ where: { id } });
        if (!quiz) {
            throw new NotFoundException('Quiz not found');
        }

        return this.prisma.videoQuiz.update({
            where: { id },
            data: { isPublished: true },
        });
    }

    // Delete quiz
    async remove(id: string) {
        const quiz = await this.prisma.videoQuiz.findUnique({ where: { id } });
        if (!quiz) {
            throw new NotFoundException('Quiz not found');
        }

        await this.prisma.videoQuiz.delete({ where: { id } });
        return { message: 'Quiz deleted successfully' };
    }

    // Add question to quiz
    async addQuestion(quizId: string, dto: CreateQuestionDto) {
        const quiz = await this.prisma.videoQuiz.findUnique({ where: { id: quizId } });
        if (!quiz) {
            throw new NotFoundException('Quiz not found');
        }

        return this.prisma.quizQuestion.create({
            data: {
                quizId,
                ...dto,
            },
        });
    }

    // Update question
    async updateQuestion(questionId: string, dto: UpdateQuestionDto) {
        const question = await this.prisma.quizQuestion.findUnique({ where: { id: questionId } });
        if (!question) {
            throw new NotFoundException('Question not found');
        }

        return this.prisma.quizQuestion.update({
            where: { id: questionId },
            data: dto,
        });
    }

    // Delete question
    async removeQuestion(questionId: string) {
        const question = await this.prisma.quizQuestion.findUnique({ where: { id: questionId } });
        if (!question) {
            throw new NotFoundException('Question not found');
        }

        await this.prisma.quizQuestion.delete({ where: { id: questionId } });
        return { message: 'Question deleted successfully' };
    }
}
