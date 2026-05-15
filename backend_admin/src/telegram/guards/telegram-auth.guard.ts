import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const telegramId =
      request.body?.telegram_id || request.query?.telegram_id;

    if (!telegramId) {
      throw new UnauthorizedException('telegram_id is required');
    }

    // Check Redis cache first
    const cacheKey = `telegram_driver:${telegramId}`;
    const cached = await this.redis.getClient().get(cacheKey);

    if (cached) {
      request.driver = JSON.parse(cached);
      return true;
    }

    // Fallback to DB
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      throw new UnauthorizedException(
        'Driver not found or not registered with Telegram',
      );
    }

    // Cache for 30 days
    await this.redis
      .getClient()
      .setex(cacheKey, 30 * 24 * 60 * 60, JSON.stringify(driver));

    request.driver = driver;
    return true;
  }
}
