import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { CommandHandler } from './handlers/command.handler';
import { CallbackHandler } from './handlers/callback.handler';
import { LocationHandler } from './handlers/location.handler';
import { MessageHandler } from './handlers/message.handler';
import { TelegramAuthGuard } from './guards/telegram-auth.guard';
import { BotSenderService } from './services/bot-sender.service';
import { PollingService } from './services/polling.service';
import { UpdateProcessorService } from './services/update-processor.service';
import { SessionService } from './services/session.service';
import { BroadcastProcessor } from './jobs/broadcast.processor';
import { AssignmentTimeoutProcessor } from './jobs/assignment-timeout.processor';
import { LocationCleanupProcessor } from './jobs/location-cleanup.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'broadcast' },
      { name: 'assignment-timeout' },
      { name: 'location-cleanup' },
    ),
    MonitoringModule,
  ],
  controllers: [TelegramController],
  providers: [
    TelegramService,
    CommandHandler,
    CallbackHandler,
    LocationHandler,
    MessageHandler,
    TelegramAuthGuard,
    BotSenderService,
    PollingService,
    UpdateProcessorService,
    SessionService,
    BroadcastProcessor,
    AssignmentTimeoutProcessor,
    LocationCleanupProcessor,
  ],
  exports: [TelegramService, BotSenderService],
})
export class TelegramModule {}
