import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { VocabularyService } from './vocabulary.service';
import { VocabularyExamplesService } from './vocabulary-examples.service';

@ApiTags('vocabulary')
@Controller('vocabulary')
export class VocabularyController {
    constructor(
        private readonly vocabularyService: VocabularyService,
        private readonly examplesService: VocabularyExamplesService,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Get vocabulary list' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'hskLevel', required: false, type: Number })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'partOfSpeech', required: false, type: String })
    @ApiResponse({ status: 200, description: 'List of vocabulary with pagination' })
    async findAll(
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('hskLevel') hskLevel?: number,
        @Query('search') search?: string,
        @Query('partOfSpeech') partOfSpeech?: string,
    ) {
        return this.vocabularyService.findAll({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            hskLevel: hskLevel ? Number(hskLevel) : undefined,
            search,
            partOfSpeech,
        });
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get vocabulary count by HSK level' })
    @ApiResponse({ status: 200, description: 'HSK level statistics' })
    async getStats() {
        return this.vocabularyService.getHskLevelStats();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get vocabulary by ID' })
    @ApiResponse({ status: 200, description: 'Vocabulary details' })
    @ApiResponse({ status: 404, description: 'Vocabulary not found' })
    async findOne(@Param('id') id: string) {
        return this.vocabularyService.findOne(id);
    }

    @Get(':id/examples')
    @ApiOperation({ summary: 'Get example sentences for vocabulary' })
    @ApiResponse({ status: 200, description: 'Example sentences (from cache or AI-generated)' })
    async getExamples(@Param('id') id: string) {
        return this.examplesService.getExamples(id);
    }

    @Get('hanzi/:hanzi')
    @ApiOperation({ summary: 'Get vocabulary by hanzi' })
    @ApiResponse({ status: 200, description: 'Vocabulary details' })
    @ApiResponse({ status: 404, description: 'Vocabulary not found' })
    async findByHanzi(@Param('hanzi') hanzi: string) {
        return this.vocabularyService.findByHanzi(hanzi);
    }
}

