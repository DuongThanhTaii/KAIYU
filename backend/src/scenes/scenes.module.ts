import { Module } from '@nestjs/common';
import { ScenesController } from './scenes.controller';
import { ScenesService } from './scenes.service';
import { AiSceneService } from './ai-scene.service';
import { SceneAnalyticsService } from './scene-analytics.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [ScenesController],
    providers: [ScenesService, AiSceneService, SceneAnalyticsService],
    exports: [ScenesService, AiSceneService, SceneAnalyticsService],
})
export class ScenesModule { }
