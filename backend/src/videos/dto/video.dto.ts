import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional, IsBoolean, IsArray, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVideoDto {
    @ApiProperty({ example: 'Ordering Coffee in Beijing' })
    @IsString()
    title: string;

    @ApiPropertyOptional({ example: 'Learn how to order coffee in Chinese' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: 'https://example.com/video.mp4' })
    @IsString()
    videoUrl: string;

    @ApiPropertyOptional({ example: 'https://example.com/thumbnail.jpg' })
    @IsOptional()
    @IsString()
    thumbnailUrl?: string;

    @ApiPropertyOptional({ example: 300 })
    @IsOptional()
    @IsInt()
    @Min(0)
    durationSeconds?: number;

    @ApiProperty({ example: 2, minimum: 1, maximum: 6 })
    @IsInt()
    @Min(1)
    @Max(6)
    hskLevel: number;

    @ApiPropertyOptional({ example: 'Daily Life' })
    @IsOptional()
    @IsString()
    category?: string;

    @ApiPropertyOptional({ example: 'Beijing' })
    @IsOptional()
    @IsString()
    accent?: string;

    @ApiPropertyOptional({ example: ['cn', 'en', 'vi'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    subtitleLanguages?: string[];

    @ApiPropertyOptional({ example: 20 })
    @IsOptional()
    @IsInt()
    @Min(0)
    xpReward?: number;
}

export class UpdateVideoDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    title?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    videoUrl?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    thumbnailUrl?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    @Min(0)
    durationSeconds?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(6)
    hskLevel?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    category?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    accent?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    subtitleLanguages?: string[];

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    @Min(0)
    xpReward?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isPublished?: boolean;
}

export class VideoQueryDto {
    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ example: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    limit?: number = 10;

    @ApiPropertyOptional({ example: 2 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(6)
    hskLevel?: number;

    @ApiPropertyOptional({ example: 'Daily Life' })
    @IsOptional()
    @IsString()
    category?: string;

    @ApiPropertyOptional({ example: 'coffee' })
    @IsOptional()
    @IsString()
    search?: string;
}
