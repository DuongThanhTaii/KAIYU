import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class UploadService {
    private s3Client: S3Client | null = null;
    private bucketName: string;
    private region: string;
    private publicUrl: string;

    constructor() {
        // Check if S3 is configured (supports AWS S3 or S3-compatible services like R2, MinIO)
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY;
        const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET;

        if (accessKeyId && secretAccessKey && bucket) {
            this.region = process.env.AWS_REGION || process.env.S3_REGION || 'auto';
            this.bucketName = bucket;

            // Support custom endpoint for S3-compatible services (R2, MinIO, etc.)
            const endpoint = process.env.S3_ENDPOINT;

            this.s3Client = new S3Client({
                region: this.region,
                endpoint: endpoint || undefined,
                credentials: {
                    accessKeyId,
                    secretAccessKey,
                },
                // For S3-compatible services
                forcePathStyle: !!endpoint,
            });

            // Custom public URL (useful for CDN or custom domains)
            this.publicUrl = process.env.S3_PUBLIC_URL ||
                `https://${this.bucketName}.s3.${this.region}.amazonaws.com`;
        }
    }

    /**
     * Check if S3 is configured
     */
    isS3Configured(): boolean {
        return this.s3Client !== null;
    }

    /**
     * Upload file to S3
     */
    async uploadFile(
        file: Buffer,
        originalName: string,
        mimeType: string,
        folder: 'videos' | 'images' | 'audio' = 'images',
    ): Promise<string> {
        if (!this.s3Client) {
            throw new BadRequestException(
                'S3 chưa được cấu hình. Vui lòng thêm AWS credentials vào environment variables.',
            );
        }

        const ext = path.extname(originalName);
        const key = `${folder}/${uuidv4()}${ext}`;

        try {
            await this.s3Client.send(
                new PutObjectCommand({
                    Bucket: this.bucketName,
                    Key: key,
                    Body: file,
                    ContentType: mimeType,
                    ACL: 'public-read',
                }),
            );

            return `${this.publicUrl}/${key}`;
        } catch (error) {
            console.error('S3 Upload Error:', error);
            throw new BadRequestException('Upload thất bại. Vui lòng thử lại.');
        }
    }

    /**
     * Delete file from S3
     */
    async deleteFile(fileUrl: string): Promise<void> {
        if (!this.s3Client) return;

        try {
            // Extract key from URL
            const url = new URL(fileUrl);
            const key = url.pathname.slice(1); // Remove leading /

            await this.s3Client.send(
                new DeleteObjectCommand({
                    Bucket: this.bucketName,
                    Key: key,
                }),
            );
        } catch (error) {
            console.error('S3 Delete Error:', error);
            // Don't throw - deletion failure shouldn't break the flow
        }
    }

    /**
     * Get allowed file types for validation
     */
    getAllowedMimeTypes(type: 'video' | 'image' | 'audio'): string[] {
        switch (type) {
            case 'video':
                return ['video/mp4', 'video/webm', 'video/quicktime'];
            case 'image':
                return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            case 'audio':
                return ['audio/mpeg', 'audio/wav', 'audio/ogg'];
            default:
                return [];
        }
    }

    /**
     * Validate file type
     */
    validateFileType(mimeType: string, type: 'video' | 'image' | 'audio'): boolean {
        return this.getAllowedMimeTypes(type).includes(mimeType);
    }

    /**
     * Get max file size in bytes
     */
    getMaxFileSize(type: 'video' | 'image' | 'audio'): number {
        switch (type) {
            case 'video':
                return 500 * 1024 * 1024; // 500MB
            case 'image':
                return 10 * 1024 * 1024; // 10MB
            case 'audio':
                return 50 * 1024 * 1024; // 50MB
            default:
                return 10 * 1024 * 1024;
        }
    }
}
