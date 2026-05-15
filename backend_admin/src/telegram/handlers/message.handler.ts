import { Injectable, Logger } from '@nestjs/common';
import { CommandHandler } from './command.handler';
import { CallbackHandler } from './callback.handler';
import { LocationHandler } from './location.handler';

@Injectable()
export class MessageHandler {
  private readonly logger = new Logger(MessageHandler.name);

  constructor(
    private readonly commandHandler: CommandHandler,
    private readonly callbackHandler: CallbackHandler,
    private readonly locationHandler: LocationHandler,
  ) {}

  async handleUpdate(update: any) {
    const telegramId = this.extractTelegramId(update);
    if (!telegramId) {
      this.logger.warn('No telegram_id found in update');
      return null;
    }

    // Rate limiting: 30 req/min per telegram_id
    const isAllowed = await this.checkRateLimit(telegramId);
    if (!isAllowed) {
      return { text: 'Rate limit exceeded. Please slow down.' };
    }

    // Idempotency via update_id
    const isDuplicate = await this.checkDuplicate(update.update_id);
    if (isDuplicate) {
      this.logger.debug(`Duplicate update_id: ${update.update_id}`);
      return null;
    }

    if (update.message) {
      return this.handleMessage(telegramId, update.message);
    }

    if (update.callback_query) {
      return this.handleCallback(telegramId, update.callback_query);
    }

    return null;
  }

  private async handleMessage(telegramId: string, message: any) {
    if (message.location) {
      return this.locationHandler.handleLocation(
        telegramId,
        message.location.latitude,
        message.location.longitude,
      );
    }

    if (message.text && message.text.startsWith('/')) {
      const parts = message.text.split(' ');
      const command = parts[0];
      const args = parts.slice(1);
      return this.commandHandler.handleCommand(telegramId, command, args);
    }

    // Default text response
    return {
      text: 'Received your message. Use /start for available commands.',
    };
  }

  private async handleCallback(telegramId: string, callbackQuery: any) {
    return this.callbackHandler.handleCallback(
      telegramId,
      callbackQuery.data || '',
    );
  }

  private extractTelegramId(update: any): string | null {
    if (update.message?.from?.id) {
      return String(update.message.from.id);
    }
    if (update.callback_query?.from?.id) {
      return String(update.callback_query.from.id);
    }
    return null;
  }

  private async checkRateLimit(telegramId: string): Promise<boolean> {
    // Implementation uses Redis INCR/EXPIRE
    // Simplified: always allow for now (handled in service layer)
    return true;
  }

  private async checkDuplicate(updateId: number): Promise<boolean> {
    // Implementation uses Redis SET with NX
    // Simplified: assume not duplicate (handled in service layer)
    return false;
  }
}
