import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

interface SiteSettingRow {
    key: string;
    value: string;
}

@Injectable()
export class SettingsService {
    private readonly logger = new Logger(SettingsService.name);
    private readonly uploadDir = path.join(process.cwd(), 'uploads', 'settings');

    constructor(private prisma: PrismaService) {
        // Ensure upload directory exists
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    // Get a setting by key
    async getSetting(key: string): Promise<string | null> {
        const result = await this.prisma.$queryRaw<SiteSettingRow[]>`
            SELECT key, value FROM site_settings WHERE key = ${key}
        `;
        return result[0]?.value || null;
    }

    // Get all settings
    async getAllSettings(): Promise<Record<string, string>> {
        const settings = await this.prisma.$queryRaw<SiteSettingRow[]>`
            SELECT key, value FROM site_settings
        `;
        return settings.reduce((acc, s) => {
            acc[s.key] = s.value;
            return acc;
        }, {} as Record<string, string>);
    }

    // Update a setting
    async updateSetting(key: string, value: string): Promise<void> {
        await this.prisma.$executeRaw`
            INSERT INTO site_settings (key, value, updated_at)
            VALUES (${key}, ${value}, NOW())
            ON CONFLICT (key) 
            DO UPDATE SET value = ${value}, updated_at = NOW()
        `;
    }

    // Upload and process logo
    async uploadLogo(file: Express.Multer.File): Promise<{ url: string; width: number; height: number }> {
        const maxWidth = 200;
        const maxHeight = 80;

        // Process image with sharp - scale to fit within maxWidth x maxHeight
        const image = sharp(file.buffer);
        const metadata = await image.metadata();

        if (!metadata.width || !metadata.height) {
            throw new Error('Invalid image file');
        }

        // Calculate new dimensions preserving aspect ratio
        let width = metadata.width;
        let height = metadata.height;

        if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
        }

        if (height > maxHeight) {
            width = Math.round(width * (maxHeight / height));
            height = maxHeight;
        }

        // Generate filename
        const filename = `logo-${Date.now()}.webp`;
        const filepath = path.join(this.uploadDir, filename);

        // Save as WebP for best compression
        await image
            .resize(width, height, { fit: 'inside' })
            .webp({ quality: 90 })
            .toFile(filepath);

        // Build URL - will be served by static file middleware
        const url = `/uploads/settings/${filename}`;

        // Save to settings
        await this.updateSetting('site_logo', url);

        this.logger.log(`Logo uploaded: ${url} (${width}x${height})`);

        return { url, width, height };
    }

    // Delete current logo
    async deleteLogo(): Promise<void> {
        const currentLogo = await this.getSetting('site_logo');

        if (currentLogo) {
            const filepath = path.join(process.cwd(), currentLogo.replace(/^\//, ''));
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
                this.logger.log(`Deleted logo file: ${filepath}`);
            }
            await this.updateSetting('site_logo', '');
        }
    }

    // Get logo URL
    async getLogoUrl(): Promise<string | null> {
        return this.getSetting('site_logo');
    }
}
