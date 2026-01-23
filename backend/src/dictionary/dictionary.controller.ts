import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CustomDictionaryService } from './custom-dictionary.service';
import { WordEnrichmentService } from './word-enrichment.service';

@ApiTags('dictionary')
@Controller('dictionary')
export class DictionaryController {
    constructor(
        private readonly dictionaryService: CustomDictionaryService,
        private readonly enrichmentService: WordEnrichmentService,
    ) { }

    @Get('lookup/:hanzi')
    @ApiOperation({ summary: 'Lookup a Chinese word in dictionary (uses local vocabulary database)' })
    @ApiQuery({ name: 'context', required: false, description: 'Pinyin from video context to prioritize matching entries' })
    @ApiResponse({ status: 200, description: 'Dictionary entry for the word' })
    async lookup(
        @Param('hanzi') hanzi: string,
        @Query('context') contextPinyin?: string,
    ) {
        return this.dictionaryService.lookup(hanzi, contextPinyin);
    }

    @Get('enrich/:hanzi')
    @ApiOperation({ summary: 'Get enriched data for a Chinese word (stroke data from HanziWriter, local data for synonyms/antonyms)' })
    @ApiResponse({ status: 200, description: 'Enriched word data including stroke animation, mnemonics, and related words' })
    @ApiQuery({ name: 'pinyin', required: false, description: 'Pinyin of the word for better context' })
    @ApiQuery({ name: 'meaning', required: false, description: 'Meaning of the word for better context' })
    async enrich(
        @Param('hanzi') hanzi: string,
        @Query('pinyin') pinyin?: string,
        @Query('meaning') meaning?: string,
    ) {
        // If pinyin/meaning not provided, look them up first from local DB
        let p = pinyin;
        let m = meaning;

        if (!p || !m) {
            const lookup = await this.dictionaryService.lookup(hanzi);
            if (lookup.found) {
                p = p || lookup.pinyin;
                m = m || lookup.meaningVi || lookup.meaningEn;
            }
        }

        // Get local enriched data (synonyms, antonyms, mnemonic)
        const localData = await this.dictionaryService.getEnrichedData(hanzi);

        // Get stroke data from external service (HanziWriter CDN)
        const strokeData = await this.enrichmentService.getEnrichedData(hanzi, p, m);

        // Merge local data with stroke data
        return {
            hanzi,
            strokeData: strokeData.strokeData,
            decomposition: strokeData.decomposition,
            mnemonic: localData.mnemonic ? { visualStory: localData.mnemonic } : strokeData.mnemonic,
            relatedWords: {
                synonyms: localData.synonyms || [],
                antonyms: localData.antonyms || [],
                collocations: strokeData.relatedWords?.collocations || [],
            },
            hskLevel: localData.hskLevel,
            radical: localData.radical,
            radicalMeaning: localData.radicalMeaning,
            strokeCount: localData.strokeCount,
        };
    }

    @Get('search')
    @ApiOperation({ summary: 'Search words by pinyin, Chinese, or Vietnamese meaning' })
    @ApiQuery({ name: 'q', required: true, description: 'Search query' })
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
        // Get examples from local database
        const examples = await this.dictionaryService.getExamples(hanzi);

        // Map to format expected by frontend
        return examples.map(ex => ({
            chinese: ex.chinese,
            pinyin: ex.pinyin,
            translation: ex.vietnamese
        }));
    }

    @Get('status')
    @ApiOperation({ summary: 'Check dictionary status' })
    @ApiResponse({ status: 200, description: 'Dictionary status' })
    async getStatus() {
        return this.dictionaryService.getStatus();
    }
}
