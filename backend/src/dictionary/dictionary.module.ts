import { Module } from '@nestjs/common';
import { DictionaryController } from './dictionary.controller';
import { DictionaryService } from './dictionary.service';
import { CustomDictionaryService } from './custom-dictionary.service';
import { WordEnrichmentService } from './word-enrichment.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DictionaryController],
  providers: [
    DictionaryService,
    CustomDictionaryService,
    WordEnrichmentService,
  ],
  exports: [DictionaryService, CustomDictionaryService, WordEnrichmentService],
})
export class DictionaryModule {}
