import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LearningGoalsService } from './learning-goals.service';
import type { SaveGoalsDto } from './learning-goals.service';
import { CurrentUser } from '../auth/decorators';

@ApiTags('learning-goals')
@Controller('learning-goals')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class LearningGoalsController {
  constructor(private readonly learningGoalsService: LearningGoalsService) {}

  @Post()
  @ApiOperation({ summary: 'Save learning goals from onboarding' })
  @ApiResponse({ status: 200, description: 'Goals saved successfully' })
  async saveGoals(@CurrentUser() user: any, @Body() data: SaveGoalsDto) {
    return this.learningGoalsService.saveGoals(user.id, data);
  }

  @Get()
  @ApiOperation({ summary: 'Get user learning goals' })
  @ApiResponse({ status: 200, description: 'User learning goals' })
  async getGoals(@CurrentUser() user: any) {
    return this.learningGoalsService.getGoals(user.id);
  }
}
