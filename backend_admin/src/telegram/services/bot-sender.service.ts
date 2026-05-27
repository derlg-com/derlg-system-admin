import { Injectable, Logger } from '@nestjs/common';

interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

interface SendMessageOptions {
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_markup?: {
    inline_keyboard: InlineKeyboardButton[][];
  };
}

@Injectable()
export class BotSenderService {
  private readonly logger = new Logger(BotSenderService.name);
  private readonly baseUrl: string;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  private async post<T>(method: string, body: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}/${method}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json() as { ok: boolean; description?: string; result?: T };

      if (!data.ok) {
        this.logger.warn(`Telegram API error (${method}): ${data.description}`);
        throw new Error(data.description || `Telegram API error: ${method}`);
      }

      return data.result as T;
    } catch (err) {
      this.logger.error(`Failed to call Telegram API ${method}: ${err.message}`);
      throw err;
    }
  }

  async sendMessage(
    chatId: string | number,
    text: string,
    options?: SendMessageOptions,
  ): Promise<{ message_id: number }> {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
    };

    if (options?.parse_mode) {
      body.parse_mode = options.parse_mode;
    }

    if (options?.reply_markup) {
      body.reply_markup = JSON.stringify(options.reply_markup);
    }

    return this.post<{ message_id: number }>('sendMessage', body);
  }

  async sendPhoto(
    chatId: string | number,
    photoUrl: string,
    caption?: string,
    options?: SendMessageOptions,
  ): Promise<{ message_id: number }> {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      photo: photoUrl,
    };

    if (caption) {
      body.caption = caption;
    }

    if (options?.parse_mode) {
      body.parse_mode = options.parse_mode;
    }

    if (options?.reply_markup) {
      body.reply_markup = JSON.stringify(options.reply_markup);
    }

    return this.post<{ message_id: number }>('sendPhoto', body);
  }

  async editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    options?: SendMessageOptions,
  ): Promise<{ message_id: number }> {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      message_id: messageId,
      text,
    };

    if (options?.parse_mode) {
      body.parse_mode = options.parse_mode;
    }

    if (options?.reply_markup) {
      body.reply_markup = JSON.stringify(options.reply_markup);
    }

    return this.post<{ message_id: number }>('editMessageText', body);
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
  ): Promise<boolean> {
    const body: Record<string, unknown> = {
      callback_query_id: callbackQueryId,
    };

    if (text) {
      body.text = text;
    }

    return this.post<boolean>('answerCallbackQuery', body);
  }

  async setWebhook(url: string, secretToken?: string): Promise<boolean> {
    const body: Record<string, unknown> = {
      url,
      allowed_updates: ['message', 'callback_query', 'edited_message'],
      max_connections: 40,
    };

    if (secretToken) {
      body.secret_token = secretToken;
    }

    return this.post<boolean>('setWebhook', body);
  }

  async getWebhookInfo(): Promise<{
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    ip_address?: string;
    last_error_date?: number;
    last_error_message?: string;
    max_connections?: number;
  }> {
    return this.post('getWebhookInfo', {});
  }

  async deleteWebhook(): Promise<boolean> {
    return this.post<boolean>('deleteWebhook', {});
  }
}
