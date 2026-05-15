import { Test, TestingModule } from '@nestjs/testing';
import { AdminAIMonitoringService } from './admin-ai-monitoring.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

describe('AdminAIMonitoringService', () => {
  let service: AdminAIMonitoringService;

  const mockPrisma = {
    ai_chat_sessions: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    ai_chat_messages: {
      findMany: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const mockRedisGet = jest.fn();
  const mockRedisClient = {
    get: mockRedisGet,
  };

  const mockRedis = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAIMonitoringService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AdminAIMonitoringService>(AdminAIMonitoringService);
  });

  describe('getAIAssistedBookings', () => {
    it('should return AI-assisted bookings within 24h window', async () => {
      const sessionDate = new Date('2026-05-01T10:00:00Z');
      const bookingDate = new Date('2026-05-01T20:00:00Z');

      mockPrisma.ai_chat_sessions.findMany.mockResolvedValue([
        { user_id: 'user-1', created_at: sessionDate, id: 'session-1' },
      ]);
      mockPrisma.booking.findMany.mockResolvedValue([
        {
          id: 'bk-1',
          userId: 'user-1',
          createdAt: bookingDate,
          totalUsd: 100,
          status: 'confirmed',
          reference: 'BK001',
        },
        {
          id: 'bk-2',
          userId: 'user-2',
          createdAt: bookingDate,
          totalUsd: 200,
          status: 'reserved',
          reference: 'BK002',
        },
      ]);

      const result = await service.getAIAssistedBookings();

      expect(result.total_bookings).toBe(2);
      expect(result.ai_assisted_bookings).toBe(1);
      expect(result.ai_assisted_revenue_usd).toBe(100);
      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0].reference).toBe('BK001');
    });

    it('should apply date filters', async () => {
      mockPrisma.ai_chat_sessions.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      await service.getAIAssistedBookings({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(mockPrisma.ai_chat_sessions.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            created_at: expect.objectContaining({
              gte: new Date('2026-01-01'),
              lte: new Date('2026-01-31'),
            }),
          }),
        }),
      );
    });

    it('should exclude bookings created more than 24h after session', async () => {
      const sessionDate = new Date('2026-05-01T10:00:00Z');
      const bookingDate = new Date('2026-05-03T10:00:00Z'); // 48h later

      mockPrisma.ai_chat_sessions.findMany.mockResolvedValue([
        { user_id: 'user-1', created_at: sessionDate, id: 'session-1' },
      ]);
      mockPrisma.booking.findMany.mockResolvedValue([
        {
          id: 'bk-1',
          userId: 'user-1',
          createdAt: bookingDate,
          totalUsd: 100,
          status: 'confirmed',
          reference: 'BK001',
        },
      ]);

      const result = await service.getAIAssistedBookings();

      expect(result.ai_assisted_bookings).toBe(0);
      expect(result.bookings).toHaveLength(0);
    });
  });

  describe('getAISessionDetails', () => {
    it('should return cached session from Redis', async () => {
      const cachedData = {
        session_id: 'session-1',
        messages: [{ role: 'user', content: 'Hello' }],
      };
      mockRedisGet.mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.getAISessionDetails('session-1');

      expect(result).toEqual(cachedData);
      expect(mockRedisGet).toHaveBeenCalledWith('ai:session:session-1');
      expect(mockPrisma.ai_chat_sessions.findUnique).not.toHaveBeenCalled();
    });

    it('should return expired flag when session exists in DB but not Redis', async () => {
      mockRedisGet.mockResolvedValue(null);
      mockPrisma.ai_chat_sessions.findUnique.mockResolvedValue({
        id: 'session-1',
        user_id: 'user-1',
        title: 'Test Session',
      });

      const result = await service.getAISessionDetails('session-1');

      expect(result).toEqual({ expired: true, session_id: 'session-1' });
    });

    it('should return null when session not found in DB', async () => {
      mockRedisGet.mockResolvedValue(null);
      mockPrisma.ai_chat_sessions.findUnique.mockResolvedValue(null);

      const result = await service.getAISessionDetails('session-1');

      expect(result).toBeNull();
    });
  });

  describe('getAIBookingSuccessRate', () => {
    it('should calculate success rate for AI-assisted bookings', async () => {
      const sessionDate = new Date('2026-05-01T10:00:00Z');

      mockPrisma.ai_chat_sessions.findMany.mockResolvedValue([
        { user_id: 'user-1', created_at: sessionDate, id: 'session-1' },
      ]);
      mockPrisma.booking.findMany.mockResolvedValue([
        {
          id: 'bk-1',
          userId: 'user-1',
          createdAt: new Date('2026-05-01T20:00:00Z'),
          totalUsd: 100,
          status: 'confirmed',
          reference: 'BK001',
        },
        {
          id: 'bk-2',
          userId: 'user-1',
          createdAt: new Date('2026-05-01T21:00:00Z'),
          totalUsd: 200,
          status: 'completed',
          reference: 'BK002',
        },
        {
          id: 'bk-3',
          userId: 'user-1',
          createdAt: new Date('2026-05-01T22:00:00Z'),
          totalUsd: 50,
          status: 'cancelled',
          reference: 'BK003',
        },
      ]);

      const result = await service.getAIBookingSuccessRate();

      expect(result.total_ai_assisted_bookings).toBe(3);
      expect(result.successful_bookings).toBe(2);
      expect(result.success_rate_percent).toBeCloseTo(66.67, 1);
      expect(result.by_status.confirmed).toBe(1);
      expect(result.by_status.completed).toBe(1);
      expect(result.by_status.cancelled).toBe(1);
    });

    it('should return zero when no AI-assisted bookings', async () => {
      mockPrisma.ai_chat_sessions.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const result = await service.getAIBookingSuccessRate();

      expect(result.total_ai_assisted_bookings).toBe(0);
      expect(result.success_rate_percent).toBe(0);
    });
  });

  describe('getAIPerformanceMetrics', () => {
    it('should return performance metrics', async () => {
      mockPrisma.ai_chat_sessions.count.mockResolvedValue(50);
      mockPrisma.$queryRaw.mockResolvedValue([{ avg_messages: 8.5 }]);
      mockPrisma.ai_chat_sessions.findMany.mockResolvedValue([
        {
          user_id: 'user-1',
          created_at: new Date('2026-05-01T10:00:00Z'),
          id: 'session-1',
        },
      ]);
      mockPrisma.booking.findMany.mockResolvedValue([
        {
          id: 'bk-1',
          userId: 'user-1',
          createdAt: new Date('2026-05-01T11:00:00Z'),
          totalUsd: 100,
          status: 'confirmed',
          reference: 'BK001',
        },
      ]);

      const result = await service.getAIPerformanceMetrics();

      expect(result.total_sessions).toBe(50);
      expect(result.avg_messages_per_session).toBe(8.5);
      expect(result.avg_booking_time_minutes).toBe(60);
      expect(result.bookings_converted).toBe(1);
    });

    it('should return zero metrics when no data', async () => {
      mockPrisma.ai_chat_sessions.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([{ avg_messages: null }]);
      mockPrisma.ai_chat_sessions.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const result = await service.getAIPerformanceMetrics();

      expect(result.total_sessions).toBe(0);
      expect(result.avg_booking_time_minutes).toBe(0);
      expect(result.conversion_rate_percent).toBe(0);
    });
  });
});
