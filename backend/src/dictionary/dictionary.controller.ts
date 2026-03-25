import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CustomDictionaryService } from './custom-dictionary.service';

@ApiTags('dictionary')
@Controller('dictionary')
export class DictionaryController {
  constructor(private readonly dictionaryService: CustomDictionaryService) {}

  @Get('lookup/:hanzi')
  @ApiOperation({
    summary:
      'Lookup a Chinese word in dictionary (uses local vocabulary database)',
  })
  @ApiQuery({
    name: 'context',
    required: false,
    description: 'Pinyin from video context to prioritize matching entries',
  })
  @ApiResponse({ status: 200, description: 'Dictionary entry for the word' })
  async lookup(
    @Param('hanzi') hanzi: string,
    @Query('context') contextPinyin?: string,
  ) {
    return this.dictionaryService.lookup(hanzi, contextPinyin);
  }

  @Get('enrich/:hanzi')
  @ApiOperation({
    summary:
      'Get enriched data for a Chinese word (DB only, no external API calls)',
  })
  @ApiResponse({ status: 200, description: 'Local DB enriched word data' })
  async enrich(@Param('hanzi') hanzi: string) {
    // DB-only enrichment for stable production behavior.
    const localData = await this.dictionaryService.getEnrichedData(hanzi);
    return {
      hanzi: localData.hanzi || hanzi,
      strokeData: undefined,
      decomposition: undefined,
      mnemonic: localData.mnemonic
        ? { visualStory: localData.mnemonic }
        : undefined,
      relatedWords: {
        synonyms: localData.synonyms || [],
        antonyms: localData.antonyms || [],
        collocations: [],
      },
      hskLevel: localData.hskLevel,
      radical: localData.radical,
      radicalMeaning: localData.radicalMeaning,
      strokeCount: localData.strokeCount,
    };
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search words by pinyin, Chinese, or Vietnamese meaning',
  })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Max results (default 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of matching dictionary entries',
  })
  async search(@Query('q') query: string, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.dictionaryService.search(query, limitNum);
  }

  @Get('examples/:hanzi')
  @ApiOperation({ summary: 'Get example sentences for a Chinese word' })
  @ApiResponse({
    status: 200,
    description: 'List of example sentences with translations',
  })
  async getExamples(@Param('hanzi') hanzi: string) {
    // Get examples from local database
    const examples = await this.dictionaryService.getExamples(hanzi);

    // Map to format expected by frontend
    return examples.map((ex) => ({
      chinese: ex.chinese,
      pinyin: ex.pinyin,
      translation: ex.vietnamese,
    }));
  }

  @Get('status')
  @ApiOperation({ summary: 'Check dictionary status' })
  @ApiResponse({ status: 200, description: 'Dictionary status' })
  async getStatus() {
    return this.dictionaryService.getStatus();
  }
}
