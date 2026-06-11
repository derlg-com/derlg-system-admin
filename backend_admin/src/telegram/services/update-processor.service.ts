import { Injectable, Logger } from '@nestjs/common';
import { TelegramService } from '../telegram.service';
import { MessageHandler } from '../handlers/message.handler';
import { BotSenderService } from './bot-sender.service';
import { MetricsService } from '../../monitoring/metrics.service';

@Injectable()
export class UpdateProcessorService {
  private readonly logger = new Logger(UpdateProcessorService.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly messageHandler: MessageHandler,
    private readonly botSender: BotSenderService,
    private readonly metrics: MetricsService,
  ) {}

  async processUpdate(update: any) {
    const startTime = Date.now();
    const updateType = this.getUpdateType(update);

    try {
      const result = await this.telegramService.handleWebhook(update);

      if (!result) {
        this.metrics.recordWebhookRequest('duplicate', updateType);
        return {
          success: true,
          data: null,
          message: 'Duplicate or invalid update',
          error: null,
        };
      }

      const command = this.extractCommand(update);
      if (command) {
        this.metrics.recordCommandUsage(command);
      }

      const response = await this.messageHandler.handleUpdate(update);

      if (response) {
        const telegramId = this.extractTelegramId(update);
        if (telegramId) {
          try {
            await this.botSender.sendMessage(telegramId, response.text, {
              parse_mode: response.parse_mode,
              reply_markup: response.keyboard,
            });
          } catch (err) {
            this.logger.error(`Failed to send reply: ${err.message}`);
          }
        }
      }

      if (update.callback_query?.id) {
        try {
          await this.botSender.answerCallbackQuery(update.callback_query.id);
        } catch (err) {
          this.logger.error(`Failed to answer callback: ${err.message}`);
        }
      }

      this.metrics.recordWebhookRequest('success', updateType);
      this.metrics.recordResponseTime((Date.now() - startTime) / 1000);

      return {
        success: true,
        data: response,
        message: 'ok',
        error: null,
      };
    } catch (err) {
      this.metrics.recordWebhookRequest('error', updateType);
      this.metrics.recordResponseTime((Date.now() - startTime) / 1000);
      throw err;
    }
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

  private getUpdateType(update: any): string {
    if (update.message?.text?.startsWith('/')) return 'command';
    if (update.callback_query) return 'callback_query';
    if (update.message?.location) return 'location';
    if (update.message) return 'message';
    return 'unknown';
  }

  private extractCommand(update: any): string | null {
    const text = update.message?.text;
    if (typeof text === 'string' && text.startsWith('/')) {
      return text.split(' ')[0].split('@')[0];
    }
    const callbackData = update.callback_query?.data;
    if (typeof callbackData === 'string') {
      return callbackData.split(':')[0];
    }
    return null;
  }
}
