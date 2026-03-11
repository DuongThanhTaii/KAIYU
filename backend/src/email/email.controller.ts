import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { EmailService } from './email.service';
import { CurrentUser } from '../auth/decorators';
import { RolesGuard, Roles } from '../auth/guards';

@ApiTags('email')
@Controller('email')
export class EmailController {
    constructor(private readonly emailService: EmailService) { }

    // ================== USER ENDPOINTS ==================

    @Get('settings')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get user email notification settings' })
    async getUserSettings(@CurrentUser() user: any) {
        return this.emailService.getUserSettings(user.id);
    }

    @Put('settings')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update user email notification settings' })
    async updateUserSettings(
        @CurrentUser() user: any,
        @Body() body: {
            enableReminders?: boolean;
            enableWeeklyReport?: boolean;
            enableEngagement?: boolean;
            reminderHour?: number;
            timezone?: string;
        },
    ) {
        return this.emailService.updateUserSettings(user.id, body);
    }

    // ================== ADMIN ENDPOINTS ==================

    @Get('admin/templates')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: '[Admin] Get all email templates' })
    async getAllTemplates() {
        return this.emailService.getAllTemplates();
    }

    @Post('admin/templates')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: '[Admin] Create or update email template' })
    async upsertTemplate(
        @Body() body: {
            code: string;
            name: string;
            nameVi: string;
            subject: string;
            htmlBody: string;
            textBody?: string;
            designJson?: any;
            variables?: string[];
            category?: string;
            isActive?: boolean;
            // Trigger config
            triggerType?: string;
            triggerDays?: number;
            triggerHour?: number;
            triggerDayOfWeek?: number;
        },
    ) {
        return this.emailService.upsertTemplate(body);
    }

    @Delete('admin/templates/:code')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: '[Admin] Delete email template' })
    async deleteTemplate(@Param('code') code: string) {
        return this.emailService.deleteTemplate(code);
    }

    @Get('admin/logs')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: '[Admin] Get email send logs' })
    @ApiQuery({ name: 'userId', required: false })
    @ApiQuery({ name: 'status', required: false })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'offset', required: false, type: Number })
    async getEmailLogs(
        @Query('userId') userId?: string,
        @Query('status') status?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.emailService.getEmailLogs({
            userId,
            status,
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
    }

    @Post('admin/templates/seed')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: '[Admin] Seed default email templates' })
    async seedTemplates() {
        const count = await this.emailService.seedDefaultTemplates();
        return { message: `Seeded ${count} templates` };
    }

    @Post('admin/test-send')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: '[Admin] Send test email with template' })
    async testSendEmail(
        @CurrentUser() user: any,
        @Body() body: { templateCode: string; variables?: Record<string, string | number> },
    ) {
        return this.emailService.sendWithTemplate(
            user.id,
            body.templateCode,
            body.variables || {},
        );
    }

    @Get('admin/statistics')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: '[Admin] Get email statistics' })
    async getEmailStatistics() {
        return this.emailService.getEmailStatistics();
    }

    @Post('admin/preview')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: '[Admin] Preview email template with sample data' })
    async previewTemplate(
        @Body() body: { subject: string; htmlBody: string },
    ) {
        return this.emailService.previewTemplate(body.subject, body.htmlBody);
    }

    @Post('admin/broadcast')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: '[Admin] Send broadcast email to all active users' })
    async broadcastEmail(
        @Body() body: { subject: string; htmlBody: string; targetUsers?: 'all' | 'active' },
    ) {
        return this.emailService.broadcastEmail(body.subject, body.htmlBody, body.targetUsers || 'active');
    }
}

