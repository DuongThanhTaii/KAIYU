import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FlashcardsService, SRSRating } from './flashcards.service';
import { CurrentUser } from '../auth/decorators';

@ApiTags('flashcards')
@Controller('flashcards')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class FlashcardsController {
    constructor(private readonly flashcardsService: FlashcardsService) { }

    @Get('queue')
    @ApiOperation({ summary: 'Get flashcard review queue for today' })
    @ApiResponse({ status: 200, description: 'List of due flashcards' })
    async getQueue(@CurrentUser() user: any) {
        return this.flashcardsService.getQueue(user.id);
    }

    @Post(':id/review')
    @ApiOperation({ summary: 'Submit flashcard review rating' })
    @ApiResponse({ status: 200, description: 'Review submitted successfully' })
    @ApiResponse({ status: 404, description: 'Flashcard not found' })
    async submitReview(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() body: { rating: SRSRating },
    ) {
        return this.flashcardsService.submitReview(user.id, id, body.rating);
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get flashcard review statistics' })
    @ApiResponse({ status: 200, description: 'Review statistics' })
    async getStats(@CurrentUser() user: any) {
        return this.flashcardsService.getStats(user.id);
    }

    @Get('by-level')
    @ApiOperation({ summary: 'Get vocabulary by proficiency level (1-5)' })
    @ApiQuery({ name: 'level', required: false, type: Number, description: 'Filter by level 1-5' })
    @ApiResponse({ status: 200, description: 'Vocabulary cards with level info' })
    async getByLevel(
        @CurrentUser() user: any,
        @Query('level') level?: string,
    ) {
        const levelNum = level ? parseInt(level, 10) : undefined;
        return this.flashcardsService.getByLevel(user.id, levelNum);
    }

    @Get('stats/by-level')
    @ApiOperation({ summary: 'Get statistics grouped by proficiency level (1-5)' })
    @ApiResponse({ status: 200, description: 'Level-based statistics' })
    async getStatsByLevel(@CurrentUser() user: any) {
        return this.flashcardsService.getStatsByLevel(user.id);
    }

    @Get('recently-added')
    @ApiOperation({ summary: 'Get recently added vocabulary for quick review' })
    @ApiQuery({ name: 'videoId', required: false, description: 'Filter by video ID' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit results (default 10)' })
    @ApiResponse({ status: 200, description: 'Recently added vocabulary list' })
    async getRecentlyAdded(
        @CurrentUser() user: any,
        @Query('videoId') videoId?: string,
        @Query('limit') limit?: string,
    ) {
        return this.flashcardsService.getRecentlyAdded(user.id, {
            videoId,
            limit: limit ? parseInt(limit, 10) : undefined,
        });
    }
}
