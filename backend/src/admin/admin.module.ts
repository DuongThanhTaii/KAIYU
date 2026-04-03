import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsIngestController } from './admin-analytics-ingest.controller';
import { AdminAnalyticsService } from './admin-analytics.service';

@Module({
  controllers: [
    AdminController,
    AdminAnalyticsController,
    AdminAnalyticsIngestController,
  ],
  providers: [AdminService, AdminAnalyticsService],
  exports: [AdminService, AdminAnalyticsService],
})
export class AdminModule {}
