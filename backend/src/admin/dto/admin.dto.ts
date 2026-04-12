import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateVideoDto {
  @ApiProperty({ example: 'Lesson 1: Greetings' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'https://www.youtube.com/watch?v=abc123' })
  @IsString()
  @IsNotEmpty()
  videoUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 6 })
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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subtitleLanguages?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateVideoDto extends PartialType(CreateVideoDto) {}

export class SubtitleInputDto {
  @ApiProperty()
  @IsNumber()
  startTime: number;

  @ApiProperty()
  @IsNumber()
  endTime: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  hanzi: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pinyin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  meaningEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  meaningVi?: string;
}

export class AddSubtitlesDto {
  @ApiProperty({ type: [SubtitleInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubtitleInputDto)
  subtitles: SubtitleInputDto[];
}

export class SubtitleTokenInputDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  hanzi: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pinyin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  meaning?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  hskLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partOfSpeech?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vocabularyId?: string;
}

export class UpdateSubtitleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  startTime?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  endTime?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hanzi?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pinyin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  meaningEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  meaningVi?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  updateGlobal?: boolean;

  @ApiPropertyOptional({ type: [SubtitleTokenInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubtitleTokenInputDto)
  tokens?: SubtitleTokenInputDto[];
}

export class CreateVocabularyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  hanzi: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pinyin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  meaningVi?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  meaningEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  radical?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  radicalMeaning?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  strokeCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partOfSpeech?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  hskLevel?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  audioUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mnemonic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  examples?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  synonyms?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  antonyms?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  meanings?: unknown;
}

export class UpdateVocabularyDto extends PartialType(CreateVocabularyDto) {}

export class ImportVocabularyDto {
  @ApiProperty({ type: [CreateVocabularyDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVocabularyDto)
  vocabulary: CreateVocabularyDto[];
}
