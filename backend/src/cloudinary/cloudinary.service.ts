import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export interface UploadResult {
  url: string;
  publicId: string;
  format: string;
  width?: number;
  height?: number;
  duration?: number;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private isConfigured = false;

  constructor() {
    this.configure();
  }

  private configure() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      this.logger.warn(
        'Cloudinary credentials not configured. Media upload disabled.',
      );
      return;
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    this.isConfigured = true;
    this.logger.log('Cloudinary configured successfully');
  }

  /**
   * Upload an image from base64 or URL
   */
  async uploadImage(
    source: string, // base64 or URL
    options?: {
      folder?: string;
      publicId?: string;
      transformation?: object;
    },
  ): Promise<UploadResult | null> {
    if (!this.isConfigured) {
      this.logger.warn('Cloudinary not configured. Skipping upload.');
      return null;
    }

    try {
      const result: UploadApiResponse = await cloudinary.uploader.upload(
        source,
        {
          folder: options?.folder || 'flashcard-images',
          public_id: options?.publicId,
          resource_type: 'image',
          transformation: options?.transformation || [
            { width: 800, height: 450, crop: 'limit' }, // Max size for flashcard
            { quality: 'auto:good' },
            { format: 'webp' }, // Modern format for smaller size
          ],
        },
      );

      this.logger.log(`Image uploaded: ${result.public_id}`);

      return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
      };
    } catch (error: any) {
      this.logger.error(`Failed to upload image: ${error.message}`);
      throw error;
    }
  }

  /**
   * Upload audio from base64 or URL
   */
  async uploadAudio(
    source: string,
    options?: {
      folder?: string;
      publicId?: string;
    },
  ): Promise<UploadResult | null> {
    if (!this.isConfigured) {
      this.logger.warn('Cloudinary not configured. Skipping upload.');
      return null;
    }

    try {
      const result: UploadApiResponse = await cloudinary.uploader.upload(
        source,
        {
          folder: options?.folder || 'flashcard-audio',
          public_id: options?.publicId,
          resource_type: 'video', // Cloudinary uses 'video' for audio too
        },
      );

      this.logger.log(`Audio uploaded: ${result.public_id}`);

      return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        duration: result.duration,
      };
    } catch (error: any) {
      this.logger.error(`Failed to upload audio: ${error.message}`);
      throw error;
    }
  }

  /**
   * Upload video screenshot (frame capture)
   * This creates a thumbnail from a video URL at a specific time
   */
  async captureVideoFrame(
    videoUrl: string,
    timestampSeconds: number,
    options?: {
      folder?: string;
      publicId?: string;
    },
  ): Promise<UploadResult | null> {
    if (!this.isConfigured) {
      this.logger.warn('Cloudinary not configured. Skipping capture.');
      return null;
    }

    // For YouTube videos, we can use YouTube's thumbnail API instead
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      const youtubeId = this.extractYouTubeId(videoUrl);
      if (youtubeId) {
        // Use YouTube's high-quality thumbnail
        const thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
        return this.uploadImage(thumbnailUrl, options);
      }
    }

    // For other videos, upload and extract frame
    try {
      // Upload the video first (or use URL directly)
      const result: UploadApiResponse = await cloudinary.uploader.upload(
        videoUrl,
        {
          folder: options?.folder || 'flashcard-frames',
          public_id: options?.publicId,
          resource_type: 'video',
          eager: [
            {
              format: 'jpg',
              start_offset: timestampSeconds,
              crop: 'scale',
              width: 800,
            },
          ],
          eager_async: false,
        },
      );

      // Get the generated frame URL
      if (result.eager && result.eager[0]) {
        return {
          url: result.eager[0].secure_url,
          publicId: result.public_id,
          format: 'jpg',
          width: result.eager[0].width,
          height: result.eager[0].height,
        };
      }

      return null;
    } catch (error: any) {
      this.logger.error(`Failed to capture video frame: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a resource from Cloudinary
   */
  async delete(
    publicId: string,
    resourceType: 'image' | 'video' = 'image',
  ): Promise<boolean> {
    if (!this.isConfigured) return false;

    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
      this.logger.log(`Deleted: ${publicId}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to delete ${publicId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate optimized URL with transformations
   */
  getOptimizedUrl(
    publicId: string,
    options?: {
      width?: number;
      height?: number;
      crop?: string;
      format?: string;
    },
  ): string {
    return cloudinary.url(publicId, {
      secure: true,
      width: options?.width,
      height: options?.height,
      crop: options?.crop || 'limit',
      format: options?.format || 'auto',
      quality: 'auto',
    });
  }

  /**
   * Check if Cloudinary is configured
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Extract YouTube video ID from URL
   */
  private extractYouTubeId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }
}
