import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

type AdminIdentity = {
  id: string;
  email: string;
  role: string;
};

export type AnalyticsWindow = '1h' | '6h' | '24h' | '7d';

export interface AnalyticsPermissions {
  canViewRealtime: boolean;
  canViewInfrastructure: boolean;
  canManageAnalytics: boolean;
  minStreamIntervalSec: number;
  maxStreamIntervalSec: number;
  defaultStreamIntervalSec: number;
}

interface TimelinePoint {
  label: string;
  requests: number;
}

export interface NginxIngestRow {
  time: string;
  host?: string;
  method?: string;
  uri?: string;
  status?: number;
  bytes?: number;
  ip?: string;
  country?: string;
  ua?: string;
  rt?: number;
}

interface TrafficLogRow {
  id: string;
  ts: string;
  host: string;
  method: string;
  path: string;
  status: number;
  bytes: number;
  ip: string;
  country: string;
  requestTimeMs: number;
}

export interface AnalyticsSnapshot {
  generatedAt: string;
  window: AnalyticsWindow;
  mode: 'cloudflare' | 'nginx' | 'fallback';
  domain: string;
  permissions: AnalyticsPermissions;
  overview: {
    totalRequests: number;
    bandwidthMB: number;
    activeLearners5m: number;
    error4xx: number;
    error5xx: number;
  };
  product: {
    videoViewsPerMin: number;
    flashcardsPerMin: number;
    activeLearners5m: number;
  };
  topCountries: Array<{ country: string; requests: number }>;
  topIps: Array<{ ip: string; requests: number }>;
  topRequests: Array<{ request: string; requests: number }>;
  topPaths: Array<{ path: string; requests: number }>;
  timeline: TimelinePoint[];
  accessLogs: TrafficLogRow[];
  error4xxLogs: TrafficLogRow[];
  error5xxLogs: TrafficLogRow[];
  note?: string;
}

interface CloudflareSnapshot {
  totalRequests: number;
  bandwidthMB: number;
  error4xx: number;
  error5xx: number;
  timeline: TimelinePoint[];
  topCountries: Array<{ country: string; requests: number }>;
  topPaths: Array<{ path: string; requests: number }>;
}

interface NginxSnapshot {
  overview: {
    totalRequests: number;
    bandwidthMB: number;
    error4xx: number;
    error5xx: number;
  };
  topCountries: Array<{ country: string; requests: number }>;
  topIps: Array<{ ip: string; requests: number }>;
  topRequests: Array<{ request: string; requests: number }>;
  timeline: TimelinePoint[];
  accessLogs: TrafficLogRow[];
  error4xxLogs: TrafficLogRow[];
  error5xxLogs: TrafficLogRow[];
}

@Injectable()
export class AdminAnalyticsService {
  private cloudflareCache: {
    key: string;
    at: number;
    data: CloudflareSnapshot;
  } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  getPermissions(user: AdminIdentity): AnalyticsPermissions {
    const role = String(user?.role || '');
    const email = String(user?.email || '').toLowerCase();
    const isSuperAdmin = role === 'super_admin';

    const infraEmails = this.parseEmailList(
      this.configService.get<string>('ANALYTICS_INFRA_ALLOWED_EMAILS'),
    );
    const manageEmails = this.parseEmailList(
      this.configService.get<string>('ANALYTICS_MANAGE_ALLOWED_EMAILS'),
    );

    const minInterval = Math.max(
      2,
      Number(
        this.configService.get<string>('ANALYTICS_MIN_STREAM_INTERVAL_SEC') ||
          3,
      ),
    );
    const maxInterval = Math.max(
      minInterval,
      Number(
        this.configService.get<string>('ANALYTICS_MAX_STREAM_INTERVAL_SEC') ||
          30,
      ),
    );
    const defaultInterval = Math.min(
      maxInterval,
      Math.max(
        minInterval,
        Number(
          this.configService.get<string>(
            'ANALYTICS_DEFAULT_STREAM_INTERVAL_SEC',
          ) || 5,
        ),
      ),
    );

    const canViewRealtime = role === 'admin' || isSuperAdmin;
    const canViewInfrastructure =
      canViewRealtime &&
      (isSuperAdmin || infraEmails.size === 0 || infraEmails.has(email));
    const canManageAnalytics = isSuperAdmin || manageEmails.has(email);

    return {
      canViewRealtime,
      canViewInfrastructure,
      canManageAnalytics,
      minStreamIntervalSec: minInterval,
      maxStreamIntervalSec: maxInterval,
      defaultStreamIntervalSec: defaultInterval,
    };
  }

