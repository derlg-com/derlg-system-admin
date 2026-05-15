import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminBookingsController } from './admin-bookings.controller';
import { AdminBookingsService } from '../services/admin-bookings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { booking_status } from '@prisma/client';

describe('AdminBookingsController', () => {
  let controller: AdminBookingsController;
  let service: AdminBookingsService;

  const mockBooking = {
    id: 'booking-uuid-1',
    reference: 'BK001',
    status: booking_status.confirmed,
    passenger_count: 2,
    room_count: 1,
  };

  const mockService = {
    getAllBookings: jest.fn(),
    getUnassignedBookings: jest.fn(),
    getBookingById: jest.fn(),
    updateBooking: jest.fn(),
    cancelBooking: jest.fn(),
    createAuditLog: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminBookingsController],
      providers: [
        { provide: AdminBookingsService, useValue: mockService },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: { getClient: jest.fn() } },
        Reflector,
      ],
    }).compile();

    controller = module.get<AdminBookingsController>(AdminBookingsController);
    service = module.get<AdminBookingsService>(AdminBookingsService);
  });

  describe('getAllBookings', () => {
    it('should return paginated bookings', async () => {
      mockService.getAllBookings.mockResolvedValue({
        data: [mockBooking],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await controller.getAllBookings();

      expect(result.data).toHaveLength(1);
      expect(mockService.getAllBookings).toHaveBeenCalledWith({});
    });

    it('should pass query filters to service', async () => {
      mockService.getAllBookings.mockResolvedValue({ data: [], meta: { total: 0 } });

      await controller.getAllBookings(
        'trip_package',
        'confirmed',
        '2026-06-01',
        '2026-06-05',
        'BK001',
        '2',
        '50',
      );

      expect(mockService.getAllBookings).toHaveBeenCalledWith({
        bookingType: 'trip_package',
        status: 'confirmed',
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        search: 'BK001',
        page: '2',
        limit: '50',
      });
    });
  });

  describe('getUnassignedBookings', () => {
    it('should return unassigned bookings', async () => {
      mockService.getUnassignedBookings.mockResolvedValue({
        data: [mockBooking],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await controller.getUnassignedBookings();

      expect(result.data).toHaveLength(1);
      expect(mockService.getUnassignedBookings).toHaveBeenCalledWith({});
    });
  });

  describe('getBookingById', () => {
    it('should return a single booking', async () => {
      mockService.getBookingById.mockResolvedValue(mockBooking);

      const result = await controller.getBookingById('booking-uuid-1');

      expect(result.id).toBe('booking-uuid-1');
    });
  });

  describe('updateBooking', () => {
    it('should update booking and log audit', async () => {
      const updated = { ...mockBooking, passenger_count: 4 };
      mockService.updateBooking.mockResolvedValue(updated);
      mockService.createAuditLog.mockResolvedValue(undefined);

      const dto = { passenger_count: 4 };
      const result = await controller.updateBooking('booking-uuid-1', dto, 'user-1');

      expect(result.success).toBe(true);
      expect(result.data.passenger_count).toBe(4);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          eventType: 'admin_action',
          entityType: 'BOOKING',
          entityId: 'booking-uuid-1',
          metadata: {
            action: 'UPDATE_BOOKING',
            changedFields: ['passenger_count'],
          },
        }),
      );
    });
  });

  describe('cancelBooking', () => {
    it('should cancel booking and log audit', async () => {
      mockService.getBookingById.mockResolvedValue({
        ...mockBooking,
        status: booking_status.confirmed,
      });
      const cancelled = { ...mockBooking, status: booking_status.cancelled };
      mockService.cancelBooking.mockResolvedValue(cancelled);
      mockService.createAuditLog.mockResolvedValue(undefined);

      const result = await controller.cancelBooking('booking-uuid-1', 'Customer request', 'user-1');

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(booking_status.cancelled);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          eventType: 'admin_action',
          entityType: 'BOOKING',
          entityId: 'booking-uuid-1',
          metadata: {
            action: 'CANCEL_BOOKING',
            previousStatus: booking_status.confirmed,
            cancelReason: 'Customer request',
          },
        }),
      );
    });
  });
});
