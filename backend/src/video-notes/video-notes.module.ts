import { Module } from '@nestjs/common';
import { VideoNotesController } from './video-notes.controller';
import { VideoNotesService } from './video-notes.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [VideoNotesController],
    providers: [VideoNotesService],
    exports: [VideoNotesService],
})
export class VideoNotesModule { }
