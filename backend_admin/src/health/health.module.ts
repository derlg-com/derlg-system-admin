import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { MinioModule } from '../minio/minio.module';
import { BotSenderService } from '../telegram/services/bot-sender.service';

@Module({
  imports: [PrismaModule, RedisModule, MinioModule],
  controllers: [HealthController],
  providers: [BotSenderService],
})
export class HealthModule {}
