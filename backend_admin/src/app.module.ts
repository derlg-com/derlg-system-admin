import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MinioModule } from './minio/minio.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { TelegramModule } from './telegram/telegram.module';
import { MonitoringModule } from './monitoring/monitoring.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    PrismaModule,
    RedisModule,
    MinioModule,
    HealthModule,
    AuthModule,
    AdminModule,
    TelegramModule,
    MonitoringModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
