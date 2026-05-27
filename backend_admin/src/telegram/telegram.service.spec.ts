import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from './telegram.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BotSenderService } from './services/bot-sender.service';
import { MetricsService } from '../monitoring/metrics.service';
import { getQueueToken } from '@nestjs/bullmq';
import { DriverStatus, AssignmentStatus } from '@prisma/client';

describe('TelegramService', () => {
  let service: TelegramService;

  const mockPrisma = {
    $transaction: jest.fn().mockImplementation((ops) => Promise.all(ops)),
    driver: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    driverAssignment: {
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    broadcastMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    adminUser: {
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    emergencyAlert: {
      create: jest.fn(),
    },
    supportTicket: {
      create: jest.fn(),
    },
  };

  const mockRedisPublish = jest.fn().mockResolvedValue(1);
  const mockRedisIncr = jest.fn().mockResolvedValue(1);
  const mockRedisExpire = jest.fn().mockResolvedValue(1);
  const mockRedisExists = jest.fn().mockResolvedValue(0);
  const mockRedisSetex = jest.fn().mockResolvedValue('OK');
  const mockRedisGet = jest.fn().mockResolvedValue(null);

  const mockRedisClient = {
    publish: mockRedisPublish,
    incr: mockRedisIncr,
    expire: mockRedisExpire,
    exists: mockRedisExists,
    setex: mockRedisSetex,
    get: mockRedisGet,
  };

  const mockRedis = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
  };

  const mockBroadcastQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };

  const mockAssignmentTimeoutQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-2' }),
  };

  const mockBotSender = {
    sendMessage: jest.fn().mockResolvedValue({ message_id: 1 }),
    sendPhoto: jest.fn().mockResolvedValue({ message_id: 2 }),
  };

  const mockMetrics = {
    recordWebhookRequest: jest.fn(),
    recordCommandUsage: jest.fn(),
    recordAssignmentAction: jest.fn(),
    recordBroadcastMessage: jest.fn(),
    recordResponseTime: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: BotSenderService, useValue: mockBotSender },
        { provide: MetricsService, useValue: mockMetrics },
        { provide: getQueueToken('broadcast'), useValue: mockBroadcastQueue },
        { provide: getQueueToken('assignment-timeout'), useValue: mockAssignmentTimeoutQueue },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
  });

  describe('handleWebhook', () => {
    it('should process valid webhook update', async () => {
      const result = await service.handleWebhook({
        update_id: 123,
        message: {
          from: { id: 456, is_bot: false, first_name: 'Test' },
          text: '/start',
        },
      });

      expect(result).toEqual({
        telegramId: '456',
        update: expect.any(Object),
      });
      expect(mockRedisSetex).toHaveBeenCalledWith(
        'telegram:update:123',
        3600,
        '1',
      );
    });

    it('should reject duplicate update_id', async () => {
      mockRedisExists.mockResolvedValueOnce(1);

      const result = await service.handleWebhook({
        update_id: 123,
        message: { from: { id: 456, is_bot: false, first_name: 'Test' } },
      });

      expect(result).toBeNull();
    });

    it('should apply rate limiting', async () => {
      mockRedisIncr.mockResolvedValueOnce(31);

      const result = await service.handleWebhook({
        update_id: 123,
        message: { from: { id: 456, is_bot: false, first_name: 'Test' } },
      });

      expect(result).toEqual({
        text: 'Rate limit exceeded. Please slow down.',
      });
    });
  });

  describe('handleDriverStatusUpdate', () => {
    it('should update existing driver status', async () => {
      const existingDriver = {
        id: 'drv-1',
        driverId: 'DRV001',
        driverName: 'John Doe',
        telegramId: BigInt(123456),
        status: DriverStatus.OFFLINE,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      };

      mockPrisma.driver.findUnique.mockResolvedValue(existingDriver);
      mockPrisma.driver.update.mockResolvedValue({
        ...existingDriver,
        status: DriverStatus.AVAILABLE,
      });

      const result = await service.handleDriverStatusUpdate({
        telegramId: '123456',
        driverName: 'John Doe',
        status: DriverStatus.AVAILABLE,
      });

      expect(result.status).toBe(DriverStatus.AVAILABLE);
      expect(result.action).toBe('updated');
      expect(mockRedisPublish).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should create new driver if telegram_id not found', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue(null);
      mockPrisma.driver.create.mockResolvedValue({
        id: 'drv-new',
        driverId: 'DRV-123456',
        driverName: 'Jane Doe',
        telegramId: BigInt(123456),
        status: DriverStatus.AVAILABLE,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.handleDriverStatusUpdate({
        telegramId: '123456',
        driverName: 'Jane Doe',
        status: DriverStatus.AVAILABLE,
      });

      expect(result.action).toBe('created');
      expect(mockPrisma.driver.create).toHaveBeenCalled();
    });
  });

  describe('registerDriver', () => {
    it('should register driver with valid PIN', async () => {
      const driver = {
        id: 'drv-1',
        driverId: 'DRV001',
        driverName: 'John',
        authPin: '$2b$10$hashedpin',
        telegramId: null,
      };

      mockPrisma.driver.findUnique.mockResolvedValue(driver);
      mockPrisma.driver.update.mockResolvedValue({
        ...driver,
        telegramId: '123456',
      });

      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);

      const result = await service.registerDriver({
        telegramId: '123456',
        driverId: 'DRV001',
        pin: '123456',
      });

      expect(result.telegramId).toBe('123456');
      expect(mockRedisSetex).toHaveBeenCalledWith(
        'telegram_driver:123456',
        expect.any(Number),
        expect.any(String),
      );
    });

    it('should reject invalid PIN', async () => {
      const driver = {
        id: 'drv-1',
        driverId: 'DRV001',
        authPin: '$2b$10$hashedpin',
      };

      mockPrisma.driver.findUnique.mockResolvedValue(driver);
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(false);

      await expect(
        service.registerDriver({
          telegramId: '123456',
          driverId: 'DRV001',
          pin: 'wrongpin',
        }),
      ).rejects.toThrow('Invalid PIN');
    });
  });

  describe('updateDriverStatus', () => {
    it('should block offline with active assignments', async () => {
      const driver = {
        id: 'drv-1',
        telegramId: BigInt(123456),
        status: DriverStatus.AVAILABLE,
      };

      mockPrisma.driver.findUnique.mockResolvedValue(driver);
      mockPrisma.driverAssignment.count.mockResolvedValue(2);

      await expect(
        service.updateDriverStatus({
          telegramId: '123456',
          status: DriverStatus.OFFLINE,
        }),
      ).rejects.toThrow('Cannot go offline while you have active assignments');
    });
  });

  describe('trip assignments', () => {
    it('should accept assignment', async () => {
      const driver = { id: 'drv-1', telegramId: BigInt(123456) };
      const assignment = {
        id: 'asn-1',
        driverId: 'drv-1',
        status: AssignmentStatus.ACCEPTED,
      };

      mockPrisma.driver.findUnique.mockResolvedValue(driver);
      mockPrisma.driverAssignment.update.mockResolvedValue(assignment);

      const result = await service.acceptAssignment('123456', 'asn-1');

      expect(result.status).toBe(AssignmentStatus.ACCEPTED);
    });

    it('should reject assignment with reason', async () => {
      const driver = { id: 'drv-1', telegramId: BigInt(123456) };
      const assignment = {
        id: 'asn-1',
        driverId: 'drv-1',
        status: AssignmentStatus.REJECTED,
        rejectionReason: 'Too far',
      };

      mockPrisma.driver.findUnique.mockResolvedValue(driver);
      mockPrisma.driverAssignment.update.mockResolvedValue(assignment);

      const result = await service.rejectAssignment('123456', 'asn-1', 'Too far');

      expect(result.status).toBe(AssignmentStatus.REJECTED);
      expect(mockRedisPublish).toHaveBeenCalledWith(
        'driver_assignments',
        expect.stringContaining('ASSIGNMENT_REJECTED'),
      );
    });

    it('should queue assignment timeout', async () => {
      await service.queueAssignmentTimeout('asn-1');

      expect(mockAssignmentTimeoutQueue.add).toHaveBeenCalledWith(
        'timeout',
        { assignmentId: 'asn-1' },
        { delay: 5 * 60 * 1000 },
      );
    });
  });

  describe('location', () => {
    it('should update driver location', async () => {
      const driver = { id: 'drv-1', telegramId: BigInt(123456) };

      mockPrisma.driver.findUnique.mockResolvedValue(driver);

      const result = await service.updateLocation({
        telegramId: '123456',
        latitude: 11.5564,
        longitude: 104.9282,
      });

      expect(result.location).toEqual({ lat: 11.5564, lng: 104.9282 });
      expect(mockRedisSetex).toHaveBeenCalledWith(
        'driver_location:drv-1',
        300,
        expect.any(String),
      );
    });
  });

  describe('broadcast', () => {
    it('should create and queue broadcast', async () => {
      const admin = { userId: 'admin-1' };
      mockPrisma.adminUser.findFirst.mockResolvedValue(admin);
      mockPrisma.broadcastMessage.create.mockResolvedValue({
        id: 'bc-1',
        messageId: 'BC-123',
      });
      mockPrisma.driver.findMany.mockResolvedValue([
        { telegramId: BigInt(111), id: 'drv-1' },
        { telegramId: BigInt(222), id: 'drv-2' },
      ]);

      const result = await service.createBroadcast({
        message: 'Hello drivers!',
      });

      expect(result.broadcastId).toBe('bc-1');
      expect(result.targetCount).toBe(2);
      expect(mockBroadcastQueue.add).toHaveBeenCalled();
    });
  });
});
