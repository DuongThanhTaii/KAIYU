import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { VideoNotesService } from './video-notes.service';
import { CurrentUser } from '../auth/decorators';

@ApiTags('video-notes')
@Controller('video-notes')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class VideoNotesController {
    constructor(private readonly videoNotesService: VideoNotesService) { }

    @Get(':videoId')
    @ApiOperation({ summary: 'Get all notes for a video' })
    @ApiResponse({ status: 200, description: 'List of notes for the video' })
    async findByVideoId(
        @CurrentUser() user: any,
        @Param('videoId') videoId: string,
    ) {
        return this.videoNotesService.findByVideoId(user.id, videoId);
    }

    @Post()
    @ApiOperation({ summary: 'Create a new note' })
    @ApiResponse({ status: 201, description: 'Note created' })
    async create(
        @CurrentUser() user: any,
        @Body() body: { videoId: string; timestampSec: number; content: string },
    ) {
        return this.videoNotesService.create(user.id, body);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update a note' })
    @ApiResponse({ status: 200, description: 'Note updated' })
    async update(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() body: { content?: string; timestampSec?: number },
    ) {
        return this.videoNotesService.update(user.id, id, body);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a note' })
    @ApiResponse({ status: 200, description: 'Note deleted' })
    async remove(
        @CurrentUser() user: any,
        @Param('id') id: string,
    ) {
        return this.videoNotesService.remove(user.id, id);
    }
}
