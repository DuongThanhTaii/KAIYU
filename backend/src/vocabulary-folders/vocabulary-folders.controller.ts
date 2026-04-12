import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { VocabularyFoldersService } from './vocabulary-folders.service';

@ApiTags('vocabulary-folders')
@Controller('vocabulary-folders')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class VocabularyFoldersController {
  constructor(private readonly foldersService: VocabularyFoldersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all vocabulary folders for current user' })
  @ApiResponse({ status: 200, description: 'List of folders' })
  async findAll(@Request() req: any) {
    return this.foldersService.findAllByUser(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new vocabulary folder' })
  @ApiResponse({ status: 201, description: 'Folder created' })
  async create(
    @Request() req: any,
    @Body() body: { name: string; color?: string; icon?: string },
  ) {
    try {
      return await this.foldersService.create(req.user.id, body);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('default')
  @ApiOperation({ summary: 'Get or create default folder' })
  @ApiResponse({ status: 200, description: 'Default folder' })
  async getDefault(@Request() req: any) {
    return this.foldersService.getOrCreateDefaultFolder(req.user.id);
  }

  @Get(':id/vocabulary')
  @ApiOperation({ summary: 'Get vocabulary in a folder' })
  @ApiResponse({ status: 200, description: 'List of vocabulary in folder' })
  async getVocabulary(@Request() req: any, @Param('id') id: string) {
    const folderId = id === 'uncategorized' ? null : id;
    return this.foldersService.getVocabularyByFolder(req.user.id, folderId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a folder' })
  @ApiResponse({ status: 200, description: 'Folder updated' })
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; color?: string; icon?: string },
  ) {
    try {
      return await this.foldersService.update(id, req.user.id, body);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a folder' })
  @ApiResponse({ status: 200, description: 'Folder deleted' })
  async delete(@Request() req: any, @Param('id') id: string) {
    try {
      return await this.foldersService.delete(id, req.user.id);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('vocabulary/:vocabId/move')
  @ApiOperation({ summary: 'Move vocabulary to a folder' })
  @ApiQuery({
    name: 'folderId',
    required: false,
    description: 'Target folder ID (null to uncategorize)',
  })
  @ApiResponse({ status: 200, description: 'Vocabulary moved' })
  async moveVocabulary(
    @Request() req: any,
    @Param('vocabId') vocabId: string,
    @Query('folderId') folderId?: string,
  ) {
    try {
      return await this.foldersService.moveVocabularyToFolder(
        req.user.id,
        vocabId,
        folderId || null,
      );
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
