import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
} from '@nestjs/common';
import { ScenesService } from './scenes.service';
import { AiSceneService } from './ai-scene.service';
import { SceneAnalyticsService } from './scene-analytics.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

interface GenerateSceneDto {
    templateId: string;
    vocabSlots: {
        [key: string]: {
            hanzi: string;
            pinyin: string;
            meaningVi: string;
        };
    };
}

interface GenerateAiSceneDto {
    scenarioType: string;
    vocabularyToUse: {
        hanzi: string;
        pinyin: string;
        meaningVi: string;
    }[];
    hskLevel: number;
}

interface SaveHistoryDto {
    templateId: string;
    sceneId?: string;
    score: number;
    choicesMade: object;
    vocabUsed: string[];
}

@ApiTags('Scenes')
@Controller('scenes')
export class ScenesController {
    constructor(
        private readonly scenesService: ScenesService,
        private readonly aiSceneService: AiSceneService,
        private readonly analyticsService: SceneAnalyticsService,
    ) { }

    /**
     * Get all scene templates
     */
    @Get('templates')
    @ApiOperation({ summary: 'Get all scene templates' })
    async getTemplates(@Query('hskLevel') hskLevel?: string) {
        return this.scenesService.getTemplates(
            hskLevel ? parseInt(hskLevel, 10) : undefined,
        );
    }

    /**
     * Get a specific template
     */
    @Get('templates/:id')
    @ApiOperation({ summary: 'Get a specific template by ID' })
    async getTemplate(@Param('id') id: string) {
        return this.scenesService.getTemplateById(id);
    }

    /**
     * Generate a scene with vocabulary injection (from template)
     */
    @Post('generate')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Generate a scene with injected vocabulary' })
    async generateScene(
        @Body() dto: GenerateSceneDto,
        @Request() req: any,
    ) {
        return this.scenesService.generateScene(
            dto.templateId,
            dto.vocabSlots,
            req.user?.userId,
        );
    }

    /**
     * Generate a custom AI scene using Gemini
     */
    @Post('generate-ai')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Generate a custom scene using Gemini AI' })
    async generateAiScene(
        @Body() dto: GenerateAiSceneDto,
        @Request() req: any,
    ) {
        const userId = req.user.userId;

        // Check for cached scene first
        const cached = await this.aiSceneService.getCachedScene(dto.vocabularyToUse);
        if (cached) {
            return { dialogFlow: cached, cached: true };
        }

        // Generate new scene with AI
        const dialogFlow = await this.aiSceneService.generateScene({
            scenarioType: dto.scenarioType,
            vocabularyToUse: dto.vocabularyToUse,
            hskLevel: dto.hskLevel,
            userId,
        });

        // Save to database
        const scene = await this.aiSceneService.saveGeneratedScene(
            dialogFlow,
            dto.vocabularyToUse,
            userId,
        );

        return { dialogFlow, sceneId: scene.id, cached: false };
    }

    /**
     * Check AI generation rate limit
     */
    @Get('rate-limit')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Check AI scene generation rate limit' })
    async checkRateLimit(@Request() req: any) {
        return this.aiSceneService.checkRateLimit(req.user.userId);
    }

    /**
     * Save scene completion history
     */
    @Post('history')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Save scene completion history' })
    async saveHistory(
        @Body() dto: SaveHistoryDto,
        @Request() req: any,
    ) {
        return this.scenesService.saveHistory(
            req.user.userId,
            dto.templateId,
            dto.sceneId || null,
            dto.score,
            dto.choicesMade,
            dto.vocabUsed,
        );
    }

    /**
     * Get user's scene history
     */
    @Get('history')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: "Get user's scene history" })
    async getHistory(
        @Request() req: any,
        @Query('limit') limit?: string,
    ) {
        return this.scenesService.getUserHistory(
            req.user.userId,
            limit ? parseInt(limit, 10) : 20,
        );
    }

    /**
     * Get user's scene stats
     */
    @Get('stats')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: "Get user's scene statistics" })
    async getStats(@Request() req: any) {
        return this.scenesService.getUserStats(req.user.userId);
    }

    /**
     * Get random vocabulary from user's notebook for AI scene generation
     */
    @Get('vocab-suggestions')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get random vocabulary for scene generation' })
    async getVocabSuggestions(
        @Request() req: any,
        @Query('count') count?: string,
    ) {
        return this.scenesService.getRandomVocabForScene(
            req.user.userId,
            count ? parseInt(count, 10) : 3,
        );
    }

    /**
     * Get vocabulary suggestions based on scenario type
     */
    @Get('vocab-suggestions/:scenarioType')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get vocabulary suggestions for a specific scenario' })
    async getVocabSuggestionsForScenario(
        @Request() req: any,
        @Param('scenarioType') scenarioType: string,
        @Query('count') count?: string,
    ) {
        return this.scenesService.getVocabSuggestionsForScenario(
            req.user.userId,
            scenarioType,
            count ? parseInt(count, 10) : 5,
        );
    }

    /**
     * Get trending/popular scenes
     */
    @Get('trending')
    @ApiOperation({ summary: 'Get trending scenes' })
    async getTrendingScenes(@Query('limit') limit?: string) {
        return this.analyticsService.getTrendingScenes(
            limit ? parseInt(limit, 10) : 10,
        );
    }

    /**
     * Get public/shared scenes
     */
    @Get('public')
    @ApiOperation({ summary: 'Get public shared scenes' })
    async getPublicScenes(@Query('limit') limit?: string) {
        return this.analyticsService.getPublicScenes(
            limit ? parseInt(limit, 10) : 20,
        );
    }

    /**
     * Share a scene (make it public)
     */
    @Post('share/:id')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Share a scene publicly' })
    async shareScene(
        @Param('id') id: string,
        @Body() body: { title: string },
        @Request() req: any,
    ) {
        return this.analyticsService.shareScene(id, req.user.userId, body.title);
    }

    /**
     * Like a shared scene
     */
    @Post('like/:id')
    @ApiOperation({ summary: 'Like a shared scene' })
    async likeScene(@Param('id') id: string) {
        return this.analyticsService.likeScene(id);
    }

    /**
     * Get popular vocab combinations
     */
    @Get('popular-combos')
    @ApiOperation({ summary: 'Get popular vocabulary combinations' })
    async getPopularVocabCombos(@Query('limit') limit?: string) {
        return this.analyticsService.getPopularVocabCombos(
            limit ? parseInt(limit, 10) : 10,
        );
    }
}


