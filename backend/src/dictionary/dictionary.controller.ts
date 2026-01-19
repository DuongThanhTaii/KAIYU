import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { DictionaryService } from './dictionary.service';
import { WordEnrichmentService } from './word-enrichment.service';
import { VocabularyExamplesService } from '../vocabulary/vocabulary-examples.service';

@ApiTags('dictionary')
@Controller('dictionary')
export class DictionaryController {
    constructor(
        private readonly dictionaryService: DictionaryService,
        private readonly enrichmentService: WordEnrichmentService,
        private readonly examplesService: VocabularyExamplesService,
    ) { }

    @Get('lookup/:hanzi')
    @ApiOperation({ summary: 'Lookup a Chinese word in dictionary' })
    @ApiQuery({ name: 'context', required: false, description: 'Pinyin from video context to prioritize matching entries' })
    @ApiResponse({ status: 200, description: 'Dictionary entry for the word' })
    async lookup(
        @Param('hanzi') hanzi: string,
        @Query('context') contextPinyin?: string,
    ) {
        return this.dictionaryService.lookup(hanzi, contextPinyin);
    }

    @Get('enrich/:hanzi')
    @ApiOperation({ summary: 'Get enriched data for a Chinese word (stroke, mnemonic, related words)' })
    @ApiResponse({ status: 200, description: 'Enriched word data including stroke animation, mnemonics, and related words' })
    @ApiQuery({ name: 'pinyin', required: false, description: 'Pinyin of the word for better context' })
    @ApiQuery({ name: 'meaning', required: false, description: 'Meaning of the word for better context' })
    async enrich(
        @Param('hanzi') hanzi: string,
        @Query('pinyin') pinyin?: string,
        @Query('meaning') meaning?: string,
    ) {
        // If pinyin/meaning not provided, look them up first
        let p = pinyin;
        let m = meaning;

        if (!p || !m) {
            const lookup = await this.dictionaryService.lookup(hanzi);
            if (lookup.found) {
                p = p || lookup.pinyin;
                m = m || lookup.meaningVi || lookup.meaningEn;
            }
        }

        return this.enrichmentService.getEnrichedData(hanzi, p, m);
    }

    @Get('search')
    @ApiOperation({ summary: 'Search words by pinyin or Chinese' })
    @ApiQuery({ name: 'q', required: true, description: 'Search query (pinyin or Chinese)' })
    @ApiQuery({ name: 'limit', required: false, description: 'Max results (default 20)' })
    @ApiResponse({ status: 200, description: 'List of matching dictionary entries' })
    async search(
        @Query('q') query: string,
        @Query('limit') limit?: string,
    ) {
        const limitNum = limit ? parseInt(limit, 10) : 20;
        return this.dictionaryService.search(query, limitNum);
    }

    @Get('examples/:hanzi')
    @ApiOperation({ summary: 'Get example sentences for a Chinese word' })
    @ApiResponse({ status: 200, description: 'List of example sentences with translations' })
    async getExamples(@Param('hanzi') hanzi: string) {
        // First lookup to get context (pinyin/meaning)
        const lookup = await this.dictionaryService.lookup(hanzi);

        // Use AI service to get/generate examples
        const examples = await this.examplesService.getExamplesByHanzi(
            hanzi,
            lookup.found ? lookup.pinyin : undefined,
            lookup.found ? (lookup.meaningVi || lookup.meaningEn) : undefined
        );

        // Map to format expected by dictionaryApi
        return examples.map(ex => ({
            chinese: ex.hanzi,
            pinyin: ex.pinyin,
            translation: ex.meaningVi
        }));
    }

    @Get('status')
    @ApiOperation({ summary: 'Check if dictionary is loaded' })
    @ApiResponse({ status: 200, description: 'Dictionary status' })
    getStatus() {
        return {
            loaded: this.dictionaryService.isDictionaryLoaded(),
        };
    }
}

