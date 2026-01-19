import { Module } from '@nestjs/common';
import { DictionaryController } from './dictionary.controller';
import { DictionaryService } from './dictionary.service';
import { WordEnrichmentService } from './word-enrichment.service';
import { VocabularyModule } from '../vocabulary/vocabulary.module';

@Module({
    imports: [VocabularyModule],
    controllers: [DictionaryController],
    providers: [DictionaryService, WordEnrichmentService],
    exports: [DictionaryService, WordEnrichmentService],
})
export class DictionaryModule { }

