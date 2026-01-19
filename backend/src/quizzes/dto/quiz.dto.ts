import { IsString, IsOptional, IsBoolean, IsArray, IsInt, Min } from 'class-validator';

export class CreateQuizDto {
    @IsString()
    videoId: string;

    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    description?: string;
}

export class UpdateQuizDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsBoolean()
    @IsOptional()
    isPublished?: boolean;
}

export class CreateQuestionDto {
    @IsString()
    sentenceHanzi: string;

    @IsString()
    blankWord: string;

    @IsInt()
    @Min(0)
    blankPosition: number;

    @IsArray()
    @IsString({ each: true })
    options: string[];

    @IsString()
    @IsOptional()
    meaningVi?: string;

    @IsInt()
    @Min(0)
    sequenceOrder: number;

    @IsString()
    @IsOptional()
    subtitleId?: string;
}

export class UpdateQuestionDto {
    @IsString()
    @IsOptional()
    sentenceHanzi?: string;

    @IsString()
    @IsOptional()
    blankWord?: string;

    @IsInt()
    @Min(0)
    @IsOptional()
    blankPosition?: number;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    options?: string[];

    @IsString()
    @IsOptional()
    meaningVi?: string;

    @IsInt()
    @Min(0)
    @IsOptional()
    sequenceOrder?: number;
}
