import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { BotSenderService } from './bot-sender.service';
import { UpdateProcessorService } from './update-processor.service';

@Injectable()
export class PollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PollingService.name);
  private readonly isPolling: boolean;
  private offset = 0;
  private running = false;
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(
    private readonly botSender: BotSenderService,
    private readonly updateProcessor: UpdateProcessorService,
  ) {
    this.isPolling = process.env.TELEGRAM_MODE === 'polling';
  }

  async onModuleInit() {
    if (!this.isPolling) {
      this.logger.log('Telegram mode: webhook (polling disabled)');
      return;
    }

    this.logger.log('Telegram mode: polling — starting long-polling loop');

    // Ensure no webhook is set so polling works
    try {
      await this.botSender.deleteWebhook();
      this.logger.log('Deleted existing webhook to enable polling');
    } catch (err) {
      this.logger.warn(`Could not delete webhook: ${err.message}`);
    }

    this.running = true;
    this.poll();
  }

  onModuleDestroy() {
    this.running = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.logger.log('Polling stopped');
  }

  private async poll() {
    if (!this.running) return;

    try {
      const updates = await this.botSender.getUpdates(
        this.offset ? this.offset + 1 : undefined,
      );

      for (const update of updates) {
        this.offset = update.update_id;
        try {
          await this.updateProcessor.processUpdate(update);
        } catch (err) {
          this.logger.error(
            `Failed to process update ${update.update_id}: ${err.message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`Polling error: ${err.message}`);
    }

    this.timeoutId = setTimeout(() => this.poll(), 1000);
  }
}
