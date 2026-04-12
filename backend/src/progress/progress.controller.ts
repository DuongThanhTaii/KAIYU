import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProgressService } from './progress.service';
import { CurrentUser } from '../auth/decorators';

@ApiTags('progress')
@Controller('progress')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('videos')
  @ApiOperation({ summary: 'Get all video progress' })
  @ApiResponse({ status: 200, description: 'List of video progress' })
  async getVideoProgress(@CurrentUser() user: any) {
    return this.progressService.getVideoProgress(user.id);
  }

  @Put('videos/:videoId')
  @ApiOperation({ summary: 'Update video progress' })
  @ApiResponse({ status: 200, description: 'Progress updated' })
  async updateVideoProgress(
    @CurrentUser() user: any,
    @Param('videoId') videoId: string,
    @Body() body: { progressPercent: number; lastPositionSeconds: number },
  ) {
    return this.progressService.updateVideoProgress(user.id, videoId, body);
  }

  @Get('daily')
  @ApiOperation({ summary: 'Get daily learning progress' })
  @ApiResponse({ status: 200, description: 'Daily progress stats' })
  async getDailyProgress(@CurrentUser() user: any) {
    return this.progressService.getDailyProgress(user.id);
  }

  @Get('weekly')
  @ApiOperation({ summary: 'Get weekly learning progress' })
  @ApiResponse({ status: 200, description: 'Weekly progress stats' })
  async getWeeklyProgress(@CurrentUser() user: any) {
    return this.progressService.getWeeklyProgress(user.id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get overall learning statistics' })
  @ApiResponse({ status: 200, description: 'Overall stats' })
  async getOverallStats(@CurrentUser() user: any) {
    return this.progressService.getOverallStats(user.id);
  }
}
