import {
    Controller,
    Post,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    Param,
    Get,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { RolesGuard, Roles } from '../auth/guards';

@ApiTags('upload')
@Controller('upload')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class UploadController {
    constructor(private readonly uploadService: UploadService) { }

    @Get('status')
    @ApiOperation({ summary: 'Check S3 configuration status' })
    @ApiResponse({ status: 200, description: 'S3 configuration status' })
    async getStatus() {
        return {
            s3Configured: this.uploadService.isS3Configured(),
            message: this.uploadService.isS3Configured()
                ? 'S3 đã được cấu hình và sẵn sàng sử dụng'
                : 'S3 chưa được cấu hình. Video sẽ sử dụng YouTube URL.',
        };
    }

    @Post('video')
    @ApiOperation({ summary: 'Upload video to S3' })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({ status: 200, description: 'Video uploaded successfully' })
    @UseInterceptors(FileInterceptor('file'))
    async uploadVideo(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('Vui lòng chọn file để upload');
        }

        // Validate file type
        if (!this.uploadService.validateFileType(file.mimetype, 'video')) {
            throw new BadRequestException('Định dạng video không hỗ trợ. Vui lòng sử dụng MP4, WebM hoặc MOV.');
        }

        // Validate file size
        const maxSize = this.uploadService.getMaxFileSize('video');
        if (file.size > maxSize) {
            throw new BadRequestException(`File quá lớn. Kích thước tối đa là ${maxSize / (1024 * 1024)}MB.`);
        }

        const url = await this.uploadService.uploadFile(
            file.buffer,
            file.originalname,
            file.mimetype,
            'videos',
        );

        return { url };
    }

    @Post('image')
    @ApiOperation({ summary: 'Upload image to S3' })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({ status: 200, description: 'Image uploaded successfully' })
    @UseInterceptors(FileInterceptor('file'))
    async uploadImage(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('Vui lòng chọn file để upload');
        }

        // Validate file type
        if (!this.uploadService.validateFileType(file.mimetype, 'image')) {
            throw new BadRequestException('Định dạng ảnh không hỗ trợ. Vui lòng sử dụng JPG, PNG, WebP hoặc GIF.');
        }

        // Validate file size
        const maxSize = this.uploadService.getMaxFileSize('image');
        if (file.size > maxSize) {
            throw new BadRequestException(`File quá lớn. Kích thước tối đa là ${maxSize / (1024 * 1024)}MB.`);
        }

        const url = await this.uploadService.uploadFile(
            file.buffer,
            file.originalname,
            file.mimetype,
            'images',
        );

        return { url };
    }

    @Post('audio')
    @ApiOperation({ summary: 'Upload audio to S3' })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({ status: 200, description: 'Audio uploaded successfully' })
    @UseInterceptors(FileInterceptor('file'))
    async uploadAudio(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('Vui lòng chọn file để upload');
        }

        // Validate file type
        if (!this.uploadService.validateFileType(file.mimetype, 'audio')) {
            throw new BadRequestException('Định dạng audio không hỗ trợ. Vui lòng sử dụng MP3, WAV hoặc OGG.');
        }

        // Validate file size
        const maxSize = this.uploadService.getMaxFileSize('audio');
        if (file.size > maxSize) {
            throw new BadRequestException(`File quá lớn. Kích thước tối đa là ${maxSize / (1024 * 1024)}MB.`);
        }

        const url = await this.uploadService.uploadFile(
            file.buffer,
            file.originalname,
            file.mimetype,
            'audio',
        );

        return { url };
    }
}
