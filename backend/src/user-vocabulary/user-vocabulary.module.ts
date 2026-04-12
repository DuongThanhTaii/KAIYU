import { Module } from '@nestjs/common';
import { UserVocabularyService } from './user-vocabulary.service';
import { UserVocabularyController } from './user-vocabulary.controller';

@Module({
  controllers: [UserVocabularyController],
  providers: [UserVocabularyService],
  exports: [UserVocabularyService],
})
export class UserVocabularyModule {}
