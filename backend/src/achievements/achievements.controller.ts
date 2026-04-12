import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AchievementsService } from './achievements.service';
import { CurrentUser } from '../auth/decorators';

@ApiTags('achievements')
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all achievements with user earned status' })
  @ApiResponse({
    status: 200,
    description: 'List of all achievements with earned status',
  })
  async getUserAchievements(@CurrentUser() user: any) {
    return this.achievementsService.getUserAchievements(user.id);
  }

  @Get('earned')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get only earned achievements for dashboard' })
  @ApiResponse({ status: 200, description: 'List of earned achievements' })
  async getEarnedAchievements(@CurrentUser() user: any) {
    return this.achievementsService.getEarnedAchievements(user.id);
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all available achievements (public)' })
  @ApiResponse({ status: 200, description: 'List of all achievements' })
  async getAllAchievements() {
    return this.achievementsService.getAllAchievements();
  }

  @Post('check')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check and award any new achievements' })
  @ApiResponse({
    status: 200,
    description: 'List of newly awarded achievements',
  })
  async checkAchievements(@CurrentUser() user: any) {
    return this.achievementsService.checkAndAwardAchievements(user.id);
  }
}
