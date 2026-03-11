import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Query,
    Body,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiQuery,
    ApiBody,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { VocabularyService } from './vocabulary.service';
import { VocabularyExamplesService } from './vocabulary-examples.service';
import {
    CreateVocabularyDto,
    UpdateVocabularyDto,
    ImportVocabularyItemDto,
    ImportRequestDto,
    ImportResultDto,
} from './dto';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth';


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

    @Get('search')
    @ApiOperation({ summary: 'Search vocabulary by query' })
    @ApiResponse({ status: 200, description: 'Return matching vocabulary' })
    @ApiQuery({ name: 'q', required: true, description: 'Search term' })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async search(
        @Query('q') q: string,
        @Query('limit') limit?: number,
    ) {
        if (!q) return [];
        return this.vocabularyService.searchAll(q, limit ? Number(limit) : 20);
    }

    @Get('lookup/:input')
    @ApiOperation({ summary: 'Smart lookup - find by hanzi, breakdown characters, or fuzzy search' })
    @ApiResponse({ status: 200, description: 'Lookup results' })
    async smartLookup(@Param('input') input: string) {
        return this.vocabularyService.smartLookup(input);
    }

    @Get('count')
    @ApiOperation({ summary: 'Get total vocabulary count' })
    @ApiResponse({ status: 200, description: 'Total count' })
    async getTotalCount() {
        const count = await this.vocabularyService.getTotalCount();
        return { count };
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

    // ============================================
    // ADMIN ENDPOINTS (Protected)
    // ============================================

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: '[Admin] Create new vocabulary' })
    @ApiBody({ type: CreateVocabularyDto })
    @ApiResponse({ status: 201, description: 'Vocabulary created' })
    @ApiResponse({ status: 409, description: 'Vocabulary with this hanzi already exists' })
    async create(@Body() data: CreateVocabularyDto) {
        return this.vocabularyService.create(data);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: '[Admin] Update vocabulary' })
    @ApiBody({ type: UpdateVocabularyDto })
    @ApiResponse({ status: 200, description: 'Vocabulary updated' })
    @ApiResponse({ status: 404, description: 'Vocabulary not found' })
    async update(@Param('id') id: string, @Body() data: UpdateVocabularyDto) {
        return this.vocabularyService.update(id, data);
    }

    @Delete('all')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete all vocabulary (admin only, for re-import)' })
    @ApiResponse({ status: 200, description: 'All vocabulary deleted' })
    async deleteAll() {
        const count = await this.vocabularyService.deleteAll();
        return { message: `Đã xóa ${count} từ vựng`, deleted: count };
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: '[Admin] Delete vocabulary' })
    @ApiResponse({ status: 200, description: 'Vocabulary deleted' })
    @ApiResponse({ status: 404, description: 'Vocabulary not found' })
    async remove(@Param('id') id: string) {
        return this.vocabularyService.remove(id);
    }

    @Post('validate-import')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: '[Admin] Validate vocabulary data before import to check for duplicates' })
    @ApiBody({
        description: 'Array of vocabulary items',
        type: [ImportVocabularyItemDto]
    })
    @ApiResponse({ status: 200, description: 'Validation result with duplicates' })
    async validateImport(@Body() items: ImportVocabularyItemDto[]) {
        return this.vocabularyService.validateImport(items);
    }

    @Post('import')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: '[Admin] Import vocabulary from XLSX/CSV data with conflict resolution' })
    @ApiBody({
        description: 'Import request with items and duplicate action',
        type: ImportRequestDto
    })
    @ApiResponse({ status: 201, description: 'Import result', type: ImportResultDto })
    async importVocabulary(@Body() request: ImportRequestDto) {
        return this.vocabularyService.importVocabulary(request);
    }

    @Post('bulk-update')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: '[Admin] Bulk update existing vocabulary from XLSX/CSV data' })
    @ApiBody({
        description: 'Array of vocabulary items to update (only existing items will be updated)',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                required: ['hanzi'],
                properties: {
                    hanzi: { type: 'string', example: '好', description: 'Required - used to find existing vocabulary' },
                    pinyin: { type: 'string', example: 'hǎo' },
                    meaningVi: { type: 'string', example: 'tốt, thích' },
                    meaningEn: { type: 'string', example: 'good, to like' },
                    partOfSpeech: { type: 'string', example: 'adj,verb' },
                    hskLevel: { type: 'number', example: 1 },
                    radical: { type: 'string', example: '女' },
                    strokeCount: { type: 'number', example: 6 },
                    mnemonic: { type: 'string', example: 'Gợi ý nhớ' },
                },
            },
        },
    })
    @ApiResponse({
        status: 200,
        description: 'Bulk update result',
        schema: {
            type: 'object',
            properties: {
                updated: { type: 'number', description: 'Number of updated items' },
                skipped: { type: 'number', description: 'Number of skipped items (not found)' },
                errors: { type: 'number', description: 'Number of errors' },
            },
        },
    })
    async bulkUpdateVocabulary(@Body() items: ImportVocabularyItemDto[]) {
        return this.vocabularyService.bulkUpdateVocabulary(items);
    }

}
