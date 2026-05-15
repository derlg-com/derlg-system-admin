import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { CommandHandler } from './handlers/command.handler';
import { CallbackHandler } from './handlers/callback.handler';
import { LocationHandler } from './handlers/location.handler';
import { MessageHandler } from './handlers/message.handler';
import { TelegramAuthGuard } from './guards/telegram-auth.guard';
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
  ],
  controllers: [TelegramController],
  providers: [
    TelegramService,
    CommandHandler,
    CallbackHandler,
    LocationHandler,
    MessageHandler,
    TelegramAuthGuard,
    BroadcastProcessor,
    AssignmentTimeoutProcessor,
    LocationCleanupProcessor,
  ],
  exports: [TelegramService],
})
export class TelegramModule {}
