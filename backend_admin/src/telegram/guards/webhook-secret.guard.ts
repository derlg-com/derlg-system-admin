import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class WebhookSecretGuard implements CanActivate {
  private readonly secret: string;

  constructor() {
    this.secret = process.env.TELEGRAM_BOT_SECRET || '';
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.secret) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const headerToken = request.headers['x-telegram-bot-api-secret-token'];

    if (!headerToken) {
      throw new UnauthorizedException('Missing webhook secret token');
    }

    if (headerToken !== this.secret) {
      throw new UnauthorizedException('Invalid webhook secret token');
    }

    return true;
  }
}
