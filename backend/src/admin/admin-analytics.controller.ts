import {
  Controller,
  Get,
  Query,
  Req,
  Sse,
  UseGuards,
  MessageEvent,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { catchError, from, map, of, switchMap, timer } from 'rxjs';
import { RolesGuard, Roles } from '../auth/guards';
import {
  AdminAnalyticsService,
  AnalyticsWindow,
} from './admin-analytics.service';

@ApiTags('admin')
@Controller('admin/analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AdminAnalyticsService) {}

  @Get('permissions')
  @ApiOperation({ summary: 'Get analytics permissions for current admin' })
  getPermissions(@Req() req: any) {
    return this.analyticsService.getPermissions(req.user);
  }

  @Get('realtime')
  @ApiOperation({ summary: 'Get realtime analytics snapshot' })
  async getRealtime(
    @Req() req: any,
    @Query('window') window?: AnalyticsWindow,
    @Query('from') fromDate?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getRealtimeSnapshot(
      req.user,
      window || '1h',
      fromDate,
      to,
    );
  }

  @Sse('stream')
  @ApiOperation({ summary: 'SSE stream for realtime analytics updates' })
  streamRealtime(
    @Req() req: any,
    @Query('window') window?: AnalyticsWindow,
    @Query('from') fromDate?: string,
    @Query('to') to?: string,
    @Query('intervalSec') intervalSec?: number,
  ) {
    const safeInterval = this.analyticsService.resolveStreamInterval(
      req.user,
      intervalSec ? Number(intervalSec) : undefined,
    );

    return timer(0, safeInterval * 1000).pipe(
      switchMap(() =>
        from(
          this.analyticsService.getRealtimeSnapshot(
            req.user,
            window || '1h',
            fromDate,
            to,
          ),
        ),
      ),
      map(
        (data): MessageEvent => ({
          type: 'analytics',
          data,
        }),
      ),
      catchError((error: any) =>
        of({
          type: 'error',
          data: {
            message: error?.message || 'Analytics stream error',
          },
        } as MessageEvent),
      ),
    );
  }
}
