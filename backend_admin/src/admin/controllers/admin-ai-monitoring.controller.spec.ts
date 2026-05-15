import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { NotFoundException } from '@nestjs/common';
import { AdminAIMonitoringController } from './admin-ai-monitoring.controller';
import { AdminAIMonitoringService } from '../services/admin-ai-monitoring.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

describe('AdminAIMonitoringController', () => {
  let controller: AdminAIMonitoringController;

  const mockService = {
    getAIAssistedBookings: jest.fn(),
    getAISessionDetails: jest.fn(),
    getAIBookingSuccessRate: jest.fn(),
    getAIPerformanceMetrics: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAIMonitoringController],
      providers: [
        { provide: AdminAIMonitoringService, useValue: mockService },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: { getClient: jest.fn() } },
        Reflector,
      ],
    }).compile();

    controller = module.get<AdminAIMonitoringController>(AdminAIMonitoringController);
  });

  describe('getAIAssistedBookings', () => {
    it('should return AI-assisted bookings with envelope', async () => {
      mockService.getAIAssistedBookings.mockResolvedValue({
        total_bookings: 10,
        ai_assisted_bookings: 3,
        ai_assisted_revenue_usd: 500,
        bookings: [{ id: 'bk-1', reference: 'BK001' }],
      });

      const result = await controller.getAIAssistedBookings('2026-01-01', '2026-01-31');

      expect(result.success).toBe(true);
      expect(result.data.total_bookings).toBe(10);
      expect(result.data.ai_assisted_bookings).toBe(3);
      expect(mockService.getAIAssistedBookings).toHaveBeenCalledWith({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });
    });
  });

  describe('getAISessionDetails', () => {
    it('should return session details from Redis with envelope', async () => {
      mockService.getAISessionDetails.mockResolvedValue({
        session_id: 'session-1',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      const result = await controller.getAISessionDetails('session-1');

      expect(result.success).toBe(true);
      expect(result.data.session_id).toBe('session-1');
      expect(mockService.getAISessionDetails).toHaveBeenCalledWith('session-1');
    });

    it('should return "Session expired" when Redis TTL expired', async () => {
      mockService.getAISessionDetails.mockResolvedValue({
        expired: true,
        session_id: 'session-1',
      });

      const result = await controller.getAISessionDetails('session-1');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Session expired');
      expect(result.error).toBe('Session expired');
    });

    it('should throw NotFoundException when session not found', async () => {
      mockService.getAISessionDetails.mockResolvedValue(null);

      await expect(controller.getAISessionDetails('session-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAIBookingSuccessRate', () => {
    it('should return success rate with envelope', async () => {
      mockService.getAIBookingSuccessRate.mockResolvedValue({
        total_ai_assisted_bookings: 10,
        successful_bookings: 7,
        success_rate_percent: 70,
        by_status: { confirmed: 5, completed: 2, cancelled: 3 },
      });

      const result = await controller.getAIBookingSuccessRate();

      expect(result.success).toBe(true);
      expect(result.data.success_rate_percent).toBe(70);
      expect(mockService.getAIBookingSuccessRate).toHaveBeenCalledWith({
        startDate: undefined,
        endDate: undefined,
      });
    });
  });

  describe('getAIPerformanceMetrics', () => {
    it('should return performance metrics with envelope', async () => {
      mockService.getAIPerformanceMetrics.mockResolvedValue({
        total_sessions: 50,
        avg_messages_per_session: 8.5,
        avg_booking_time_minutes: 45,
        conversion_rate_percent: 12.5,
        bookings_converted: 10,
      });

      const result = await controller.getAIPerformanceMetrics();

      expect(result.success).toBe(true);
      expect(result.data.total_sessions).toBe(50);
      expect(result.data.avg_booking_time_minutes).toBe(45);
    });
  });
});
