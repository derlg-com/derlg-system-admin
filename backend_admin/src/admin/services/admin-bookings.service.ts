import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { booking_status, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingDetailResponseDto } from '../dto/booking-detail-response.dto';

@Injectable()
export class AdminBookingsService {
  private readonly logger = new Logger(AdminBookingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllBookings(filters: {
    bookingType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: string;
    limit?: string;
  }) {
    const { bookingType, status, startDate, endDate, search, page, limit } =
      filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const where: Prisma.BookingWhereInput = {};

    if (status) {
      where.status = status as booking_status;
    }

    if (startDate || endDate) {
      where.start_date = {};
      if (startDate) where.start_date.gte = new Date(startDate);
      if (endDate) where.start_date.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        {
          users: {
            email: { contains: search, mode: 'insensitive' },
          },
        },
        {
          users: {
            full_name: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              full_name: true,
              phone: true,
            },
          },
          payments: {
            select: {
              id: true,
              amount_usd: true,
              status: true,
              refunded_amount_usd: true,
            },
          },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getBookingById(id: string): Promise<BookingDetailResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            full_name: true,
            phone: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount_usd: true,
            status: true,
            refunded_amount_usd: true,
            paid_at: true,
          },
        },
        booking_items: {
          select: {
            id: true,
            booking_type: true,
            trip_id: true,
            hotel_room_id: true,
            vehicle_id: true,
            guide_id: true,
            date: true,
            quantity: true,
            unit_price_usd: true,
            subtotal_usd: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }

    const driverAssignment = await this.prisma.driverAssignment.findFirst({
      where: { bookingId: id },
      select: {
        id: true,
        driverId: true,
        vehicleId: true,
        status: true,
        assignmentTimestamp: true,
      },
    });

    return {
      id: booking.id,
      userId: booking.userId,
      reference: booking.reference,
      start_date: booking.start_date,
      end_date: booking.end_date,
      status: booking.status,
      expires_at: booking.expires_at,
      subtotal_usd: Number(booking.subtotal_usd),
      discount_usd: Number(booking.discount_usd),
      loyalty_discount_usd: Number(booking.loyalty_discount_usd),
      totalUsd: Number(booking.totalUsd),
      cancelled_at: booking.cancelled_at,
      cancel_reason: booking.cancel_reason,
      refund_percentage: booking.refund_percentage,
      passenger_count: booking.passenger_count,
      room_count: booking.room_count,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      user: booking.users,
      payments: booking.payments.map((p) => ({
        id: p.id,
        amount_usd: Number(p.amount_usd),
        status: p.status,
        refunded_amount_usd: Number(p.refunded_amount_usd),
        paid_at: p.paid_at,
      })),
      booking_items: booking.booking_items.map((bi) => ({
        id: bi.id,
        booking_type: bi.booking_type,
        trip_id: bi.trip_id,
        hotel_room_id: bi.hotel_room_id,
        vehicle_id: bi.vehicle_id,
        guide_id: bi.guide_id,
        date: bi.date,
        quantity: bi.quantity,
        unit_price_usd: Number(bi.unit_price_usd),
        subtotal_usd: Number(bi.subtotal_usd),
      })),
      driver_assignment: driverAssignment,
    };
  }

  async updateBooking(
    id: string,
    dto: {
      start_date?: string;
      end_date?: string;
      passenger_count?: number;
      room_count?: number;
      status?: booking_status;
      cancel_reason?: string;
    },
  ) {
    const existing = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }

    if (existing.status === booking_status.cancelled) {
      throw new ConflictException('Cannot modify a cancelled booking');
    }

    const data: Prisma.BookingUpdateInput = {};
    if (dto.start_date !== undefined) data.start_date = new Date(dto.start_date);
    if (dto.end_date !== undefined)
      data.end_date = dto.end_date ? new Date(dto.end_date) : null;
    if (dto.passenger_count !== undefined)
      data.passenger_count = dto.passenger_count;
    if (dto.room_count !== undefined) data.room_count = dto.room_count;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.cancel_reason !== undefined) data.cancel_reason = dto.cancel_reason;

    return this.prisma.booking.update({
      where: { id },
      data,
      include: {
        users: {
          select: {
            id: true,
            email: true,
            full_name: true,
          },
        },
      },
    });
  }

  async cancelBooking(id: string, cancelReason?: string) {
    const existing = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }

    if (existing.status === booking_status.cancelled) {
      throw new ConflictException('Booking is already cancelled');
    }

    if (existing.status === booking_status.completed) {
      throw new ConflictException('Cannot cancel a completed booking');
    }

    const booking = await this.prisma.booking.update({
      where: { id },
      data: {
        status: booking_status.cancelled,
        cancelled_at: new Date(),
        cancel_reason: cancelReason || existing.cancel_reason,
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            full_name: true,
          },
        },
      },
    });

    // Cancel any pending driver assignments for this booking
    await this.prisma.driverAssignment.updateMany({
      where: {
        bookingId: id,
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
      data: {
        status: 'CANCELLED' as any,
      },
    });

    return booking;
  }

  async getUnassignedBookings(filters: { page?: string; limit?: string }) {
    const { page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const assignedBookingIds = await this.prisma.driverAssignment
      .findMany({
        where: {
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
        select: { bookingId: true },
      })
      .then((assignments) => assignments.map((a) => a.bookingId));

    const where: Prisma.BookingWhereInput = {
      id: { notIn: assignedBookingIds },
      status: { in: [booking_status.reserved, booking_status.confirmed] },
    };

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              full_name: true,
            },
          },
          booking_items: {
            select: {
              id: true,
              booking_type: true,
              vehicle_id: true,
            },
          },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async createAuditLog(params: {
    userId?: string;
    eventType: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          user_id: params.userId || null,
          event_type: params.eventType as any,
          entity_type: params.entityType,
          entity_id: params.entityId || null,
          metadata: params.metadata || {},
        },
      });
    } catch (err) {
      this.logger.warn(`Audit log creation failed: ${err.message}`);
    }
  }
}
