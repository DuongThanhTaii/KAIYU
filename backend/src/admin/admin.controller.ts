import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { RolesGuard, Roles } from '../auth/guards';

@ApiTags('admin')
@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    // ============ Dashboard ============
    @Get('stats/overview')
    @ApiOperation({ summary: 'Get admin dashboard overview' })
    async getOverviewStats() {
        return this.adminService.getOverviewStats();
    }

    @Get('notifications')
    @ApiOperation({ summary: 'Get admin notifications' })
    async getNotifications(@Query('limit') limit?: number) {
        return this.adminService.getNotifications(limit ? Number(limit) : 10);
    }

    @Get('stats/activity')
    @ApiOperation({ summary: 'Get activity stats for chart' })
    async getActivityStats(@Query('days') days?: number) {
        return this.adminService.getDailyActivityStats(days ? Number(days) : 7);
    }

    // ============ Videos ============
    @Get('videos')
    @ApiOperation({ summary: 'Get all videos (admin)' })
    async getAllVideos(
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('isPublished') isPublished?: string,
    ) {
        return this.adminService.getAllVideos({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            isPublished: isPublished === 'true' ? true : isPublished === 'false' ? false : undefined,
        });
    }

    @Post('videos')
    @ApiOperation({ summary: 'Create video' })
    async createVideo(@Body() body: any) {
        return this.adminService.createVideo(body);
    }

    @Put('videos/:id')
    @ApiOperation({ summary: 'Update video' })
    async updateVideo(@Param('id') id: string, @Body() body: any) {
        return this.adminService.updateVideo(id, body);
    }

    @Delete('videos/:id')
    @ApiOperation({ summary: 'Delete video' })
    async deleteVideo(@Param('id') id: string) {
        return this.adminService.deleteVideo(id);
    }

    @Post('videos/:id/publish')
    @ApiOperation({ summary: 'Publish video' })
    async publishVideo(@Param('id') id: string) {
        return this.adminService.publishVideo(id);
    }

    @Post('videos/:id/subtitles')
    @ApiOperation({ summary: 'Add subtitles to video' })
    async addSubtitles(@Param('id') id: string, @Body() body: { subtitles: any[] }) {
        return this.adminService.addSubtitles(id, body.subtitles);
    }

    @Put('subtitles/:id')
    @ApiOperation({ summary: 'Update specific subtitle and its tokens' })
    async updateSubtitle(@Param('id') id: string, @Body() body: any) {
        return this.adminService.updateSubtitle(id, body);
    }

    // ============ Vocabulary ============
    @Get('vocabulary')
    @ApiOperation({ summary: 'Get all vocabulary (admin)' })
    async getAllVocabulary(
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('hskLevel') hskLevel?: number,
        @Query('search') search?: string,
    ) {
        return this.adminService.getAllVocabulary({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            hskLevel: hskLevel ? Number(hskLevel) : undefined,
            search,
        });
    }

    @Post('vocabulary')
    @ApiOperation({ summary: 'Create vocabulary' })
    async createVocabulary(@Body() body: any) {
        return this.adminService.createVocabulary(body);
    }

    @Put('vocabulary/:id')
    @ApiOperation({ summary: 'Update vocabulary' })
    async updateVocabulary(@Param('id') id: string, @Body() body: any) {
        return this.adminService.updateVocabulary(id, body);
    }

    @Delete('vocabulary/:id')
    @ApiOperation({ summary: 'Delete vocabulary' })
    async deleteVocabulary(@Param('id') id: string) {
        return this.adminService.deleteVocabulary(id);
    }

    @Post('vocabulary/import')
    @ApiOperation({ summary: 'Import vocabulary list' })
    async importVocabulary(@Body() body: { vocabulary: any[] }) {
        return this.adminService.importVocabulary(body.vocabulary);
    }

    // ============ Users ============
    @Get('users')
    @ApiOperation({ summary: 'Get all users (admin)' })
    async getAllUsers(
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('role') role?: string,
        @Query('search') search?: string,
    ) {
        return this.adminService.getAllUsers({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            role,
            search,
        });
    }

    @Put('users/:id/role')
    @ApiOperation({ summary: 'Update user role' })
    async updateUserRole(@Param('id') id: string, @Body() body: { role: string }) {
        return this.adminService.updateUserRole(id, body.role);
    }

    @Delete('users/:id')
    @ApiOperation({ summary: 'Delete user' })
    @ApiResponse({ status: 200, description: 'User deleted successfully' })
    async deleteUser(@Param('id') id: string) {
        return this.adminService.deleteUser(id);
    }

    // ============ Achievements ============
    @Get('achievements')
    @ApiOperation({ summary: 'Get all achievements (admin)' })
    async getAllAchievements(
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ) {
        return this.adminService.getAllAchievements({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
        });
    }

    @Post('achievements')
    @ApiOperation({ summary: 'Create achievement' })
    async createAchievement(@Body() body: {
        code: string;
        title: string;
        description?: string;
        icon?: string;
        iconColor?: string;
        xpReward?: number;
    }) {
        return this.adminService.createAchievement(body);
    }

    @Put('achievements/:id')
    @ApiOperation({ summary: 'Update achievement' })
    async updateAchievement(@Param('id') id: string, @Body() body: {
        code?: string;
        title?: string;
        description?: string;
        icon?: string;
        iconColor?: string;
        xpReward?: number;
    }) {
        return this.adminService.updateAchievement(id, body);
    }

    @Delete('achievements/:id')
    @ApiOperation({ summary: 'Delete achievement' })
    @ApiResponse({ status: 200, description: 'Achievement deleted successfully' })
    async deleteAchievement(@Param('id') id: string) {
        return this.adminService.deleteAchievement(id);
    }
}
