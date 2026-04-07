import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
// Use require for ioredis to avoid TS module resolution errors when types are missing
// and to keep compatibility with CommonJS project settings.
const IORedis = require('ioredis');

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: any = null;

  onModuleInit() {
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.client = new IORedis(url);
    this.client.on('error', (err) => console.error('Redis error', err));
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.quit();
    }
  }

  getClient(): any {
    if (!this.client) {
      const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
      this.client = new IORedis(url);
    }
    return this.client as any;
  }

  async get(key: string) {
    const client = this.getClient();
    const v = await client.get(key);
    return v;
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    const client = this.getClient();
    if (ttlSeconds) {
      await client.set(key, value, 'EX', ttlSeconds);
    } else {
      await client.set(key, value);
    }
  }

  async del(key: string) {
    const client = this.getClient();
    await client.del(key);
  }

  async incr(key: string) {
    const client = this.getClient();
    return client.incr(key);
  }
}

export default RedisService;
