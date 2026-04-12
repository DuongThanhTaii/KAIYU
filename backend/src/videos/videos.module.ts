import { Module } from '@nestjs/common';
import { VideosService } from './videos.service';
import { VideosController } from './videos.controller';
import { RecommendationService } from './recommendation.service';

@Module({
  controllers: [VideosController],
  providers: [VideosService, RecommendationService],
  exports: [VideosService, RecommendationService],
})
export class VideosModule {}
