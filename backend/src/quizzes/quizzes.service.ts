import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto } from './dto';
import { GeminiService } from '../gemini/gemini.service';

@Injectable()
export class QuizzesService {
    constructor(
        private prisma: PrismaService,
        private geminiService: GeminiService
    ) { }

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

    // Auto-generate quiz from video subtitles using Gemini AI
    async generateFromSubtitles(videoId: string) {
        // Check if video exists
        const video = await this.prisma.video.findUnique({
            where: { id: videoId },
            include: {
                subtitles: {
                    orderBy: { sequenceOrder: 'asc' },
                },
            },
        });

        if (!video) {
            throw new NotFoundException('Video not found');
        }

        // Prepare bilingual subtitle text context for Gemini
        const subtitleLines = video.subtitles
            .filter(sub => sub.hanzi && sub.hanzi.trim().length > 0)
            .slice(0, 40) // limit to avoid massive token payload
            .map(sub => `Việt: ${sub.meaningVi || ''} | Trung: ${sub.hanzi}`)
            .join('\n');

        if (!subtitleLines) {
            throw new Error('Video này không có nội dung phụ đề tiếng Trung hợp lệ để kết xuất bài tập.');
        }

        // Call Gemini Service
        const generatedArray = await this.geminiService.generateQuizQuestions(subtitleLines);

        // Delete existing quiz if any BEFORE creating new (safe since AI succeeded)
        await this.prisma.videoQuiz.deleteMany({
            where: { videoId },
        });

        // Create new quiz
        const quiz = await this.prisma.videoQuiz.create({
            data: {
                videoId,
                title: `Bài tập: ${video.title}`,
                description: `Bài tập trắc nghiệm thông minh tự động tạo bởi Google Gemini`,
            },
        });

        // Parse AI response to question rows
        const questionsToCreate: any[] = [];
        let sequenceOrder = 0;

        for (const item of generatedArray) {
            if (!item.sentenceHanzi || !item.blankWord) continue;

            // Generate options array including the correct answer
            const options = this.shuffleArray([item.blankWord, item.option1, item.option2, item.option3].filter(Boolean));
            let blankPosition = item.sentenceHanzi.indexOf(item.blankWord);
            if (blankPosition === -1) blankPosition = 0;

            // Match back to subtitle ID if possible
            const match = video.subtitles.find(sub => sub.hanzi.includes(item.sentenceHanzi) || item.sentenceHanzi.includes(sub.hanzi));

            questionsToCreate.push({
                quizId: quiz.id,
                sentenceHanzi: item.sentenceHanzi,
                blankWord: item.blankWord,
                blankPosition,
                options,
                meaningVi: item.meaningVi,
                sequenceOrder: sequenceOrder++,
                subtitleId: match ? match.id : null,
            });
        }

        // Limit to reasonable number of questions (max 20)
        const limitedQuestions = questionsToCreate.slice(0, 20);

        // Create all questions
        if (limitedQuestions.length > 0) {
            await this.prisma.quizQuestion.createMany({
                data: limitedQuestions,
            });
        }

        // Return full quiz
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
