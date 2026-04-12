import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  Max,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Example sentence structure
export class ExampleSentenceDto {
  @ApiProperty({ description: 'Chinese sentence', example: '我是学生' })
  @IsString()
  chinese: string;

  @ApiPropertyOptional({ description: 'Pinyin', example: 'wǒ shì xuésheng' })
  @IsString()
  @IsOptional()
  pinyin?: string;

  @ApiProperty({
    description: 'Vietnamese translation',
    example: 'Tôi là học sinh',
  })
  @IsString()
  vietnamese: string;
}

// Related word structure
export class RelatedWordDto {
  @ApiProperty({ description: 'Hanzi', example: '棒' })
  @IsString()
  hanzi: string;

  @ApiProperty({ description: 'Pinyin', example: 'bàng' })
  @IsString()
  pinyin: string;

  @ApiProperty({ description: 'Vietnamese meaning', example: 'tuyệt vời' })
  @IsString()
  meaningVi: string;
}

// Multi-meaning entry for words with multiple readings/meanings
export class MeaningEntryDto {
  @ApiProperty({ description: 'Part of speech', example: 'adj' })
  @IsString()
  partOfSpeech: string;

  @ApiProperty({ description: 'Pinyin for this reading', example: 'hǎo' })
  @IsString()
  pinyin: string;

  @ApiProperty({
    description: 'Array of meanings for this reading',
    example: ['tốt', 'đẹp', 'khỏe'],
  })
  @IsArray()
  @IsString({ each: true })
  meanings: string[];
}

export class CreateVocabularyDto {
  @ApiProperty({ description: 'Chinese character(s)', example: '好' })
  @IsString()
  hanzi: string;

  @ApiProperty({
    description: 'Primary pinyin with tone marks',
    example: 'hǎo',
  })
  @IsString()
  pinyin: string;

  @ApiProperty({
    description:
      'Primary Vietnamese meaning (also generated from meanings array)',
    example: 'tốt, thích',
  })
  @IsString()
  meaningVi: string;

  @ApiPropertyOptional({
    description: 'English meaning (optional)',
    example: 'good, to like',
  })
  @IsString()
  @IsOptional()
  meaningEn?: string;

  @ApiPropertyOptional({ description: 'Radical character', example: '女' })
  @IsString()
  @IsOptional()
  radical?: string;

  @ApiPropertyOptional({
    description: 'Radical meaning in Vietnamese',
    example: 'nữ, phụ nữ',
  })
  @IsString()
  @IsOptional()
  radicalMeaning?: string;

  @ApiPropertyOptional({ description: 'Number of strokes', example: 6 })
  @IsNumber()
  @IsOptional()
  strokeCount?: number;

  @ApiPropertyOptional({
    description: 'Part of speech (for simple single-meaning words)',
    example: 'adj',
  })
  @IsString()
  @IsOptional()
  partOfSpeech?: string;

  @ApiProperty({ description: 'HSK level (1-6)', example: 1 })
  @IsNumber()
  @Min(1)
  @Max(6)
  hskLevel: number;