  resolveStreamInterval(user: AdminIdentity, requested?: number): number {
    const permissions = this.getPermissions(user);
    const value = Number.isFinite(requested)
      ? Number(requested)
      : permissions.defaultStreamIntervalSec;
    return Math.min(
      permissions.maxStreamIntervalSec,
      Math.max(permissions.minStreamIntervalSec, value),
    );
  }

  async getRealtimeSnapshot(
    user: AdminIdentity,
    window: AnalyticsWindow = '1h',
  ): Promise<AnalyticsSnapshot> {
    const permissions = this.getPermissions(user);
    if (!permissions.canViewRealtime) {
      throw new ForbiddenException('Bạn không có quyền xem analytics realtime');
    }

    const normalizedWindow = this.normalizeWindow(window);
    const domain = this.normalizeHost(
      this.configService.get<string>('ANALYTICS_DISPLAY_DOMAIN') ||
      this.configService.get<string>('CLOUDFLARE_ANALYTICS_DOMAIN') ||
      this.extractDomainFromFrontendUrl(),
    );

    const internal = await this.getInternalSnapshot(normalizedWindow);
    const nginx = await this.getNginxSnapshot(normalizedWindow, domain);
    let cloudflare: CloudflareSnapshot | null = null;

    if (permissions.canViewInfrastructure) {
      cloudflare = await this.getCloudflareSnapshot(normalizedWindow);
    }

    if (nginx && nginx.overview.totalRequests > 0) {
      return {
        generatedAt: new Date().toISOString(),
        window: normalizedWindow,
        mode: 'nginx',
        domain,
        permissions,
        overview: {
          totalRequests: nginx.overview.totalRequests,
          bandwidthMB: nginx.overview.bandwidthMB,
          activeLearners5m: internal.activeLearners5m,
          error4xx: nginx.overview.error4xx,
          error5xx: nginx.overview.error5xx,
        },
        product: {
          videoViewsPerMin: internal.videoViewsPerMin,
          flashcardsPerMin: internal.flashcardsPerMin,
          activeLearners5m: internal.activeLearners5m,
        },
        topCountries: nginx.topCountries,
        topIps: nginx.topIps,
        topRequests: nginx.topRequests,
        topPaths: nginx.topRequests.map((x) => ({
          path: x.request,
          requests: x.requests,
        })),
        timeline: nginx.timeline,
        accessLogs: nginx.accessLogs,
        error4xxLogs: nginx.error4xxLogs,
        error5xxLogs: nginx.error5xxLogs,
      };
    }

    if (cloudflare) {
      return {
        generatedAt: new Date().toISOString(),
        window: normalizedWindow,
        mode: 'cloudflare',
        domain,
        permissions,
        overview: {
          totalRequests: cloudflare.totalRequests,
          bandwidthMB: cloudflare.bandwidthMB,
          activeLearners5m: internal.activeLearners5m,
          error4xx: cloudflare.error4xx,
          error5xx: cloudflare.error5xx,
        },
        product: {
          videoViewsPerMin: internal.videoViewsPerMin,
          flashcardsPerMin: internal.flashcardsPerMin,
          activeLearners5m: internal.activeLearners5m,
        },
        topCountries: cloudflare.topCountries,
        topIps: [],
        topRequests: cloudflare.topPaths.map((x) => ({
          request: x.path,
          requests: x.requests,
        })),
        topPaths:
          cloudflare.topPaths.length > 0
            ? cloudflare.topPaths
            : internal.topPaths,
        timeline:
          cloudflare.timeline.length > 0
            ? cloudflare.timeline
            : internal.timeline,
        accessLogs: [],
        error4xxLogs: [],
        error5xxLogs: [],
      };
    }

    return {
      generatedAt: new Date().toISOString(),
      window: normalizedWindow,
      mode: 'fallback',
      domain,
      permissions,
      overview: {
        totalRequests: internal.totalRequests,
        bandwidthMB: 0,
        activeLearners5m: internal.activeLearners5m,
        error4xx: 0,
        error5xx: 0,
      },
      product: {
        videoViewsPerMin: internal.videoViewsPerMin,
        flashcardsPerMin: internal.flashcardsPerMin,
        activeLearners5m: internal.activeLearners5m,
      },
      topCountries: [],
      topIps: [],
      topRequests: internal.topPaths.map((x) => ({
        request: x.path,
        requests: x.requests,
      })),
      topPaths: internal.topPaths,
      timeline: internal.timeline,
      accessLogs: [],
      error4xxLogs: [],
      error5xxLogs: [],
      note: 'Chưa kết nối Cloudflare API hoặc token không có quyền Analytics. Đang hiển thị dữ liệu nội bộ theo thời gian thực.',
    };
  }

