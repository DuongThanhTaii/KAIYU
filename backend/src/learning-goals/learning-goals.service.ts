import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SaveGoalsDto {
  hskLevel?: number;
  dailyGoalMinutes?: number;
  interests?: string[];
}

@Injectable()
export class LearningGoalsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Save user's learning goals from onboarding
   */
  async saveGoals(userId: string, data: SaveGoalsDto) {
    // Update user profile with HSK level and daily goal
    const updateData: any = {};
    if (data.hskLevel !== undefined) {
      updateData.hskLevel = data.hskLevel;
    }
    if (data.dailyGoalMinutes !== undefined) {
      updateData.dailyGoalMinutes = data.dailyGoalMinutes;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }

    // Save interests as learning goals
    if (data.interests && data.interests.length > 0) {
      // Delete existing interest goals
      await this.prisma.learningGoal.deleteMany({
        where: {
          userId,
          goalType: 'interest',
        },
      });

      // Create new interest goals
      await this.prisma.learningGoal.createMany({
        data: data.interests.map((interest) => ({
          userId,
          goalType: 'interest',
          goalValue: interest,
        })),
      });
    }

    return { message: 'Goals saved successfully' };
  }

  /**
   * Get user's learning goals
   */
  async getGoals(userId: string) {
    const [user, goals] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          hskLevel: true,
          dailyGoalMinutes: true,
        },
      }),
      this.prisma.learningGoal.findMany({
        where: { userId },
        select: {
          goalType: true,
          goalValue: true,
        },
      }),
    ]);

    const interests = goals
      .filter((g) => g.goalType === 'interest')
      .map((g) => g.goalValue);

    return {
      hskLevel: user?.hskLevel || 1,
      dailyGoalMinutes: user?.dailyGoalMinutes || 30,
      interests,
    };
  }
}
