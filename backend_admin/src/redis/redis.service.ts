import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  async onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,

      db: parseInt(process.env.REDIS_DB || '0', 10),
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis error:', err.message);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis connection closed');
  }

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async healthCheck(): Promise<{ status: string; response: string }> {
    try {
      const response = await this.client.ping();
      return { status: 'ok', response };
    } catch (error) {
      return { status: 'error', response: error.message };
    }
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }

  async subscribe(
    channel: string | string[],
    callback: (channel: string, message: string) => void,
  ): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.subscribe(...(Array.isArray(channel) ? channel : [channel]));
    subscriber.on('message', callback);
  }

  async psubscribe(
    pattern: string | string[],
    callback: (pattern: string, channel: string, message: string) => void,
  ): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.psubscribe(...(Array.isArray(pattern) ? pattern : [pattern]));
    subscriber.on('pmessage', callback);
  }
}
