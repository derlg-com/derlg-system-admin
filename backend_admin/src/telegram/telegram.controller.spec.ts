import { Test, TestingModule } from '@nestjs/testing';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { CommandHandler } from './handlers/command.handler';
import { CallbackHandler } from './handlers/callback.handler';
import { LocationHandler } from './handlers/location.handler';
import { MessageHandler } from './handlers/message.handler';
import { TelegramAuthGuard } from './guards/telegram-auth.guard';
import { BotSenderService } from './services/bot-sender.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { DriverStatus } from '@prisma/client';
import { UnauthorizedException } from '@nestjs/common';

describe('TelegramController', () => {
  let controller: TelegramController;

  const mockService = {
    handleWebhook: jest.fn(),
    handleDriverStatusUpdate: jest.fn(),
    registerDriver: jest.fn(),
    updateDriverStatus: jest.fn(),
    getDriverInfo: jest.fn(),
    getActiveAssignments: jest.fn(),
    acceptAssignment: jest.fn(),
    rejectAssignment: jest.fn(),
    startTrip: jest.fn(),
    completeTrip: jest.fn(),
    getAssignmentHistory: jest.fn(),
    getTodayEarnings: jest.fn(),
    getWeekEarnings: jest.fn(),
    updateLocation: jest.fn(),
    createEmergencyAlert: jest.fn(),
    createSupportTicket: jest.fn(),
    updateSettings: jest.fn(),
    createBroadcast: jest.fn(),
    getBroadcasts: jest.fn(),
    queueAssignmentTimeout: jest.fn(),
  };

  const mockCommandHandler = {
    handleCommand: jest.fn(),
  };

  const mockCallbackHandler = {
    handleCallback: jest.fn(),
  };

  const mockLocationHandler = {
    handleLocation: jest.fn(),
  };

  const mockMessageHandler = {
    handleUpdate: jest.fn(),
  };

  const mockBotSender = {
    sendMessage: jest.fn().mockResolvedValue({ message_id: 1 }),
    answerCallbackQuery: jest.fn().mockResolvedValue(true),
  };

  const mockPrisma = {
    driver: { findUnique: jest.fn() },
    adminUser: { findFirst: jest.fn() },
  };

  const mockRedis = {
    getClient: jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramController],
      providers: [
        { provide: TelegramService, useValue: mockService },
        { provide: CommandHandler, useValue: mockCommandHandler },
        { provide: CallbackHandler, useValue: mockCallbackHandler },
        { provide: LocationHandler, useValue: mockLocationHandler },
        { provide: MessageHandler, useValue: mockMessageHandler },
        { provide: BotSenderService, useValue: mockBotSender },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        TelegramAuthGuard,
      ],
    }).compile();

    controller = module.get<TelegramController>(TelegramController);
  });

  describe('handleWebhook', () => {
    it('should process webhook and route to message handler', async () => {
      mockService.handleWebhook.mockResolvedValue({
        telegramId: '123456',
        update: { update_id: 1 },
      });
      mockMessageHandler.handleUpdate.mockResolvedValue({
        text: 'Welcome!',
      });

      const result = await controller.handleWebhook({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 123456, is_bot: false, first_name: 'Test' },
          chat: { id: 123456, first_name: 'Test', type: 'private' },
          date: Date.now(),
          text: '/start',
        },
      } as any);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ text: 'Welcome!' });
    });

    it('should handle duplicate updates gracefully', async () => {
      mockService.handleWebhook.mockResolvedValue(null);

      const result = await controller.handleWebhook({
        update_id: 1,
      } as any);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Duplicate or invalid update');
    });
  });

  describe('driver registration', () => {
    it('should register driver and return envelope', async () => {
      mockService.registerDriver.mockResolvedValue({
        driverId: 'drv-1',
        telegramId: '123456',
        driverName: 'John',
      });

      const result = await controller.registerDriver({
        telegram_id: '123456',
        driver_id: 'DRV001',
        pin: '123456',
      });

      expect(result.success).toBe(true);
      expect(result.data.driverId).toBe('drv-1');
    });
  });

  describe('driver status', () => {
    it('should update driver status', async () => {
      mockService.updateDriverStatus.mockResolvedValue({
        driverId: 'drv-1',
        status: DriverStatus.AVAILABLE,
      });

      const result = await controller.updateStatus({
        telegram_id: '123456',
        status: DriverStatus.AVAILABLE,
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(DriverStatus.AVAILABLE);
    });

    it('should get driver info', async () => {
      mockService.getDriverInfo.mockResolvedValue({
        id: 'drv-1',
        driverName: 'John',
        status: DriverStatus.AVAILABLE,
      });

      const result = await controller.getDriverInfo('123456');

      expect(result.success).toBe(true);
      expect(result.data.driverName).toBe('John');
    });
  });

  describe('assignments', () => {
    it('should get active assignments', async () => {
      mockService.getActiveAssignments.mockResolvedValue([]);

      const result = await controller.getActiveAssignments('123456');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should accept assignment', async () => {
      mockService.acceptAssignment.mockResolvedValue({
        id: 'asn-1',
        status: 'ACCEPTED',
      });

      const result = await controller.acceptAssignment('asn-1', {
        telegram_id: '123456',
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('ACCEPTED');
    });

    it('should reject assignment with reason', async () => {
      mockService.rejectAssignment.mockResolvedValue({
        id: 'asn-1',
        status: 'REJECTED',
        rejectionReason: 'Too far',
      });

      const result = await controller.rejectAssignment('asn-1', {
        telegram_id: '123456',
        reason: 'Too far',
      });

      expect(result.success).toBe(true);
      expect(result.data.rejectionReason).toBe('Too far');
    });

    it('should start trip', async () => {
      mockService.startTrip.mockResolvedValue({ id: 'asn-1', status: 'ACCEPTED' });

      const result = await controller.startTrip('asn-1', {
        telegram_id: '123456',
      });

      expect(result.success).toBe(true);
    });

    it('should complete trip', async () => {
      mockService.completeTrip.mockResolvedValue({
        id: 'asn-1',
        status: 'COMPLETED',
      });

      const result = await controller.completeTrip('asn-1', {
        telegram_id: '123456',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('history and earnings', () => {
    it('should get assignment history', async () => {
      mockService.getAssignmentHistory.mockResolvedValue({
        data: [],
        total: 0,
        limit: 20,
        offset: 0,
      });

      const result = await controller.getAssignmentHistory('123456', '20', '0');

      expect(result.success).toBe(true);
      expect(result.data.total).toBe(0);
    });

    it('should get today earnings', async () => {
      mockService.getTodayEarnings.mockResolvedValue({
        date: '2026-05-14',
        trips: 3,
      });

      const result = await controller.getTodayEarnings('123456');

      expect(result.success).toBe(true);
      expect(result.data.trips).toBe(3);
    });

    it('should get week earnings', async () => {
      mockService.getWeekEarnings.mockResolvedValue({
        since: '2026-05-07',
        trips: 12,
      });

      const result = await controller.getWeekEarnings('123456');

      expect(result.success).toBe(true);
      expect(result.data.trips).toBe(12);
    });
  });

  describe('location', () => {
    it('should update location', async () => {
      mockService.updateLocation.mockResolvedValue({
        driverId: 'drv-1',
        location: { lat: 11.5564, lng: 104.9282 },
      });

      const result = await controller.updateLocation({
        telegram_id: '123456',
        latitude: 11.5564,
        longitude: 104.9282,
      });

      expect(result.success).toBe(true);
      expect(result.data.location.lat).toBe(11.5564);
    });
  });

  describe('emergency and support', () => {
    it('should create emergency alert', async () => {
      mockService.createEmergencyAlert.mockResolvedValue({
        id: 'alert-1',
        alertType: 'sos',
      });

      const result = await controller.createEmergency('123456', 11.5, 104.9);

      expect(result.success).toBe(true);
      expect(result.data.alertType).toBe('sos');
    });

    it('should create support ticket', async () => {
      mockService.createSupportTicket.mockResolvedValue({
        id: 'ticket-1',
        ticketId: 'TIX-123',
      });

      const result = await controller.createSupportTicket('123456', 'Need help');

      expect(result.success).toBe(true);
      expect(result.data.ticketId).toBe('TIX-123');
    });
  });

  describe('settings', () => {
    it('should update settings', async () => {
      mockService.updateSettings.mockResolvedValue({
        id: 'drv-1',
        preferredLanguage: 'km',
      });

      const result = await controller.updateSettings('123456', {
        preferredLanguage: 'km',
      });

      expect(result.success).toBe(true);
      expect(result.data.preferredLanguage).toBe('km');
    });
  });

  describe('broadcast', () => {
    it('should create broadcast', async () => {
      mockService.createBroadcast.mockResolvedValue({
        broadcastId: 'bc-1',
        targetCount: 10,
        status: 'QUEUED',
      });

      const result = await controller.createBroadcast({
        message: 'Hello all drivers!',
      });

      expect(result.success).toBe(true);
      expect(result.data.targetCount).toBe(10);
    });

    it('should get broadcasts', async () => {
      mockService.getBroadcasts.mockResolvedValue([]);

      const result = await controller.getBroadcasts();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('legacy driver-status webhook (B21)', () => {
    it('should process driver status webhook', async () => {
      mockService.handleDriverStatusUpdate.mockResolvedValue({
        driverId: 'drv-1',
        status: DriverStatus.AVAILABLE,
        action: 'updated',
      });

      const result = await controller.handleDriverStatusWebhook({
        telegram_id: '123456',
        driver_name: 'John Doe',
        status: DriverStatus.AVAILABLE,
      });

      expect(result.success).toBe(true);
      expect(result.data.driverId).toBe('drv-1');
    });
  });

  describe('verifySignature', () => {
    it('should return true for valid signature', () => {
      const dto = {
        telegram_id: '123456',
        vehicle_id: undefined,
        driver_name: 'John Doe',
        status: DriverStatus.AVAILABLE,
      };

      (controller as any).webhookSecret = 'test-secret';
      const verify = (controller as any).verifySignature.bind(controller);

      const crypto = require('crypto');
      const payload = JSON.stringify({
        telegram_id: '123456',
        vehicle_id: undefined,
        driver_name: 'John Doe',
        status: 'AVAILABLE',
      });
      const signature = crypto
        .createHmac('sha256', 'test-secret')
        .update(payload)
        .digest('hex');

      expect(verify(dto, signature)).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const dto = {
        telegram_id: '123456',
        vehicle_id: undefined,
        driver_name: 'John Doe',
        status: DriverStatus.AVAILABLE,
      };

      (controller as any).webhookSecret = 'test-secret';
      const verify = (controller as any).verifySignature.bind(controller);

      expect(verify(dto, 'invalid-signature')).toBe(false);
    });
  });
});
