import { Controller, Get, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SavedVideosService } from './saved-videos.service';
import { CurrentUser } from '../auth/decorators';

@Controller('saved-videos')
@UseGuards(AuthGuard('jwt'))
export class SavedVideosController {
    constructor(private savedVideosService: SavedVideosService) { }

    @Get()
    async getSavedVideos(@CurrentUser() user: { id: string }) {
        return this.savedVideosService.getSavedVideos(user.id);
    }

    @Get('ids')
    async getSavedVideoIds(@CurrentUser() user: { id: string }) {
        return this.savedVideosService.getSavedVideoIds(user.id);
    }

    @Get(':videoId/check')
    async checkSaved(
        @CurrentUser() user: { id: string },
        @Param('videoId') videoId: string,
    ) {
        const isSaved = await this.savedVideosService.isVideoSaved(user.id, videoId);
        return { isSaved };
    }

    @Post(':videoId')
    async saveVideo(
        @CurrentUser() user: { id: string },
        @Param('videoId') videoId: string,
    ) {
        return this.savedVideosService.saveVideo(user.id, videoId);
    }

    @Delete(':videoId')
    async unsaveVideo(
        @CurrentUser() user: { id: string },
        @Param('videoId') videoId: string,
    ) {
        return this.savedVideosService.unsaveVideo(user.id, videoId);
    }
}
