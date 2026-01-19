import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { QuizzesService } from './quizzes.service';
import { CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto } from './dto';
import { RolesGuard, Roles } from '../auth/guards';


@Controller('quizzes')
export class QuizzesController {
    constructor(private readonly quizzesService: QuizzesService) { }

    // Get quiz by video ID (public for users)
    @Get('video/:videoId')
    async getByVideoId(@Param('videoId') videoId: string) {
        return this.quizzesService.findByVideoId(videoId);
    }

    // Get quiz by ID
    @Get(':id')
    async getOne(@Param('id') id: string) {
        return this.quizzesService.findOne(id);
    }

    // Create quiz manually (Admin only)
    @Post()
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    async create(@Body() dto: CreateQuizDto) {
        return this.quizzesService.create(dto);
    }

    // Auto-generate quiz from video subtitles (Admin only)
    @Post('generate/:videoId')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    async generate(@Param('videoId') videoId: string) {
        return this.quizzesService.generateFromSubtitles(videoId);
    }

    // Update quiz (Admin only)
    @Put(':id')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    async update(@Param('id') id: string, @Body() dto: UpdateQuizDto) {
        return this.quizzesService.update(id, dto);
    }

    // Publish quiz (Admin only)
    @Post(':id/publish')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    async publish(@Param('id') id: string) {
        return this.quizzesService.publish(id);
    }

    // Delete quiz (Admin only)
    @Delete(':id')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    async remove(@Param('id') id: string) {
        return this.quizzesService.remove(id);
    }

    // Add question to quiz (Admin only)
    @Post(':quizId/questions')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    async addQuestion(
        @Param('quizId') quizId: string,
        @Body() dto: CreateQuestionDto,
    ) {
        return this.quizzesService.addQuestion(quizId, dto);
    }

    // Update question (Admin only)
    @Put('questions/:questionId')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    async updateQuestion(
        @Param('questionId') questionId: string,
        @Body() dto: UpdateQuestionDto,
    ) {
        return this.quizzesService.updateQuestion(questionId, dto);
    }

    // Delete question (Admin only)
    @Delete('questions/:questionId')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    async removeQuestion(@Param('questionId') questionId: string) {
        return this.quizzesService.removeQuestion(questionId);
    }
}
