import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UserVocabularyService } from './user-vocabulary.service';
import { CurrentUser } from '../auth/decorators';

@ApiTags('user-vocabulary')
@Controller('user-vocabulary')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class UserVocabularyController {
  constructor(private readonly userVocabularyService: UserVocabularyService) {}

  @Get()
  @ApiOperation({ summary: 'Get user saved vocabulary' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'proficiency', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sourceVideoId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of saved vocabulary' })
  async findAll(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('proficiency') proficiency?: string,
    @Query('search') search?: string,
    @Query('sourceVideoId') sourceVideoId?: string,
  ) {
    return this.userVocabularyService.findAll(user.id, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      proficiency,
      search,
      sourceVideoId,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user vocabulary statistics' })
  @ApiResponse({ status: 200, description: 'Vocabulary statistics' })
  async getStats(@CurrentUser() user: any) {
    return this.userVocabularyService.getStats(user.id);
  }

  @Get('check')
  @ApiOperation({
    summary: 'Check whether a word is already saved by current user',
  })
  @ApiQuery({ name: 'hanzi', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Saved status for the word' })
  async checkSavedWord(
    @CurrentUser() user: any,
    @Query('hanzi') hanzi: string,
  ) {
    return this.userVocabularyService.checkSavedWord(user.id, hanzi);
  }

  @Post('check-batch')
  @ApiOperation({ summary: 'Check saved status for multiple words' })
  @ApiResponse({ status: 200, description: 'Batch saved status result' })
  async checkSavedWordsBatch(
    @CurrentUser() user: any,
    @Body() body: { hanziList: string[] },
  ) {
    return this.userVocabularyService.checkSavedWordsBatch(
      user.id,
      body?.hanziList || [],
    );
  }

  @Post()
  @ApiOperation({ summary: 'Save a vocabulary word' })
  @ApiResponse({ status: 201, description: 'Vocabulary saved' })
  @ApiResponse({ status: 409, description: 'Already saved' })
  async saveVocabulary(
    @CurrentUser() user: any,
    @Body()
    body: { vocabularyId: string; sourceVideoId?: string; folderId?: string },
  ) {
    return this.userVocabularyService.saveVocabulary(user.id, body);
  }

  @Post('word')
  @ApiOperation({
    summary:
      'Save a word from dictionary lookup (creates vocabulary if needed)',
  })
  @ApiResponse({ status: 201, description: 'Word saved' })
  @ApiResponse({ status: 409, description: 'Already saved' })
  async saveWord(
    @CurrentUser() user: any,
    @Body()
    body: {
      hanzi: string;
      pinyin?: string;
      meaningVi?: string;
      sourceVideoId?: string;
      folderId?: string;
    },
  ) {
    return this.userVocabularyService.saveWord(user.id, body);
  }

  @Put(':id/proficiency')
  @ApiOperation({ summary: 'Update vocabulary proficiency' })
  @ApiResponse({ status: 200, description: 'Proficiency updated' })
  async updateProficiency(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { proficiency: string; proficiencyPercent: number },
  ) {
    return this.userVocabularyService.updateProficiency(user.id, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove vocabulary from collection' })
  @ApiResponse({ status: 200, description: 'Vocabulary removed' })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.userVocabularyService.remove(user.id, id);
  }
}