  private async getInternalSnapshot(window: AnalyticsWindow) {
    const now = new Date();
    const windowMinutes = this.getWindowMinutes(window);
    const since = new Date(now.getTime() - windowMinutes * 60 * 1000);
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    const [
      totalRequests,
      videoViewsPerMin,
      flashcardsPerMin,
      videoUsers,
      flashcardUsers,
      viewedUsers,
      topVideoGroups,
    ] = await Promise.all([
      this.prisma.videoView.count({ where: { viewedAt: { gte: since } } }),
      this.prisma.videoView.count({
        where: { viewedAt: { gte: oneMinuteAgo } },
      }),
      this.prisma.flashcardReview.count({
        where: { lastReviewAt: { gte: oneMinuteAgo } },
      }),
      this.prisma.videoProgress.findMany({
        where: { lastWatchedAt: { gte: fiveMinutesAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.flashcardReview.findMany({
        where: { lastReviewAt: { gte: fiveMinutesAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.videoView.findMany({
        where: { viewedAt: { gte: fiveMinutesAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.videoView.groupBy({
        by: ['videoId'],
        where: { viewedAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { videoId: 'desc' } },
        take: 5,
      }),
    ]);

    const uniqueUsers = new Set<string>();
    for (const row of videoUsers) uniqueUsers.add(row.userId);
    for (const row of flashcardUsers) uniqueUsers.add(row.userId);
    for (const row of viewedUsers) uniqueUsers.add(row.userId);

    const videoMap = await this.prisma.video.findMany({
      where: { id: { in: topVideoGroups.map((x) => x.videoId) } },
      select: { id: true, title: true },
    });
    const titleByVideoId = new Map(videoMap.map((v) => [v.id, v.title]));

    const topPaths = topVideoGroups.map((row) => {
      const title = titleByVideoId.get(row.videoId) || row.videoId.slice(0, 8);
      return {
        path: `/video/${title}`,
        requests: row._count._all,
      };
    });

    const timeline = await this.buildInternalTimeline(window, now);

    return {
      totalRequests,
      videoViewsPerMin,
      flashcardsPerMin,
      activeLearners5m: uniqueUsers.size,
      topPaths,
      timeline,
    };
  }

  private async buildInternalTimeline(
    window: AnalyticsWindow,
    now: Date,
  ): Promise<TimelinePoint[]> {
    const windowMinutes = this.getWindowMinutes(window);
    const points = 24;
    const stepMinutes = Math.max(1, Math.round(windowMinutes / points));

    const results: TimelinePoint[] = [];
    for (let i = points - 1; i >= 0; i--) {
      const end = new Date(now.getTime() - i * stepMinutes * 60 * 1000);
      const start = new Date(end.getTime() - stepMinutes * 60 * 1000);

      const requests = await this.prisma.videoView.count({
        where: {
          viewedAt: {
            gte: start,
            lt: end,
          },
        },
      });

      results.push({
        label: this.formatTimeLabel(end),
        requests,
      });
    }

    return results;
  }

  private async getCloudflareSnapshot(
    window: AnalyticsWindow,
  ): Promise<CloudflareSnapshot | null> {
    const zoneId = this.configService.get<string>('CLOUDFLARE_ZONE_ID');
    const token = this.configService.get<string>('CLOUDFLARE_API_TOKEN');

    if (!zoneId || !token) {
      return null;
    }

    const cacheKey = `${zoneId}:${window}`;
    const now = Date.now();
    if (
      this.cloudflareCache &&
      this.cloudflareCache.key === cacheKey &&
      now - this.cloudflareCache.at < 20000
    ) {
      return this.cloudflareCache.data;
    }

    try {
      const until = new Date();
      const since = new Date(
        until.getTime() - this.getWindowMinutes(window) * 60 * 1000,
      );

      const query = `
        query Realtime($zoneTag: String!, $since: Time!, $until: Time!) {
          viewer {
            zones(filter: { zoneTag: $zoneTag }) {
              timeline: httpRequests1mGroups(
                limit: 120
                orderBy: [datetimeMinute_ASC]
                filter: { datetimeMinute_geq: $since, datetimeMinute_leq: $until }
              ) {
                dimensions { datetimeMinute }
                sum { requests bytes responseStatusMap }
              }
              topCountries: httpRequests1mGroups(
                limit: 5
                orderBy: [sum_requests_DESC]
                filter: { datetimeMinute_geq: $since, datetimeMinute_leq: $until }
              ) {
                dimensions { clientCountryName }
                sum { requests }
              }
              topPaths: httpRequests1mGroups(
                limit: 5
                orderBy: [sum_requests_DESC]
                filter: { datetimeMinute_geq: $since, datetimeMinute_leq: $until }
              ) {
                dimensions { clientRequestPath }
                sum { requests }
              }
            }
          }
        }
      `;

      const response = await fetch(
        'https://api.cloudflare.com/client/v4/graphql',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            query,
            variables: {
              zoneTag: zoneId,
              since: since.toISOString(),
              until: until.toISOString(),
            },
          }),
        },
      );

      if (!response.ok) {
        return null;
      }

      const payload = await response.json();
      const zone = payload?.data?.viewer?.zones?.[0];
      if (!zone) {
        return null;
      }

      const timelineRows = Array.isArray(zone.timeline) ? zone.timeline : [];
      let totalRequests = 0;
      let totalBytes = 0;
      let error4xx = 0;
      let error5xx = 0;

      const timeline: TimelinePoint[] = timelineRows.map((row: any) => {
        const req = Number(row?.sum?.requests || 0);
        const bytes = Number(row?.sum?.bytes || 0);
        totalRequests += req;
        totalBytes += bytes;

        const statusMap = Array.isArray(row?.sum?.responseStatusMap)
          ? row.sum.responseStatusMap
          : [];
        for (const item of statusMap) {
          const origin = String(item?.edgeResponseStatus || item?.status || '');
          const count = Number(item?.requests || item?.count || 0);
          if (origin.startsWith('4')) {
            error4xx += count;
          } else if (origin.startsWith('5')) {
            error5xx += count;
          }
        }

        return {
          label: this.formatTimeLabel(
            new Date(row?.dimensions?.datetimeMinute || new Date()),
          ),
          requests: req,
        };
      });

      const topCountries = (
        Array.isArray(zone.topCountries) ? zone.topCountries : []
      ).map((row: any) => ({
        country: String(row?.dimensions?.clientCountryName || 'Unknown'),
        requests: Number(row?.sum?.requests || 0),
      }));

      const topPaths = (Array.isArray(zone.topPaths) ? zone.topPaths : [])
        .map((row: any) => ({
          path: String(row?.dimensions?.clientRequestPath || '/'),
          requests: Number(row?.sum?.requests || 0),
        }))
        .filter(
          (row: { path: string; requests: number }) =>
            row.path && row.requests > 0,
        );

      const snapshot: CloudflareSnapshot = {
        totalRequests,
        bandwidthMB: Number((totalBytes / (1024 * 1024)).toFixed(2)),
        error4xx,
        error5xx,
        timeline,
        topCountries,
        topPaths,
      };

      this.cloudflareCache = {
        key: cacheKey,
        at: now,
        data: snapshot,
      };

      return snapshot;
    } catch {
      return null;
    }
  }

  async ingestNginxLogs(rows: NginxIngestRow[]): Promise<{ inserted: number }> {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { inserted: 0 };
    }

    await this.ensureAnalyticsTable();

    let inserted = 0;
    for (const row of rows.slice(0, 2000)) {
      const ts = this.safeDate(row.time);
      if (!ts) continue;

      const host = this.normalizeHost(String(row.host || '').trim());
      const method = String(row.method || 'GET')
        .trim()
        .toUpperCase();
      const path = String(row.uri || '/')
        .trim()
        .slice(0, 500);
      const status = Number(row.status || 0);
      const bytes = Math.max(0, Number(row.bytes || 0));
      const ip = String(row.ip || '')
        .trim()
        .slice(0, 64);
      const country = String(row.country || 'Unknown')
        .trim()
        .slice(0, 100);
      const userAgent = String(row.ua || '')
        .trim()
        .slice(0, 500);
      const requestTimeMs = Math.max(0, Math.round(Number(row.rt || 0) * 1000));

      await this.prisma.$executeRawUnsafe(
        `
          INSERT INTO analytics_requests
            (ts, host, method, path, status, bytes, ip, country, user_agent, request_time_ms)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        ts,
        host,
        method,
        path,
        status,
        bytes,
        ip,
        country,
        userAgent,
        requestTimeMs,
      );
      inserted += 1;
    }

    return { inserted };
  }

  isValidIngestKey(key?: string): boolean {
    const expected = String(
      this.configService.get<string>('ANALYTICS_INGEST_KEY') || '',
    ).trim();
    if (!expected) {
      return false;
    }
    return String(key || '').trim() === expected;
  }

  private async getNginxSnapshot(
    window: AnalyticsWindow,
    domain: string,
  ): Promise<NginxSnapshot | null> {
    try {
      await this.ensureAnalyticsTable();
      const since = new Date(
        Date.now() - this.getWindowMinutes(window) * 60 * 1000,
      );
      const host = this.normalizeHost(String(domain || '').trim(), true);

      const [
        overviewRows,
        topCountriesRows,
        topIpRows,
        topRequestRows,
        timelineRows,
        accessRows,
        error4xxRows,
        error5xxRows,
      ] = await Promise.all([
        this.prisma.$queryRawUnsafe<any[]>(
          `
              SELECT
                COUNT(*)::int AS total_requests,
                COALESCE(SUM(bytes), 0)::bigint AS total_bytes,
                COALESCE(SUM(CASE WHEN status BETWEEN 400 AND 499 THEN 1 ELSE 0 END), 0)::int AS error_4xx,
                COALESCE(SUM(CASE WHEN status BETWEEN 500 AND 599 THEN 1 ELSE 0 END), 0)::int AS error_5xx
              FROM analytics_requests
              WHERE ts >= $1
                AND ($2 = '' OR regexp_replace(split_part(lower(host), ':', 1), '^www\\.', '') = $2)
            `,
          since,
          host,
        ),
        this.prisma.$queryRawUnsafe<any[]>(
          `
              SELECT COALESCE(NULLIF(country, ''), 'Unknown') AS country, COUNT(*)::int AS requests
              FROM analytics_requests
              WHERE ts >= $1
                AND ($2 = '' OR regexp_replace(split_part(lower(host), ':', 1), '^www\\.', '') = $2)
              GROUP BY COALESCE(NULLIF(country, ''), 'Unknown')
              ORDER BY requests DESC
              LIMIT 5
            `,
          since,
          host,
        ),
        this.prisma.$queryRawUnsafe<any[]>(
          `
              SELECT COALESCE(NULLIF(ip, ''), 'Unknown') AS ip, COUNT(*)::int AS requests
              FROM analytics_requests
              WHERE ts >= $1
                AND ($2 = '' OR regexp_replace(split_part(lower(host), ':', 1), '^www\\.', '') = $2)
              GROUP BY COALESCE(NULLIF(ip, ''), 'Unknown')
              ORDER BY requests DESC
              LIMIT 5
            `,
          since,
          host,
        ),
        this.prisma.$queryRawUnsafe<any[]>(
          `
              SELECT COALESCE(NULLIF(path, ''), '/') AS request, COUNT(*)::int AS requests
              FROM analytics_requests
              WHERE ts >= $1
                AND ($2 = '' OR regexp_replace(split_part(lower(host), ':', 1), '^www\\.', '') = $2)
              GROUP BY COALESCE(NULLIF(path, ''), '/')
              ORDER BY requests DESC
              LIMIT 5
            `,
          since,
          host,
        ),
        this.prisma.$queryRawUnsafe<any[]>(
          `
              SELECT date_trunc('minute', ts) AS bucket, COUNT(*)::int AS requests
              FROM analytics_requests
              WHERE ts >= $1
                AND ($2 = '' OR regexp_replace(split_part(lower(host), ':', 1), '^www\\.', '') = $2)
              GROUP BY bucket
              ORDER BY bucket ASC
            `,
          since,
          host,
        ),
        this.prisma.$queryRawUnsafe<any[]>(
          `
              SELECT id::text, ts, host, method, path, status, bytes::bigint, ip, country, request_time_ms
              FROM analytics_requests
              WHERE ts >= $1
                AND ($2 = '' OR regexp_replace(split_part(lower(host), ':', 1), '^www\\.', '') = $2)
              ORDER BY ts DESC
              LIMIT 50
            `,
          since,
          host,
        ),
        this.prisma.$queryRawUnsafe<any[]>(
          `
              SELECT id::text, ts, host, method, path, status, bytes::bigint, ip, country, request_time_ms
              FROM analytics_requests
              WHERE ts >= $1 AND status BETWEEN 400 AND 499
                AND ($2 = '' OR regexp_replace(split_part(lower(host), ':', 1), '^www\\.', '') = $2)
              ORDER BY ts DESC
              LIMIT 50
            `,
          since,
          host,
        ),
        this.prisma.$queryRawUnsafe<any[]>(
          `
              SELECT id::text, ts, host, method, path, status, bytes::bigint, ip, country, request_time_ms
              FROM analytics_requests
              WHERE ts >= $1 AND status BETWEEN 500 AND 599
                AND ($2 = '' OR regexp_replace(split_part(lower(host), ':', 1), '^www\\.', '') = $2)
              ORDER BY ts DESC
              LIMIT 50
            `,
          since,
          host,
        ),
      ]);

      const overview = overviewRows[0];
      return {
        overview: {
          totalRequests: Number(overview?.total_requests || 0),
          bandwidthMB: Number(
            (Number(overview?.total_bytes || 0) / (1024 * 1024)).toFixed(2),
          ),
          error4xx: Number(overview?.error_4xx || 0),
          error5xx: Number(overview?.error_5xx || 0),
        },
        topCountries: topCountriesRows.map((x) => ({
          country: String(x.country),
          requests: Number(x.requests || 0),
        })),
        topIps: topIpRows.map((x) => ({
          ip: String(x.ip),
          requests: Number(x.requests || 0),
        })),
        topRequests: topRequestRows.map((x) => ({
          request: String(x.request),
          requests: Number(x.requests || 0),
        })),
        timeline: timelineRows.map((x) => ({
          label: this.formatTimeLabel(new Date(x.bucket)),
          requests: Number(x.requests || 0),
        })),
        accessLogs: accessRows.map((x) => this.mapTrafficLogRow(x)),
        error4xxLogs: error4xxRows.map((x) => this.mapTrafficLogRow(x)),
        error5xxLogs: error5xxRows.map((x) => this.mapTrafficLogRow(x)),
      };
    } catch {
      return null;
    }
  }

  private async ensureAnalyticsTable(): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `CREATE EXTENSION IF NOT EXISTS pgcrypto;`,
    );

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS analytics_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ts TIMESTAMPTZ NOT NULL,
        host VARCHAR(255) NOT NULL DEFAULT '',
        method VARCHAR(16) NOT NULL DEFAULT 'GET',
        path VARCHAR(500) NOT NULL DEFAULT '/',
        status INTEGER NOT NULL DEFAULT 0,
        bytes BIGINT NOT NULL DEFAULT 0,
        ip VARCHAR(64) NOT NULL DEFAULT '',
        country VARCHAR(100) NOT NULL DEFAULT 'Unknown',
        user_agent VARCHAR(500) NOT NULL DEFAULT '',
        request_time_ms INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_analytics_requests_ts ON analytics_requests(ts DESC);`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_analytics_requests_host_ts ON analytics_requests(host, ts DESC);`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_analytics_requests_status_ts ON analytics_requests(status, ts DESC);`,
    );
  }

  private mapTrafficLogRow(row: any): TrafficLogRow {
    return {
      id: String(row?.id || ''),
      ts: new Date(row?.ts || Date.now()).toISOString(),
      host: String(row?.host || ''),
      method: String(row?.method || 'GET'),
      path: String(row?.path || '/'),
      status: Number(row?.status || 0),
      bytes: Number(row?.bytes || 0),
      ip: String(row?.ip || ''),
      country: String(row?.country || 'Unknown'),
      requestTimeMs: Number(row?.request_time_ms || 0),
    };
  }

  private safeDate(value: string): Date | null {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date;
  }

  private parseEmailList(raw?: string): Set<string> {
    return new Set(
      String(raw || '')
        .split(',')
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  private getWindowMinutes(window: AnalyticsWindow): number {
    switch (window) {
      case '6h':
        return 6 * 60;
      case '24h':
        return 24 * 60;
      case '7d':
        return 7 * 24 * 60;
      case '1h':
      default:
        return 60;
    }
  }

  private normalizeWindow(window?: string): AnalyticsWindow {
    if (
      window === '6h' ||
      window === '24h' ||
      window === '7d' ||
      window === '1h'
    ) {
      return window;
    }
    return '1h';
  }

  private extractDomainFromFrontendUrl(): string {
    const frontend = String(
      this.configService.get<string>('FRONTEND_URL') || '',
    )
      .split(',')[0]
      ?.trim();
    if (!frontend) {
      return 'kaiyu.io.vn';
    }

    try {
      const url = new URL(frontend);
      return url.host;
    } catch {
      return frontend.replace(/^https?:\/\//, '');
    }
  }

  private formatTimeLabel(date: Date): string {
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private normalizeHost(value: string, stripWww = false): string {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) {
      return '';
    }

    // Accept both full URL and plain host values from env/log input.
    const noProtocol = raw.replace(/^https?:\/\//, '');
    const hostWithMaybePort = noProtocol.split('/')[0] || '';
    const noPort = hostWithMaybePort.split(':')[0] || '';
    const cleaned = noPort.replace(/\.$/, '');
    return stripWww ? cleaned.replace(/^www\./, '') : cleaned;
  }
}
