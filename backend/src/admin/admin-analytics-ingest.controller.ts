import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AdminAnalyticsService,
  NginxIngestRow,
} from './admin-analytics.service';

@ApiTags('analytics-ingest')
@Controller('analytics/ingest')
export class AdminAnalyticsIngestController {
  constructor(private readonly analyticsService: AdminAnalyticsService) {}

  @Post('nginx')
  @ApiOperation({ summary: 'Ingest nginx analytics logs into Neon' })
  async ingestNginx(
    @Headers('x-analytics-ingest-key') ingestKey: string | undefined,
    @Body() rows: NginxIngestRow[],
  ) {
    if (!this.analyticsService.isValidIngestKey(ingestKey)) {
      throw new ForbiddenException('Invalid ingest key');
    }

    if (!Array.isArray(rows)) {
      throw new BadRequestException('Body must be an array of nginx log rows');
    }

    return this.analyticsService.ingestNginxLogs(rows);
  }
}
