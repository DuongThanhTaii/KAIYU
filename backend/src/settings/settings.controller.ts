import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { RolesGuard, Roles } from '../auth/guards';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ================== PUBLIC ENDPOINTS ==================

  @Get('logo')
  @ApiOperation({ summary: 'Get site logo URL' })
  async getLogo() {
    const url = await this.settingsService.getLogoUrl();
    return { url };
  }

  @Get('favicon.ico')
  @ApiOperation({ summary: 'Get dynamic site favicon' })
  async getFavicon(@Res() res: Response) {
    const logoUrl = await this.settingsService.getLogoUrl();
    if (logoUrl) {
      // Strip leading slash to safely join with cwd
      const filepath = path.join(process.cwd(), logoUrl.replace(/^\//, ''));
      if (fs.existsSync(filepath)) {
        return res.sendFile(filepath);
      }
    }
    return res.status(404).send('Logo not found');
  }

  @Get('public')
  @ApiOperation({ summary: 'Get all public settings' })
  async getPublicSettings() {
    const settings = await this.settingsService.getAllSettings();
    // Return only safe public settings
    return {
      logo: settings['site_logo'] || null,
      siteName: settings['site_name'] || 'KAIYU',
    };
  }

  // ================== ADMIN ENDPOINTS ==================

  @Post('admin/logo')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Upload site logo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }), // 2MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|gif|webp|svg)$/i }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.settingsService.uploadLogo(file);
  }

  @Delete('admin/logo')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Delete site logo' })
  async deleteLogo() {
    await this.settingsService.deleteLogo();
    return { message: 'Logo deleted' };
  }

  @Get('admin/all')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Get all site settings' })
  async getAllSettings() {
    return this.settingsService.getAllSettings();
  }
}
