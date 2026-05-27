import { Injectable, Logger } from '@nestjs/common';
import { CommandHandler, CommandResponse } from './command.handler';
import { CallbackHandler } from './callback.handler';
import { LocationHandler } from './location.handler';
import { SessionService } from '../services/session.service';
import { TelegramService } from '../telegram.service';

@Injectable()
export class MessageHandler {
  private readonly logger = new Logger(MessageHandler.name);

  constructor(
    private readonly commandHandler: CommandHandler,
    private readonly callbackHandler: CallbackHandler,
    private readonly locationHandler: LocationHandler,
    private readonly sessionService: SessionService,
    private readonly telegramService: TelegramService,
  ) {}

  async handleUpdate(update: any): Promise<CommandResponse | null> {
    const telegramId = this.extractTelegramId(update);
    if (!telegramId) {
      this.logger.warn('No telegram_id found in update');
      return null;
    }

    // Check session state for multi-step flows
    const session = await this.sessionService.getSession(telegramId);

    if (update.callback_query) {
      return this.handleCallback(telegramId, update.callback_query);
    }

    if (update.message) {
      // Handle location sharing
      if (update.message.location) {
        return this.locationHandler.handleLocation(
          telegramId,
          update.message.location.latitude,
          update.message.location.longitude,
        );
      }

      // Handle text messages
      if (update.message.text) {
        // Check session state for support request
        if (session?.state === 'support_request') {
          return this.handleSupportMessage(telegramId, update.message.text);
        }

        // Check if text looks like registration credentials
        if (
          session?.state === 'registration' ||
          (!session && this.looksLikeCredentials(update.message.text))
        ) {
          return this.handleRegistrationMessage(telegramId, update.message.text);
        }

        // Handle commands
        if (update.message.text.startsWith('/')) {
          const parts = update.message.text.split(' ');
          const command = parts[0];
          const args = parts.slice(1);
          return this.commandHandler.handleCommand(telegramId, command, args);
        }

        // Default response
        return {
          text: 'Received your message. Use /help to see available commands.',
        };
      }
    }

    return null;
  }

  private async handleCallback(
    telegramId: string,
    callbackQuery: any,
  ): Promise<CommandResponse> {
    const data = callbackQuery.data || '';
    const response = await this.callbackHandler.handleCallback(telegramId, data);

    return response;
  }

  private async handleSupportMessage(
    telegramId: string,
    message: string,
  ): Promise<CommandResponse> {
    try {
      const result = await this.telegramService.createSupportTicket({
        telegramId,
        message,
      });

      await this.sessionService.clearSession(telegramId);

      return {
        text: `Support ticket #${result.ticketId} created. Our team will respond within 30 minutes.`,
      };
    } catch (err) {
      this.logger.error(`Failed to create support ticket: ${err.message}`);
      return {
        text: 'Failed to create support ticket. Please try again or contact dispatch directly.',
      };
    }
  }

  private async handleRegistrationMessage(
    telegramId: string,
    text: string,
  ): Promise<CommandResponse> {
    // Parse credentials: "driver_id: DRV001 pin: 1234"
    const driverIdMatch = text.match(/driver_id:\s*(\S+)/i);
    const pinMatch = text.match(/pin:\s*(\S+)/i);

    if (!driverIdMatch || !pinMatch) {
      return {
        text:
          'Invalid format. Please use:\n\n' +
          'driver_id: YOUR_ID\n' +
          'pin: YOUR_PIN\n\n' +
          'Example:\n' +
          'driver_id: DRV001\n' +
          'pin: 1234',
      };
    }

    try {
      const result = await this.telegramService.registerDriver({
        telegramId,
        driverId: driverIdMatch[1],
        pin: pinMatch[1],
      });

      return {
        text:
          `Registration successful!\n\n` +
          `Welcome, ${result.driverName}. You can now use the bot.`,
        keyboard: {
          inline_keyboard: [
            [
              { text: '🟢 Go Online', callback_data: 'status:online' },
              { text: '📊 View Status', callback_data: 'status:view' },
            ],
          ],
        },
      };
    } catch (err) {
      this.logger.error(`Registration failed: ${err.message}`);
      return {
        text:
          'Registration failed. Please check your driver ID and PIN and try again.',
      };
    }
  }

  private looksLikeCredentials(text: string): boolean {
    return /driver_id:/i.test(text) && /pin:/i.test(text);
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
}
