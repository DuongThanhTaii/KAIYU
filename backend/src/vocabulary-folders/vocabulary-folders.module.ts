import { Module } from '@nestjs/common';
import { VocabularyFoldersController } from './vocabulary-folders.controller';
import { VocabularyFoldersService } from './vocabulary-folders.service';
import { PrismaModule } from '../prisma';

@Module({
  imports: [PrismaModule],
  controllers: [VocabularyFoldersController],
  providers: [VocabularyFoldersService],
  exports: [VocabularyFoldersService],
})
export class VocabularyFoldersModule {}
