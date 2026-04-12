import { Module } from '@nestjs/common';
import { SavedVideosController } from './saved-videos.controller';
import { SavedVideosService } from './saved-videos.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SavedVideosController],
  providers: [SavedVideosService],
  exports: [SavedVideosService],
})
export class SavedVideosModule {}
