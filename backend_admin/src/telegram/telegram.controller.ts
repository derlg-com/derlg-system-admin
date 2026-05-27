import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Query,
  Param,
  Headers,
  UseGuards,
  UnauthorizedException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { CommandHandler } from './handlers/command.handler';
import { CallbackHandler } from './handlers/callback.handler';
import { LocationHandler } from './handlers/location.handler';
import { MessageHandler } from './handlers/message.handler';
import { BotSenderService } from './services/bot-sender.service';
import { TelegramAuthGuard } from './guards/telegram-auth.guard';
import { WebhookSecretGuard } from './guards/webhook-secret.guard';
import { DriverStatusWebhookDto } from './dto/driver-status-webhook.dto';
import { WebhookUpdateDto } from './dto/webhook-update.dto';
import { RegisterDriverDto } from './dto/register-driver.dto';
import { StatusUpdateDto } from './dto/status-update.dto';
import { AssignmentActionDto } from './dto/assignment-action.dto';
import { LocationUpdateDto } from './dto/location-update.dto';
import { BroadcastMessageDto } from './dto/broadcast-message.dto';
import * as crypto from 'crypto';

@Controller('v1/telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly telegramService: TelegramService,
    private readonly commandHandler: CommandHandler,
    private readonly callbackHandler: CallbackHandler,
    private readonly locationHandler: LocationHandler,
    private readonly messageHandler: MessageHandler,
    private readonly botSender: BotSenderService,
  ) {
    this.webhookSecret =
      process.env.TELEGRAM_WEBHOOK_SECRET || '';
  }

  // ─── Webhook ───

  @Post('webhook')
  @UseGuards(WebhookSecretGuard)
  async handleWebhook(@Body() dto: WebhookUpdateDto) {
    const result = await this.telegramService.handleWebhook(dto as any);

    if (!result) {
      return {
        success: true,
        data: null,
        message: 'Duplicate or invalid update',
        error: null,
      };
    }

    // Route to appropriate handler
    const response = await this.messageHandler.handleUpdate(dto as any);

    // Send reply back to Telegram
    if (response) {
      const telegramId = this.extractTelegramId(dto as any);
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

    // Answer callback query if present
    if ((dto as any).callback_query?.id) {
      try {
        await this.botSender.answerCallbackQuery(
          (dto as any).callback_query.id,
        );
      } catch (err) {
        this.logger.error(`Failed to answer callback: ${err.message}`);
      }
    }

    return {
      success: true,
      data: response,
      message: 'ok',
      error: null,
    };
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

  // ─── Driver Registration ───

  @Post('register')
  async registerDriver(@Body() dto: RegisterDriverDto) {
    const result = await this.telegramService.registerDriver({
      telegramId: dto.telegram_id,
      driverId: dto.driver_id,
      pin: dto.pin,
    });

    return {
      success: true,
      data: result,
      message: 'Registration successful',
      error: null,
    };
  }

  // ─── Driver Status ───

  @Post('status')
  @UseGuards(TelegramAuthGuard)
  async updateStatus(
    @Body() dto: StatusUpdateDto,
  ) {
    const result = await this.telegramService.updateDriverStatus({
      telegramId: dto.telegram_id,
      status: dto.status,
    });

    return {
      success: true,
      data: result,
      message: 'Status updated',
      error: null,
    };
  }

  @Get('driver-info')
  @UseGuards(TelegramAuthGuard)
  async getDriverInfo(@Query('telegram_id') telegramId: string) {
    const result = await this.telegramService.getDriverInfo(telegramId);

    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  // ─── Trip Assignments ───

  @Get('assignments/active')
  @UseGuards(TelegramAuthGuard)
  async getActiveAssignments(@Query('telegram_id') telegramId: string) {
    const result =
      await this.telegramService.getActiveAssignments(telegramId);

    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Post('assignments/:id/accept')
  @UseGuards(TelegramAuthGuard)
  async acceptAssignment(
    @Param('id') id: string,
    @Body() dto: AssignmentActionDto,
  ) {
    const result = await this.telegramService.acceptAssignment(
      dto.telegram_id,
      id,
    );

    return {
      success: true,
      data: result,
      message: 'Assignment accepted',
      error: null,
    };
  }

  @Post('assignments/:id/reject')
  @UseGuards(TelegramAuthGuard)
  async rejectAssignment(
    @Param('id') id: string,
    @Body() dto: AssignmentActionDto,
  ) {
    const result = await this.telegramService.rejectAssignment(
      dto.telegram_id,
      id,
      dto.reason,
    );

    return {
      success: true,
      data: result,
      message: 'Assignment rejected',
      error: null,
    };
  }

  @Post('assignments/:id/start')
  @UseGuards(TelegramAuthGuard)
  async startTrip(
    @Param('id') id: string,
    @Body() dto: AssignmentActionDto,
  ) {
    const result = await this.telegramService.startTrip(
      dto.telegram_id,
      id,
    );

    return {
      success: true,
      data: result,
      message: 'Trip started',
      error: null,
    };
  }

  @Post('assignments/:id/complete')
  @UseGuards(TelegramAuthGuard)
  async completeTrip(
    @Param('id') id: string,
    @Body() dto: AssignmentActionDto,
  ) {
    const result = await this.telegramService.completeTrip(
      dto.telegram_id,
      id,
    );

    return {
      success: true,
      data: result,
      message: 'Trip completed',
      error: null,
    };
  }

  // ─── Trip History & Earnings ───

  @Get('assignments/history')
  @UseGuards(TelegramAuthGuard)
  async getAssignmentHistory(
    @Query('telegram_id') telegramId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.telegramService.getAssignmentHistory(
      telegramId,
      parseInt(limit || '20', 10),
      parseInt(offset || '0', 10),
    );

    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Get('earnings/today')
  @UseGuards(TelegramAuthGuard)
  async getTodayEarnings(@Query('telegram_id') telegramId: string) {
    const result = await this.telegramService.getTodayEarnings(telegramId);

    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Get('earnings/week')
  @UseGuards(TelegramAuthGuard)
  async getWeekEarnings(@Query('telegram_id') telegramId: string) {
    const result = await this.telegramService.getWeekEarnings(telegramId);

    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  // ─── Location ───

  @Post('location')
  @UseGuards(TelegramAuthGuard)
  async updateLocation(@Body() dto: LocationUpdateDto) {
    const result = await this.telegramService.updateLocation({
      telegramId: dto.telegram_id,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });

    return {
      success: true,
      data: result,
      message: 'Location updated',
      error: null,
    };
  }

  // ─── Emergency & Support ───

  @Post('emergency')
  @UseGuards(TelegramAuthGuard)
  async createEmergency(
    @Body('telegram_id') telegramId: string,
    @Body('latitude') latitude?: number,
    @Body('longitude') longitude?: number,
  ) {
    const result = await this.telegramService.createEmergencyAlert({
      telegramId,
      latitude,
      longitude,
    });

    return {
      success: true,
      data: result,
      message: 'Emergency alert created',
      error: null,
    };
  }

  @Post('support')
  @UseGuards(TelegramAuthGuard)
  async createSupportTicket(
    @Body('telegram_id') telegramId: string,
    @Body('message') message: string,
  ) {
    const result = await this.telegramService.createSupportTicket({
      telegramId,
      message,
    });

    return {
      success: true,
      data: result,
      message: 'Support ticket created',
      error: null,
    };
  }

  // ─── Settings ───

  @Patch('settings')
  @UseGuards(TelegramAuthGuard)
  async updateSettings(
    @Body('telegram_id') telegramId: string,
    @Body('settings') settings: { preferredLanguage?: string },
  ) {
    const result = await this.telegramService.updateSettings(
      telegramId,
      settings,
    );

    return {
      success: true,
      data: result,
      message: 'Settings updated',
      error: null,
    };
  }

  // ─── Broadcast ───

  @Post('broadcast')
  async createBroadcast(@Body() dto: BroadcastMessageDto) {
    const result = await this.telegramService.createBroadcast({
      message: dto.message,
      imageUrl: dto.image_url,
      targetFilter: dto.target_filter,
    });

    return {
      success: true,
      data: result,
      message: 'Broadcast queued',
      error: null,
    };
  }

  @Get('broadcasts')
  async getBroadcasts() {
    const result = await this.telegramService.getBroadcasts();

    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  // ─── Legacy Driver Status Webhook (B21) ───

  @Post('driver-status')
  async handleDriverStatusWebhook(
    @Body() dto: DriverStatusWebhookDto,
    @Headers('x-telegram-signature') signature?: string,
  ) {
    if (this.webhookSecret && signature) {
      const isValid = this.verifySignature(dto, signature);
      if (!isValid) {
        this.logger.warn('Invalid webhook signature');
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    const result = await this.telegramService.handleDriverStatusUpdate({
      telegramId: dto.telegram_id,
      vehicleId: dto.vehicle_id,
      driverName: dto.driver_name,
      status: dto.status,
    });

    return {
      success: true,
      data: result,
      message: 'Driver status updated',
      error: null,
    };
  }

  private verifySignature(
    dto: DriverStatusWebhookDto,
    signature: string,
  ): boolean {
    try {
      const payload = JSON.stringify({
        telegram_id: dto.telegram_id,
        vehicle_id: dto.vehicle_id,
        driver_name: dto.driver_name,
        status: dto.status,
      });
      const expected = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex'),
      );
    } catch {
      return false;
    }
  }
}
