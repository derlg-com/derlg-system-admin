import { Test, TestingModule } from '@nestjs/testing';
import { AdminAnalyticsService } from './admin-analytics.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminAnalyticsService', () => {
  let service: AdminAnalyticsService;
  let prisma: PrismaService;

  const mockPrisma = {
    booking_items: {
      groupBy: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    booking: {
      groupBy: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    driver: {
      findMany: jest.fn(),
    },
    driverAssignment: {
      groupBy: jest.fn(),
    },
    trips: {
      findMany: jest.fn(),
    },
    hotel_rooms: {
      count: jest.fn(),
    },
    guides: {
      count: jest.fn(),
    },
    ai_chat_sessions: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminAnalyticsService>(AdminAnalyticsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getRevenueAnalytics', () => {
    it('should aggregate revenue by booking type', async () => {
      mockPrisma.booking_items.groupBy.mockResolvedValue([
        { booking_type: 'trip_package', _sum: { subtotal_usd: 1000 }, _count: { _all: 5 } },
        { booking_type: 'hotel_room', _sum: { subtotal_usd: 500 }, _count: { _all: 3 } },
      ]);
      mockPrisma.booking_items.aggregate.mockResolvedValue({
        _sum: { subtotal_usd: 1500 },
        _count: { _all: 8 },
      });

      const result = await service.getRevenueAnalytics({});

      expect(result.by_type).toHaveLength(2);
      expect(result.total_revenue_usd).toBe(1500);
      expect(result.total_bookings).toBe(8);
      expect(result.by_type[0].revenue_usd).toBe(1000);
    });

    it('should apply date filters', async () => {
      mockPrisma.booking_items.groupBy.mockResolvedValue([]);
      mockPrisma.booking_items.aggregate.mockResolvedValue({
        _sum: { subtotal_usd: 0 },
        _count: { _all: 0 },
      });

      await service.getRevenueAnalytics({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(mockPrisma.booking_items.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({
              gte: new Date('2026-01-01'),
              lte: new Date('2026-01-31'),
            }),
          }),
        }),
      );
    });
  });

  describe('getBookingStatistics', () => {
    it('should return counts by status and period totals', async () => {
      mockPrisma.booking.groupBy.mockResolvedValue([
        { status: 'confirmed', _count: { _all: 10 } },
        { status: 'cancelled', _count: { _all: 2 } },
      ]);
      mockPrisma.booking.count.mockResolvedValue(12);

      const result = await service.getBookingStatistics();

      expect(result.by_status).toHaveLength(2);
      expect(result.total).toBe(12);
      expect(result.by_status[0].status).toBe('confirmed');
    });
  });

  describe('getDriverPerformance', () => {
    it('should return driver stats with completed trips', async () => {
      mockPrisma.driver.findMany.mockResolvedValue([
        {
          id: 'driver-1',
          driverName: 'John Doe',
          driverId: 'DRV001',
          status: 'AVAILABLE',
          _count: { assignments: 5 },
        },
      ]);
      mockPrisma.driverAssignment.groupBy.mockResolvedValue([
        { driverId: 'driver-1', _count: { _all: 3 } },
      ]);

      const result = await service.getDriverPerformance();

      expect(result).toHaveLength(1);
      expect(result[0].driver_name).toBe('John Doe');
      expect(result[0].total_assignments).toBe(5);
      expect(result[0].completed_trips).toBe(3);
    });
  });

  describe('getPopularDestinations', () => {
    it('should return top destinations by booking count', async () => {
      mockPrisma.booking_items.groupBy.mockResolvedValue([
        { trip_id: 'trip-1', _count: { _all: 15 } },
      ]);
      mockPrisma.trips.findMany.mockResolvedValue([
        {
          id: 'trip-1',
          trip_translations: [{ title: 'Angkor Wat Tour' }],
        },
      ]);

      const result = await service.getPopularDestinations();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Angkor Wat Tour');
      expect(result[0].booking_count).toBe(15);
    });

    it('should handle missing trip translations', async () => {
      mockPrisma.booking_items.groupBy.mockResolvedValue([
        { trip_id: 'trip-1', _count: { _all: 5 } },
      ]);
      mockPrisma.trips.findMany.mockResolvedValue([
        { id: 'trip-1', trip_translations: [] },
      ]);

      const result = await service.getPopularDestinations();

      expect(result[0].title).toBe('Unknown');
    });
  });

  describe('getHotelOccupancy', () => {
    it('should calculate occupancy rate', async () => {
      mockPrisma.hotel_rooms.count.mockResolvedValue(50);
      mockPrisma.booking_items.count.mockResolvedValue(750);

      const result = await service.getHotelOccupancy();

      expect(result.total_rooms).toBe(50);
      expect(result.occupied_room_nights_30d).toBe(750);
      expect(result.occupancy_rate_percent).toBe(50); // 750 / (50*30) = 0.5
    });

    it('should return zero when no rooms exist', async () => {
      mockPrisma.hotel_rooms.count.mockResolvedValue(0);
      mockPrisma.booking_items.count.mockResolvedValue(0);

      const result = await service.getHotelOccupancy();

      expect(result.occupancy_rate_percent).toBe(0);
    });
  });

  describe('getGuideUtilization', () => {
    it('should calculate guide utilization rate', async () => {
      mockPrisma.guides.count.mockResolvedValue(20);
      mockPrisma.booking_items.groupBy.mockResolvedValue([
        { guide_id: 'guide-1', _count: { _all: 5 } },
        { guide_id: 'guide-2', _count: { _all: 3 } },
      ]);

      const result = await service.getGuideUtilization();

      expect(result.total_guides).toBe(20);
      expect(result.active_guides).toBe(2);
      expect(result.utilization_rate_percent).toBe(10);
    });
  });

  describe('getAIAssistedBookings', () => {
    it('should count AI-assisted bookings within 24h window', async () => {
      const sessionDate = new Date('2026-05-01T10:00:00Z');
      const bookingDate = new Date('2026-05-01T20:00:00Z');

      mockPrisma.ai_chat_sessions.findMany.mockResolvedValue([
        { user_id: 'user-1', created_at: sessionDate },
      ]);
      mockPrisma.booking.findMany.mockResolvedValue([
        { id: 'bk-1', userId: 'user-1', createdAt: bookingDate, totalUsd: 100 },
        { id: 'bk-2', userId: 'user-2', createdAt: bookingDate, totalUsd: 200 },
      ]);

      const result = await service.getAIAssistedBookings();

      expect(result.total_bookings_30d).toBe(2);
      expect(result.ai_assisted_bookings).toBe(1);
      expect(result.ai_assisted_revenue_usd).toBe(100);
      expect(result.conversion_rate_percent).toBe(50);
    });
  });

  describe('getAIPerformanceMetrics', () => {
    it('should return AI metrics', async () => {
      mockPrisma.ai_chat_sessions.count.mockResolvedValue(50);
      mockPrisma.$queryRaw.mockResolvedValue([{ avg_messages: 8.5 }]);

      const result = await service.getAIPerformanceMetrics();

      expect(result.total_sessions_30d).toBe(50);
      expect(result.avg_messages_per_session).toBe(8.5);
    });
  });

  describe('exportData', () => {
    it('should export revenue as csv', async () => {
      mockPrisma.booking_items.groupBy.mockResolvedValue([
        { booking_type: 'trip_package', _sum: { subtotal_usd: 100 }, _count: { _all: 1 } },
      ]);
      mockPrisma.booking_items.aggregate.mockResolvedValue({
        _sum: { subtotal_usd: 100 },
        _count: { _all: 1 },
      });

      const result = await service.exportData({
        format: 'csv',
        metric: 'revenue',
      });

      expect(result.format).toBe('csv');
      expect(result.content).toContain('booking_type');
    });

    it('should export as json by default', async () => {
      mockPrisma.booking_items.groupBy.mockResolvedValue([]);
      mockPrisma.booking_items.aggregate.mockResolvedValue({
        _sum: { subtotal_usd: 0 },
        _count: { _all: 0 },
      });
      mockPrisma.booking.groupBy.mockResolvedValue([]);
      mockPrisma.booking.count.mockResolvedValue(0);

      const result = await service.exportData({
        format: 'json',
      });

      expect(result.format).toBe('json');
      expect(result.content).toContain('metric');
    });
  });

  describe('createAuditLog', () => {
    it('should create audit log', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      await service.createAuditLog({
        userId: 'admin-1',
        eventType: 'admin_action',
        entityType: 'ANALYTICS',
        metadata: { action: 'EXPORT' },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should not throw on audit log failure', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.createAuditLog({
          eventType: 'admin_action',
          entityType: 'ANALYTICS',
        }),
      ).resolves.toBeUndefined();
    });
  });
});
