import { Controller, Get, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MinioService } from '../minio/minio.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly minio: MinioService,
  ) {}

  @Get()
  async checkAll() {
    const [postgres, redis, minio] = await Promise.all([
      this.prisma.healthCheck(),
      this.redis.healthCheck(),
      this.minio.healthCheck(),
    ]);

    const allOk = postgres.status === 'ok' && redis.status === 'ok' && minio.status === 'ok';

    return {
      success: allOk,
      data: {
        postgres,
        redis,
        minio,
      },
      message: allOk ? 'All services are healthy' : 'One or more services are unhealthy',
      error: allOk ? null : 'Service health check failed',
    };
  }

  @Get('postgres')
  async checkPostgres() {
    const result = await this.prisma.healthCheck();
    return {
      success: result.status === 'ok',
      data: result,
      message: result.status === 'ok' ? 'PostgreSQL is connected' : 'PostgreSQL connection failed',
      error: result.status === 'ok' ? null : result.error,
    };
  }

  @Get('redis')
  async checkRedis() {
    const result = await this.redis.healthCheck();
    return {
      success: result.status === 'ok',
      data: result,
      message: result.status === 'ok' ? 'Redis is connected' : 'Redis connection failed',
      error: result.status === 'ok' ? null : result.response,
    };
  }

  @Get('minio')
  async checkMinio() {
    const result = await this.minio.healthCheck();
    return {
      success: result.status === 'ok',
      data: result,
      message: result.status === 'ok' ? 'MinIO is connected' : 'MinIO connection failed',
      error: result.status === 'ok' ? null : result.error,
    };
  }
}
