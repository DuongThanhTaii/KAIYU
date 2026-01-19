import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export interface TemplateVariables {
    [key: string]: string | number;
}

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private transporter: nodemailer.Transporter | null = null;

    constructor(private prisma: PrismaService) {
        this.initializeTransporter();
    }

    private initializeTransporter() {
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;

        if (!user || !pass) {
            this.logger.warn('SMTP credentials not configured. Email sending disabled.');
            return;
        }

        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user,
                pass,
            },
        });

        this.logger.log('Email transporter initialized with Gmail');
    }

    /**
     * Send email using a template
     */
    async sendWithTemplate(
        userId: string,
        templateCode: string,
        variables: TemplateVariables,
    ) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true },
        });

        if (!user) {
            throw new Error('User not found');
        }

        const template = await this.prisma.emailTemplate.findUnique({
            where: { code: templateCode },
        });

        if (!template || !template.isActive) {
            throw new Error(`Template ${templateCode} not found or inactive`);
        }

        // Replace variables in subject and body
        let subject = template.subject;
        let htmlBody = template.htmlBody;
        let textBody = template.textBody || '';

        // Add default variables
        const allVariables = {
            userName: user.name,
            userEmail: user.email,
            ...variables,
        };

        for (const [key, value] of Object.entries(allVariables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            subject = subject.replace(regex, String(value));
            htmlBody = htmlBody.replace(regex, String(value));
            textBody = textBody.replace(regex, String(value));
        }

        // Create email log
        const emailLog = await this.prisma.emailLog.create({
            data: {
                userId,
                templateId: template.id,
                toEmail: user.email,
                subject,
                status: 'pending',
                metadata: allVariables as any,
            },
        });

        // Send email
        try {
            await this.sendEmail({
                to: user.email,
                subject,
                html: htmlBody,
                text: textBody || undefined,
            });

            // Update log status
            await this.prisma.emailLog.update({
                where: { id: emailLog.id },
                data: {
                    status: 'sent',
                    sentAt: new Date(),
                },
            });

            return { success: true, emailLogId: emailLog.id };
        } catch (error: any) {
            // Update log with error
            await this.prisma.emailLog.update({
                where: { id: emailLog.id },
                data: {
                    status: 'failed',
                    errorMessage: error.message,
                },
            });

            throw error;
        }
    }

    /**
     * Send raw email
     */
    async sendEmail(options: EmailOptions) {
        if (!this.transporter) {
            this.logger.warn('Email transporter not configured. Skipping email.');
            return { success: false, message: 'Email not configured' };
        }

        try {
            const result = await this.transporter.sendMail({
                from: `"HocTiengTrung App" <${process.env.SMTP_USER}>`,
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text,
            });

            this.logger.log(`Email sent to ${options.to}: ${result.messageId}`);
            return { success: true, messageId: result.messageId };
        } catch (error: any) {
            this.logger.error(`Failed to send email to ${options.to}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all email templates (for admin)
     */
    async getAllTemplates() {
        return this.prisma.emailTemplate.findMany({
            orderBy: { category: 'asc' },
        });
    }

    /**
     * Create or update email template
     */
    async upsertTemplate(data: {
        code: string;
        name: string;
        nameVi: string;
        subject: string;
        htmlBody: string;
        textBody?: string;
        variables?: string[];
        category?: string;
        isActive?: boolean;
        triggerType?: string;
        triggerDays?: number;
        triggerHour?: number;
        triggerDayOfWeek?: number;
    }) {
        return this.prisma.emailTemplate.upsert({
            where: { code: data.code },
            create: {
                code: data.code,
                name: data.name,
                nameVi: data.nameVi,
                subject: data.subject,
                htmlBody: data.htmlBody,
                textBody: data.textBody,
                variables: data.variables || [],
                category: data.category || 'reminder',
                isActive: data.isActive ?? true,
                triggerType: data.triggerType || 'inactive_days',
                triggerDays: data.triggerDays ?? 3,
                triggerHour: data.triggerHour ?? 18,
                triggerDayOfWeek: data.triggerDayOfWeek,
            },
            update: {
                name: data.name,
                nameVi: data.nameVi,
                subject: data.subject,
                htmlBody: data.htmlBody,
                textBody: data.textBody,
                variables: data.variables,
                category: data.category,
                isActive: data.isActive,
                triggerType: data.triggerType,
                triggerDays: data.triggerDays,
                triggerHour: data.triggerHour,
                triggerDayOfWeek: data.triggerDayOfWeek,
            },
        });
    }

    /**
     * Delete email template
     */
    async deleteTemplate(code: string) {
        return this.prisma.emailTemplate.delete({
            where: { code },
        });
    }

    /**
     * Get user email settings
     */
    async getUserSettings(userId: string) {
        let settings = await this.prisma.userEmailSettings.findUnique({
            where: { userId },
        });

        if (!settings) {
            // Create default settings
            settings = await this.prisma.userEmailSettings.create({
                data: { userId },
            });
        }

        return settings;
    }

    /**
     * Update user email settings
     */
    async updateUserSettings(userId: string, data: {
        enableReminders?: boolean;
        enableWeeklyReport?: boolean;
        enableEngagement?: boolean;
        reminderHour?: number;
        timezone?: string;
    }) {
        return this.prisma.userEmailSettings.upsert({
            where: { userId },
            create: {
                userId,
                ...data,
            },
            update: data,
        });
    }

    /**
     * Get email logs for admin
     */
    async getEmailLogs(options?: {
        userId?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }) {
        const limit = options?.limit || 50;
        const offset = options?.offset || 0;

        const where: any = {};
        if (options?.userId) where.userId = options.userId;
        if (options?.status) where.status = options.status;

        const [logs, total] = await Promise.all([
            this.prisma.emailLog.findMany({
                where,
                include: {
                    user: { select: { name: true, email: true } },
                    template: { select: { code: true, nameVi: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.emailLog.count({ where }),
        ]);

        return { logs, total, limit, offset };
    }

    /**
     * Get email statistics for admin dashboard
     */
    async getEmailStatistics() {
        const [
            totalSent,
            totalOpened,
            totalClicked,
            totalFailed,
            templateStats,
            recentLogs,
        ] = await Promise.all([
            this.prisma.emailLog.count({ where: { status: 'sent' } }),
            this.prisma.emailLog.count({ where: { openedAt: { not: null } } }),
            this.prisma.emailLog.count({ where: { clickedAt: { not: null } } }),
            this.prisma.emailLog.count({ where: { status: 'failed' } }),
            this.prisma.emailLog.groupBy({
                by: ['templateId'],
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 10,
            }),
            this.prisma.emailLog.findMany({
                select: { status: true, sentAt: true },
                where: { sentAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
                orderBy: { sentAt: 'desc' },
            }),
        ]);

        // Get template names for stats
        const templateIds = templateStats.map((t) => t.templateId);
        const templates = await this.prisma.emailTemplate.findMany({
            where: { id: { in: templateIds } },
            select: { id: true, nameVi: true, code: true },
        });

        const templateStatsWithNames = templateStats.map((stat) => {
            const template = templates.find((t) => t.id === stat.templateId);
            return {
                templateId: stat.templateId,
                templateName: template?.nameVi || 'Unknown',
                templateCode: template?.code || 'unknown',
                count: stat._count.id,
            };
        });

        // Calculate open rate and click rate
        const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
        const clickRate = totalOpened > 0 ? Math.round((totalClicked / totalOpened) * 100) : 0;

        // Last 7 days daily stats
        const dailyStats: Record<string, { sent: number; opened: number }> = {};
        for (const log of recentLogs) {
            if (log.sentAt) {
                const date = log.sentAt.toISOString().split('T')[0];
                if (!dailyStats[date]) dailyStats[date] = { sent: 0, opened: 0 };
                dailyStats[date].sent++;
            }
        }

        return {
            summary: {
                totalSent,
                totalOpened,
                totalClicked,
                totalFailed,
                openRate,
                clickRate,
            },
            templateStats: templateStatsWithNames,
            dailyStats: Object.entries(dailyStats).map(([date, stats]) => ({ date, ...stats })),
        };
    }

    /**
     * Preview email template with sample data
     */
    async previewTemplate(subject: string, htmlBody: string) {
        const sampleData: TemplateVariables = {
            userName: 'Nguyễn Văn A',
            streakDays: 7,
            dueCount: 15,
            weekRange: '13/01 - 19/01',
            weeklyXP: 350,
            vocabLearned: 42,
            videosWatched: 5,
            inactiveDays: 3,
            appUrl: process.env.APP_URL || 'http://localhost:3000',
        };

        let renderedSubject = subject;
        let renderedHtml = htmlBody;

        for (const [key, value] of Object.entries(sampleData)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            renderedSubject = renderedSubject.replace(regex, String(value));
            renderedHtml = renderedHtml.replace(regex, String(value));
        }

        return {
            subject: renderedSubject,
            html: renderedHtml,
            sampleData,
        };
    }

    /**
     * Send broadcast email to all active users
     */
    async broadcastEmail(subject: string, htmlBody: string, targetUsers: 'all' | 'active') {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const users = await this.prisma.user.findMany({
            where: targetUsers === 'active' ? { lastActiveDate: { gte: thirtyDaysAgo } } : undefined,
            select: { id: true, email: true, name: true },
        });

        let sentCount = 0;
        let failedCount = 0;

        for (const user of users) {
            try {
                // Replace userName in content
                const personalizedHtml = htmlBody.replace(/{{userName}}/g, user.name);
                const personalizedSubject = subject.replace(/{{userName}}/g, user.name);

                await this.sendEmail({
                    to: user.email,
                    subject: personalizedSubject,
                    html: personalizedHtml,
                });
                sentCount++;
            } catch (error) {
                this.logger.error(`Failed to send broadcast to ${user.email}`);
                failedCount++;
            }
        }

        return {
            totalUsers: users.length,
            sentCount,
            failedCount,
        };
    }

    /**
     * Seed default email templates
     */
    async seedDefaultTemplates() {
        const templates = [
            {
                code: 'streak_break_warning',
                name: 'Streak Break Warning',
                nameVi: 'Cảnh báo mất chuỗi',
                subject: '🔥 Đừng để mất chuỗi {{streakDays}} ngày của bạn!',
                htmlBody: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h1 style="color: #f97316;">🔥 Chào {{userName}}!</h1>
                        <p style="font-size: 16px; color: #374151;">
                            Bạn đang có chuỗi <strong style="color: #f97316;">{{streakDays}} ngày</strong> học liên tục! 
                            Đừng để mất công sức của mình nhé.
                        </p>
                        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
                            <a href="{{appUrl}}/review" style="color: white; text-decoration: none; font-size: 18px; font-weight: bold;">
                                📚 Vào học ngay!
                            </a>
                        </div>
                        <p style="color: #6b7280; font-size: 14px;">
                            Chỉ cần 5 phút mỗi ngày để giữ chuỗi học liên tục.
                        </p>
                    </div>
                `,
                variables: ['userName', 'streakDays', 'appUrl'],
                category: 'reminder',
                triggerType: 'daily',
                triggerHour: 18,
            },
            {
                code: 'vocab_due',
                name: 'Vocabulary Due Reminder',
                nameVi: 'Nhắc ôn từ vựng',
                subject: '📖 {{dueCount}} từ vựng đang chờ bạn ôn tập!',
                htmlBody: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h1 style="color: #10b981;">📖 Chào {{userName}}!</h1>
                        <p style="font-size: 16px; color: #374151;">
                            Bạn có <strong style="color: #10b981;">{{dueCount}}</strong> từ vựng cần ôn tập hôm nay.
                            Đây là thời điểm tốt nhất để ghi nhớ lâu dài!
                        </p>
                        <div style="background: linear-gradient(135deg, #06b6d4, #0891b2); padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
                            <a href="{{appUrl}}/review" style="color: white; text-decoration: none; font-size: 18px; font-weight: bold;">
                                ✨ Ôn tập ngay
                            </a>
                        </div>
                    </div>
                `,
                variables: ['userName', 'dueCount', 'appUrl'],
                category: 'reminder',
                triggerType: 'daily',
                triggerHour: 9,
            },
            {
                code: 'weekly_report',
                name: 'Weekly Progress Report',
                nameVi: 'Báo cáo tiến độ tuần',
                subject: '📊 Báo cáo tiến độ tuần của bạn - {{weekRange}}',
                htmlBody: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h1 style="color: #8b5cf6;">📊 Báo cáo tuần</h1>
                        <p>Xin chào {{userName}}! Đây là tổng kết tuần {{weekRange}} của bạn:</p>
                        <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; margin: 20px 0;">
                            <p><strong>🔥 Chuỗi học:</strong> {{streakDays}} ngày</p>
                            <p><strong>⭐ XP kiếm được:</strong> {{weeklyXP}} điểm</p>
                            <p><strong>📚 Từ vựng đã học:</strong> {{vocabLearned}} từ</p>
                            <p><strong>🎬 Video đã xem:</strong> {{videosWatched}} video</p>
                        </div>
                        <p style="color: #6b7280;">Tiếp tục phát huy nhé! 💪</p>
                    </div>
                `,
                variables: ['userName', 'weekRange', 'streakDays', 'weeklyXP', 'vocabLearned', 'videosWatched'],
                category: 'report',
                triggerType: 'weekly',
                triggerHour: 9,
                triggerDayOfWeek: 0, // Sunday
            },
            {
                code: 'inactive_3days',
                name: '3 Days Inactive',
                nameVi: 'Không hoạt động 3 ngày',
                subject: '😢 Chúng tôi nhớ bạn, {{userName}}!',
                htmlBody: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h1 style="color: #ef4444;">😢 Chúng tôi nhớ bạn!</h1>
                        <p style="font-size: 16px; color: #374151;">
                            Chào {{userName}}, bạn đã không học {{inactiveDays}} ngày rồi!
                        </p>
                        <p style="font-size: 16px; color: #374151;">
                            Học tiếng Trung giống như tập thể dục - càng đều đặn càng hiệu quả. 
                            Chỉ cần 5 phút mỗi ngày thôi!
                        </p>
                        <div style="background: linear-gradient(135deg, #ec4899, #db2777); padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
                            <a href="{{appUrl}}/learn" style="color: white; text-decoration: none; font-size: 18px; font-weight: bold;">
                                🚀 Bắt đầu lại ngay!
                            </a>
                        </div>
                    </div>
                `,
                variables: ['userName', 'inactiveDays', 'appUrl'],
                category: 'engagement',
                triggerType: 'inactive_days',
                triggerDays: 3,
                triggerHour: 18,
            },
            {
                code: 'inactive_7days',
                name: '7 Days Inactive',
                nameVi: 'Không hoạt động 7 ngày',
                subject: '💔 Đừng bỏ cuộc, {{userName}}!',
                htmlBody: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h1 style="color: #dc2626;">💔 Đừng bỏ cuộc!</h1>
                        <p style="font-size: 16px; color: #374151;">
                            {{userName}} ơi, đã {{inactiveDays}} ngày bạn chưa ghé thăm chúng tôi rồi!
                        </p>
                        <p style="font-size: 16px; color: #374151;">
                            Mỗi ngày không học là một bước lùi. Nhưng không sao, hãy quay lại ngay bây giờ! 🌟
                        </p>
                        <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
                            <a href="{{appUrl}}/dashboard" style="color: white; text-decoration: none; font-size: 18px; font-weight: bold;">
                                ❤️ Quay lại học tiếp
                            </a>
                        </div>
                        <p style="color: #6b7280; font-size: 14px;">
                            Nếu bạn không muốn nhận email này, hãy <a href="{{appUrl}}/settings">tắt thông báo</a>.
                        </p>
                    </div>
                `,
                variables: ['userName', 'inactiveDays', 'appUrl'],
                category: 'engagement',
                triggerType: 'inactive_days',
                triggerDays: 7,
                triggerHour: 18,
            },
        ];

        for (const template of templates) {
            await this.upsertTemplate(template);
        }

        this.logger.log(`Seeded ${templates.length} email templates`);
        return templates.length;
    }
}

