import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from '../services/admin-analytics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

describe('AdminAnalyticsController', () => {
  let controller: AdminAnalyticsController;
  let service: AdminAnalyticsService;

  const mockService = {
    getRevenueAnalytics: jest.fn(),
    getBookingStatistics: jest.fn(),
    getDriverPerformance: jest.fn(),
    getPopularDestinations: jest.fn(),
    getHotelOccupancy: jest.fn(),
    getGuideUtilization: jest.fn(),
    getAIAssistedBookings: jest.fn(),
    getAIPerformanceMetrics: jest.fn(),
    exportData: jest.fn(),
    createAuditLog: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAnalyticsController],
      providers: [
        { provide: AdminAnalyticsService, useValue: mockService },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: { getClient: jest.fn() } },
        Reflector,
      ],
    }).compile();

    controller = module.get<AdminAnalyticsController>(AdminAnalyticsController);
    service = module.get<AdminAnalyticsService>(AdminAnalyticsService);
  });

  describe('getRevenueAnalytics', () => {
    it('should return revenue data with envelope', async () => {
      mockService.getRevenueAnalytics.mockResolvedValue({
        by_type: [{ booking_type: 'trip_package', revenue_usd: 1000, count: 5 }],
        total_revenue_usd: 1000,
        total_bookings: 5,
      });

      const result = await controller.getRevenueAnalytics('2026-01-01', '2026-01-31');

      expect(result.success).toBe(true);
      expect(result.data.total_revenue_usd).toBe(1000);
      expect(mockService.getRevenueAnalytics).toHaveBeenCalledWith({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });
    });
  });

  describe('getBookingStatistics', () => {
    it('should return booking stats with envelope', async () => {
      mockService.getBookingStatistics.mockResolvedValue({
        by_status: [{ status: 'confirmed', count: 10 }],
        total: 12,
      });

      const result = await controller.getBookingStatistics();

      expect(result.success).toBe(true);
      expect(result.data.total).toBe(12);
    });
  });

  describe('getDriverPerformance', () => {
    it('should return driver performance with envelope', async () => {
      mockService.getDriverPerformance.mockResolvedValue([
        { driver_id: 'drv-1', completed_trips: 5 },
      ]);

      const result = await controller.getDriverPerformance();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getPopularDestinations', () => {
    it('should return destinations with envelope', async () => {
      mockService.getPopularDestinations.mockResolvedValue([
        { trip_id: 'trip-1', title: 'Angkor Wat', booking_count: 15 },
      ]);

      const result = await controller.getPopularDestinations();

      expect(result.success).toBe(true);
      expect(result.data[0].booking_count).toBe(15);
    });
  });

  describe('getHotelOccupancy', () => {
    it('should return occupancy with envelope', async () => {
      mockService.getHotelOccupancy.mockResolvedValue({
        total_rooms: 50,
        occupancy_rate_percent: 50,
      });

      const result = await controller.getHotelOccupancy();

      expect(result.success).toBe(true);
      expect(result.data.occupancy_rate_percent).toBe(50);
    });
  });

  describe('getGuideUtilization', () => {
    it('should return utilization with envelope', async () => {
      mockService.getGuideUtilization.mockResolvedValue({
        total_guides: 20,
        utilization_rate_percent: 10,
      });

      const result = await controller.getGuideUtilization();

      expect(result.success).toBe(true);
      expect(result.data.utilization_rate_percent).toBe(10);
    });
  });

  describe('getAIAssistedBookings', () => {
    it('should return AI bookings with envelope', async () => {
      mockService.getAIAssistedBookings.mockResolvedValue({
        ai_assisted_bookings: 5,
        conversion_rate_percent: 25,
      });

      const result = await controller.getAIAssistedBookings();

      expect(result.success).toBe(true);
      expect(result.data.conversion_rate_percent).toBe(25);
    });
  });

  describe('getAIPerformanceMetrics', () => {
    it('should return AI metrics with envelope', async () => {
      mockService.getAIPerformanceMetrics.mockResolvedValue({
        total_sessions_30d: 50,
        avg_messages_per_session: 8.5,
      });

      const result = await controller.getAIPerformanceMetrics();

      expect(result.success).toBe(true);
      expect(result.data.total_sessions_30d).toBe(50);
    });
  });

  describe('exportData', () => {
    it('should export data and log audit', async () => {
      mockService.exportData.mockResolvedValue({
        format: 'csv',
        content: 'header,value\ntest,1',
      });
      mockService.createAuditLog.mockResolvedValue(undefined);

      const result = await controller.exportData(
        'csv',
        'revenue',
        '2026-01-01',
        '2026-01-31',
        'admin-1',
      );

      expect(result.success).toBe(true);
      expect(result.data.format).toBe('csv');
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-1',
          entityType: 'ANALYTICS_EXPORT',
          metadata: expect.objectContaining({ action: 'EXPORT_DATA' }),
        }),
      );
    });
  });
});
