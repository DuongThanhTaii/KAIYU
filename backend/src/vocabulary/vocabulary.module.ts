import { Module } from '@nestjs/common';
import { VocabularyService } from './vocabulary.service';
import { VocabularyController } from './vocabulary.controller';
import { VocabularyExamplesService } from './vocabulary-examples.service';

@Module({
    controllers: [VocabularyController],
    providers: [VocabularyService, VocabularyExamplesService],
    exports: [VocabularyService, VocabularyExamplesService],
})
export class VocabularyModule { }

