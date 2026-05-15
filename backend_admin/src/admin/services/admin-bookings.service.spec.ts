import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { booking_status } from '@prisma/client';
import { AdminBookingsService } from './admin-bookings.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockBooking = {
  id: 'booking-uuid-1',
  userId: 'user-uuid-1',
  reference: 'BK001',
  start_date: new Date('2026-06-01'),
  end_date: new Date('2026-06-05'),
  status: booking_status.confirmed,
  expires_at: new Date('2026-06-01'),
  subtotal_usd: 100.0,
  discount_usd: 0,
  loyalty_discount_usd: 0,
  totalUsd: 100.0,
  cancelled_at: null,
  cancel_reason: null,
  refund_percentage: null,
  passenger_count: 2,
  room_count: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUser = {
  id: 'user-uuid-1',
  email: 'user@example.com',
  full_name: 'John Doe',
  phone: '+85512345678',
};

const mockPayment = {
  id: 'payment-1',
  amount_usd: 100.0,
  status: 'succeeded',
  refunded_amount_usd: 0,
  paid_at: new Date(),
};

const mockBookingItem = {
  id: 'item-1',
  booking_type: 'trip_package',
  trip_id: 'trip-1',
  hotel_room_id: null,
  vehicle_id: null,
  guide_id: null,
  date: new Date('2026-06-01'),
  quantity: 1,
  unit_price_usd: 100.0,
  subtotal_usd: 100.0,
};

describe('AdminBookingsService', () => {
  let service: AdminBookingsService;
  let prisma: PrismaService;

  const mockPrisma = {
    booking: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    driverAssignment: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminBookingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminBookingsService>(AdminBookingsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getAllBookings', () => {
    it('should return paginated bookings with user info', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([
        { ...mockBooking, users: mockUser, payments: [mockPayment] },
      ]);
      mockPrisma.booking.count.mockResolvedValue(1);

      const result = await service.getAllBookings({});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.data[0].users).toBeDefined();
    });

    it('should filter by status', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);
      mockPrisma.booking.count.mockResolvedValue(0);

      await service.getAllBookings({ status: 'confirmed' });

      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'confirmed' }),
        }),
      );
    });

    it('should search by reference or user email/name', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);
      mockPrisma.booking.count.mockResolvedValue(0);

      await service.getAllBookings({ search: 'BK001' });

      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ reference: expect.any(Object) }),
            ]),
          }),
        }),
      );
    });
  });

  describe('getBookingById', () => {
    it('should return booking with full details', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        users: mockUser,
        payments: [mockPayment],
        booking_items: [mockBookingItem],
      });
      mockPrisma.driverAssignment.findFirst.mockResolvedValue(null);

      const result = await service.getBookingById('booking-uuid-1');

      expect(result.id).toBe('booking-uuid-1');
      expect(result.user).toBeDefined();
      expect(result.payments).toHaveLength(1);
      expect(result.booking_items).toHaveLength(1);
    });

    it('should throw NotFoundException when booking not found', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      await expect(service.getBookingById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateBooking', () => {
    it('should update booking fields', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrisma.booking.update.mockResolvedValue({
        ...mockBooking,
        passenger_count: 4,
        users: mockUser,
      });

      const result = await service.updateBooking('booking-uuid-1', {
        passenger_count: 4,
      });

      expect(result.passenger_count).toBe(4);
    });

    it('should throw NotFoundException when booking not found', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      await expect(
        service.updateBooking('invalid-id', { passenger_count: 4 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when booking is cancelled', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: booking_status.cancelled,
      });

      await expect(
        service.updateBooking('booking-uuid-1', { passenger_count: 4 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('cancelBooking', () => {
    it('should cancel booking and update assignments', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrisma.booking.update.mockResolvedValue({
        ...mockBooking,
        status: booking_status.cancelled,
        cancelled_at: new Date(),
        users: mockUser,
      });
      mockPrisma.driverAssignment.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.cancelBooking('booking-uuid-1', 'Customer request');

      expect(result.status).toBe(booking_status.cancelled);
      expect(mockPrisma.driverAssignment.updateMany).toHaveBeenCalled();
    });

    it('should throw ConflictException when already cancelled', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: booking_status.cancelled,
      });

      await expect(
        service.cancelBooking('booking-uuid-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when already completed', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: booking_status.completed,
      });

      await expect(
        service.cancelBooking('booking-uuid-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getUnassignedBookings', () => {
    it('should return bookings without driver assignments', async () => {
      mockPrisma.driverAssignment.findMany.mockResolvedValue([
        { bookingId: 'assigned-booking' },
      ]);
      mockPrisma.booking.findMany.mockResolvedValue([
        { ...mockBooking, users: mockUser, booking_items: [] },
      ]);
      mockPrisma.booking.count.mockResolvedValue(1);

      const result = await service.getUnassignedBookings({});

      expect(result.data).toHaveLength(1);
      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: expect.objectContaining({ notIn: ['assigned-booking'] }),
          }),
        }),
      );
    });
  });
});