  @ApiPropertyOptional({ description: 'Tags', example: ['common', 'greeting'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Audio URL' })
  @IsString()
  @IsOptional()
  audioUrl?: string;

  @ApiPropertyOptional({
    description: 'Example sentences',
    type: [ExampleSentenceDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExampleSentenceDto)
  @IsOptional()
  examples?: ExampleSentenceDto[];

  @ApiPropertyOptional({ description: 'Synonyms', type: [RelatedWordDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RelatedWordDto)
  @IsOptional()
  synonyms?: RelatedWordDto[];

  @ApiPropertyOptional({ description: 'Antonyms', type: [RelatedWordDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RelatedWordDto)
  @IsOptional()
  antonyms?: RelatedWordDto[];

  @ApiPropertyOptional({ description: 'Mnemonic for memorization' })
  @IsString()
  @IsOptional()
  mnemonic?: string;

  @ApiPropertyOptional({
    description: 'Multiple meanings/readings for the word',
    type: [MeaningEntryDto],
    example: [
      { partOfSpeech: 'adj', pinyin: 'hǎo', meanings: ['tốt', 'đẹp'] },
      { partOfSpeech: 'verb', pinyin: 'hào', meanings: ['thích'] },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeaningEntryDto)
  @IsOptional()
  meanings?: MeaningEntryDto[];
}

export class UpdateVocabularyDto {
  @ApiPropertyOptional({ description: 'Chinese character(s)', example: '好' })
  @IsString()
  @IsOptional()
  hanzi?: string;

  @ApiPropertyOptional({
    description: 'Pinyin with tone marks',
    example: 'hǎo',
  })
  @IsString()
  @IsOptional()
  pinyin?: string;

  @ApiPropertyOptional({
    description: 'Vietnamese meaning',
    example: 'tốt, thích',
  })
  @IsString()
  @IsOptional()
  meaningVi?: string;

  @ApiPropertyOptional({
    description: 'English meaning',
    example: 'good, to like',
  })
  @IsString()
  @IsOptional()
  meaningEn?: string;

  @ApiPropertyOptional({ description: 'Radical character', example: '女' })
  @IsString()
  @IsOptional()
  radical?: string;

  @ApiPropertyOptional({
    description: 'Radical meaning in Vietnamese',
    example: 'nữ, phụ nữ',
  })
  @IsString()
  @IsOptional()
  radicalMeaning?: string;

  @ApiPropertyOptional({ description: 'Number of strokes', example: 6 })
  @IsNumber()
  @IsOptional()
  strokeCount?: number;

  @ApiPropertyOptional({ description: 'Part of speech', example: 'adj,verb' })
  @IsString()
  @IsOptional()
  partOfSpeech?: string;

  @ApiPropertyOptional({ description: 'HSK level (1-6)', example: 1 })
  @IsNumber()
  @Min(1)
  @Max(6)
  @IsOptional()
  hskLevel?: number;

  @ApiPropertyOptional({ description: 'Tags', example: ['common', 'greeting'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Audio URL' })
  @IsString()
  @IsOptional()
  audioUrl?: string;

  @ApiPropertyOptional({
    description: 'Example sentences',
    type: [ExampleSentenceDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExampleSentenceDto)
  @IsOptional()
  examples?: ExampleSentenceDto[];

  @ApiPropertyOptional({ description: 'Synonyms', type: [RelatedWordDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RelatedWordDto)
  @IsOptional()
  synonyms?: RelatedWordDto[];

  @ApiPropertyOptional({ description: 'Antonyms', type: [RelatedWordDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RelatedWordDto)
  @IsOptional()
  antonyms?: RelatedWordDto[];

  @ApiPropertyOptional({ description: 'Mnemonic for memorization' })
  @IsString()
  @IsOptional()
  mnemonic?: string;

  @ApiPropertyOptional({
    description: 'Multiple meanings/readings for the word',
    type: [MeaningEntryDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeaningEntryDto)
  @IsOptional()
  meanings?: MeaningEntryDto[];
}

// Import from XLSX/CSV
export class ImportVocabularyItemDto {
  @IsString()
  hanzi: string;

  @IsString()
  @IsOptional()
  pinyin?: string;

  @IsString()
  @IsOptional()
  meaningVi?: string;

  @IsString()
  @IsOptional()
  meaningEn?: string;

  @IsString()
  @IsOptional()
  radical?: string;

  @IsString()
  @IsOptional()
  radicalMeaning?: string;

  @IsNumber()
  @IsOptional()
  strokeCount?: number;

  @IsString()
  @IsOptional()
  partOfSpeech?: string;

  @IsNumber()
  @Min(0)
  @Max(9)
  @IsOptional()
  hskLevel?: number;

  @IsArray()
  @IsOptional()
  tags?: string[];

  // Flattened examples for XLSX import
  @IsString()
  @IsOptional()
  example1_cn?: string;

  @IsString()
  @IsOptional()
  example1_py?: string;

  @IsString()
  @IsOptional()
  example1_vi?: string;

  @IsString()
  @IsOptional()
  example2_cn?: string;

  @IsString()
  @IsOptional()
  example2_py?: string;

  @IsString()
  @IsOptional()
  example2_vi?: string;

  @IsString()
  @IsOptional()
  example3_cn?: string;

  @IsString()
  @IsOptional()
  example3_py?: string;

  @IsString()
  @IsOptional()
  example3_vi?: string;

  // Flattened synonyms/antonyms for XLSX import
  @IsString()
  @IsOptional()
  synonym1?: string;

  @IsString()
  @IsOptional()
  synonym1_py?: string;

  @IsString()
  @IsOptional()
  synonym1_vi?: string;

  @IsString()
  @IsOptional()
  synonym2?: string;

  @IsString()
  @IsOptional()
  synonym2_py?: string;

  @IsString()
  @IsOptional()
  synonym2_vi?: string;

  @IsString()
  @IsOptional()
  antonym1?: string;

  @IsString()
  @IsOptional()
  antonym1_py?: string;

  @IsString()
  @IsOptional()
  antonym1_vi?: string;

  @IsString()
  @IsOptional()
  antonym2?: string;

  @IsString()
  @IsOptional()
  antonym2_py?: string;

  @IsString()
  @IsOptional()
  antonym2_vi?: string;

  @IsString()
  @IsOptional()
  mnemonic?: string;
}

export class ImportRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportVocabularyItemDto)
  items: ImportVocabularyItemDto[];

  @IsOptional()
  @IsString()
  // 'skip' = ignore existing hanzi
  // 'overwrite' = update existing hanzi with imported data
  duplicateAction?: 'skip' | 'overwrite';
}

export class ImportVocabularyDto {
  @ApiProperty({
    description: 'List of vocabulary items to import',
    type: [ImportVocabularyItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportVocabularyItemDto)
  items: ImportVocabularyItemDto[];
}

export class ImportResultDto {
  @ApiProperty({ description: 'Number of items created' })
  created: number;

  @ApiProperty({ description: 'Number of items skipped (duplicates)' })
  skipped: number;

  @ApiPropertyOptional({ description: 'Number of items merged into meanings' })
  merged?: number;

  @ApiProperty({ description: 'Number of items with errors' })
  errors: number;

  @ApiPropertyOptional({ description: 'Error details' })
  errorDetails?: { hanzi: string; error: string }[];

  @ApiPropertyOptional({ description: 'Skipped item details with reasons' })
  skippedDetails?: { hanzi: string; reason: string }[];
}
