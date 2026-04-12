import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import * as cron from 'node-cron';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private tasks: cron.ScheduledTask[] = [];

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  onModuleInit() {
    this.logger.log('Initializing scheduled tasks...');
    this.scheduleAllTasks();
  }

  onModuleDestroy() {
    this.logger.log('Stopping scheduled tasks...');
    this.tasks.forEach((task) => task.stop());
  }

  private scheduleAllTasks() {
    // Daily reminder check at 8 PM (20:00)
    this.tasks.push(
      cron.schedule(
        '0 20 * * *',
        () => {
          this.checkStreakBreakReminders();
        },
        { timezone: 'Asia/Ho_Chi_Minh' },
      ),
    );

    // Check inactive users at 10 AM
    this.tasks.push(
      cron.schedule(
        '0 10 * * *',
        () => {
          this.checkInactiveUsers();
        },
        { timezone: 'Asia/Ho_Chi_Minh' },
      ),
    );

    // Send weekly reports every Sunday at 9 AM
    this.tasks.push(
      cron.schedule(
        '0 9 * * 0',
        () => {
          this.sendWeeklyReports();
        },
        { timezone: 'Asia/Ho_Chi_Minh' },
      ),
    );

    // Check vocabulary due reminders at 7 PM
    this.tasks.push(
      cron.schedule(
        '0 19 * * *',
        () => {
          this.checkVocabDueReminders();
        },
        { timezone: 'Asia/Ho_Chi_Minh' },
      ),
    );

    this.logger.log(`Scheduled ${this.tasks.length} tasks`);
  }

  /**
   * Check users who are about to break their streak and send reminders
   */
  async checkStreakBreakReminders() {
    this.logger.log('Running streak break reminder check...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      // Find users with streak > 0 who haven't been active today
      const usersAtRisk = await this.prisma.user.findMany({
        where: {
          streak: { gt: 0 },
          lastActiveDate: { lt: today },
        },
        include: {
          emailSettings: true,
        },
        take: 100, // Limit batch size
      });

      let sentCount = 0;
      const appUrl = process.env.APP_URL || 'http://localhost:3000';

      for (const user of usersAtRisk) {
        // Check if user has email reminders enabled
        if (user.emailSettings && !user.emailSettings.enableReminders) {
          continue;
        }

        // Check if we already sent reminder today
        const lastReminder = user.emailSettings?.lastReminderSent;
        if (lastReminder && this.isSameDay(lastReminder, new Date())) {
          continue;
        }

        try {
          await this.emailService.sendWithTemplate(
            user.id,
            'streak_break_warning',
            {
              streakDays: user.streak,
              appUrl,
            },
          );

          // Update last reminder sent
          await this.prisma.userEmailSettings.upsert({
            where: { userId: user.id },
            create: { userId: user.id, lastReminderSent: new Date() },
            update: { lastReminderSent: new Date() },
          });

          sentCount++;
        } catch (error: any) {
          this.logger.error(
            `Failed to send streak reminder to ${user.email}: ${error.message}`,
          );
        }
      }

      this.logger.log(`Sent ${sentCount} streak break reminders`);
    } catch (error: any) {
      this.logger.error(`Streak reminder check failed: ${error.message}`);
    }
  }

  /**
   * Check for inactive users and send re-engagement emails
   */
  async checkInactiveUsers() {
    this.logger.log('Running inactive users check...');

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    try {
      const appUrl = process.env.APP_URL || 'http://localhost:3000';

      // 3-day inactive users
      const inactive3Days = await this.prisma.user.findMany({
        where: {
          lastActiveDate: {
            gte: sevenDaysAgo,
            lt: threeDaysAgo,
          },
        },
        include: { emailSettings: true },
        take: 50,
      });

      for (const user of inactive3Days) {
        if (user.emailSettings && !user.emailSettings.enableEngagement)
          continue;

        try {
          await this.emailService.sendWithTemplate(user.id, 'inactive_3days', {
            inactiveDays: 3,
            appUrl,
          });
        } catch (error: any) {
          this.logger.error(`Failed to send inactive email to ${user.email}`);
        }
      }

      // 7-day inactive users
      const inactive7Days = await this.prisma.user.findMany({
        where: {
          lastActiveDate: { lt: sevenDaysAgo },
        },
        include: { emailSettings: true },
        take: 50,
      });

      for (const user of inactive7Days) {
        if (user.emailSettings && !user.emailSettings.enableEngagement)
          continue;

        try {
          await this.emailService.sendWithTemplate(user.id, 'inactive_7days', {
            inactiveDays: 7,
            appUrl,
          });
        } catch (error: any) {
          this.logger.error(`Failed to send inactive email to ${user.email}`);
        }
      }

      this.logger.log(
        `Processed ${inactive3Days.length} 3-day and ${inactive7Days.length} 7-day inactive users`,
      );
    } catch (error: any) {
      this.logger.error(`Inactive users check failed: ${error.message}`);
    }
  }

  /**
   * Send weekly progress reports
   */
  async sendWeeklyReports() {
    this.logger.log('Running weekly reports...');

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekRange = `${this.formatDate(weekAgo)} - ${this.formatDate(now)}`;

    try {
      const appUrl = process.env.APP_URL || 'http://localhost:3000';

      // Find all users (simplified - will send to all who want weekly reports)
      const users = await this.prisma.user.findMany({
        include: {
          emailSettings: true,
          userVocabulary: {
            where: { savedAt: { gte: weekAgo } },
          },
          videoProgress: {
            where: { lastWatchedAt: { gte: weekAgo } },
          },
        },
        take: 100,
      });

      let sentCount = 0;

      for (const user of users) {
        // Skip if user disabled weekly reports
        if (user.emailSettings && !user.emailSettings.enableWeeklyReport)
          continue;

        try {
          await this.emailService.sendWithTemplate(user.id, 'weekly_report', {
            weekRange,
            streakDays: user.streak,
            weeklyXP: user.xp, // Simplified - would need actual weekly XP calculation
            vocabLearned: user.userVocabulary.length,
            videosWatched: user.videoProgress.length,
            appUrl,
          });
          sentCount++;
        } catch (error: any) {
          this.logger.error(`Failed to send weekly report to ${user.email}`);
        }
      }

      this.logger.log(`Sent ${sentCount} weekly reports`);
    } catch (error: any) {
      this.logger.error(`Weekly reports failed: ${error.message}`);
    }
  }

  /**
   * Check users with vocabulary due for review
   */
  async checkVocabDueReminders() {
    this.logger.log('Running vocab due reminder check...');

    try {
      const now = new Date();
      const appUrl = process.env.APP_URL || 'http://localhost:3000';

      // Find users with due flashcards
      const usersWithDue = await this.prisma.$queryRaw<
        Array<{ userId: string; dueCount: number }>
      >`
                SELECT "user_id" as "userId", COUNT(*) as "dueCount"
                FROM flashcard_reviews
                WHERE "next_review_at" <= ${now}
                GROUP BY "user_id"
                HAVING COUNT(*) >= 5
                LIMIT 100
            `;

      let sentCount = 0;

      for (const row of usersWithDue) {
        const user = await this.prisma.user.findUnique({
          where: { id: row.userId },
          include: { emailSettings: true },
        });

        if (!user) continue;
        if (user.emailSettings && !user.emailSettings.enableReminders) continue;

        try {
          await this.emailService.sendWithTemplate(user.id, 'vocab_due', {
            dueCount: Number(row.dueCount),
            appUrl,
          });
          sentCount++;
        } catch (error: any) {
          this.logger.error(`Failed to send vocab due email to ${user.email}`);
        }
      }

      this.logger.log(`Sent ${sentCount} vocab due reminders`);
    } catch (error: any) {
      this.logger.error(`Vocab due check failed: ${error.message}`);
    }
  }

  /**
   * Helper: Check if two dates are on the same day
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  /**
   * Helper: Format date as DD/MM
   */
  private formatDate(date: Date): string {
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  }
}
