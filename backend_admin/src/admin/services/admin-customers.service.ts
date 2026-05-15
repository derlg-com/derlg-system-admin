import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerResponseDto } from '../dto/customer-response.dto';

@Injectable()
export class AdminCustomersService {
  private readonly logger = new Logger(AdminCustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllCustomers(filters: {
    search?: string;
    page?: string;
    limit?: string;
  }) {
    const { search, page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const where: any = {};
    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          full_name: true,
          phone: true,
          avatar_url: true,
          loyalty_points: true,
          is_student_verified: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              bookings: true,
              reviews: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const mapped = data.map((user) => ({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      avatar_url: user.avatar_url,
      loyalty_points: user.loyalty_points,
      is_student_verified: user.is_student_verified,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      booking_count: user._count.bookings,
      review_count: user._count.reviews,
    }));

    return {
      data: mapped,
      meta: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getCustomerById(id: string): Promise<CustomerResponseDto & {
    bookings: Array<{
      id: string;
      reference: string;
      status: string;
      totalUsd: number;
      start_date: Date | null;
      end_date: Date | null;
      createdAt: Date;
    }>;
    loyalty_transactions: Array<{
      id: string;
      type: string;
      points: number;
      balance_after: number;
      reference: string | null;
      created_at: Date;
    }>;
    reviews: Array<{
      id: string;
      rating: number;
      text: string | null;
      hotel_id: string | null;
      guide_id: string | null;
      trip_id: string | null;
      created_at: Date;
    }>;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        bookings: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            reference: true,
            status: true,
            totalUsd: true,
            start_date: true,
            end_date: true,
            createdAt: true,
          },
        },
        loyalty_transactions: {
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            type: true,
            points: true,
            balance_after: true,
            reference: true,
            created_at: true,
          },
        },
        reviews: {
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            rating: true,
            text: true,
            hotel_id: true,
            guide_id: true,
            trip_id: true,
            created_at: true,
          },
        },
        _count: {
          select: { bookings: true, reviews: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    const totalSpent = user.bookings.reduce(
      (sum, b) => sum + Number(b.totalUsd || 0),
      0,
    );

    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      avatar_url: user.avatar_url,
      loyalty_points: user.loyalty_points,
      is_student_verified: user.is_student_verified,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      booking_count: user._count.bookings,
      review_count: user._count.reviews,
      total_spent_usd: totalSpent,
      bookings: user.bookings.map((b) => ({
        id: b.id,
        reference: b.reference,
        status: b.status,
        totalUsd: Number(b.totalUsd),
        start_date: b.start_date,
        end_date: b.end_date,
        createdAt: b.createdAt,
      })),
      loyalty_transactions: user.loyalty_transactions.map((t) => ({
        id: t.id,
        type: t.type,
        points: t.points,
        balance_after: t.balance_after,
        reference: t.reference,
        created_at: t.created_at,
      })),
      reviews: user.reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        text: r.text,
        hotel_id: r.hotel_id,
        guide_id: r.guide_id,
        trip_id: r.trip_id,
        created_at: r.created_at,
      })),
    };
  }

  async getCustomerReviews(customerId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`Customer with id ${customerId} not found`);
    }

    const reviews = await this.prisma.reviews.findMany({
      where: { user_id: customerId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        rating: true,
        text: true,
        images: true,
        is_verified_booking: true,
        hotel_id: true,
        guide_id: true,
        trip_id: true,
        created_at: true,
        updated_at: true,
      },
    });

    return reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      text: review.text,
      images: review.images,
      is_verified_booking: review.is_verified_booking,
      hotel_id: review.hotel_id,
      guide_id: review.guide_id,
      trip_id: review.trip_id,
      created_at: review.created_at,
      updated_at: review.updated_at,
    }));
  }

  async adjustLoyaltyPoints(dto: {
    user_id: string;
    points: number;
    description: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.user_id },
      select: { id: true, loyalty_points: true },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${dto.user_id} not found`);
    }

    const newBalance = Math.max(0, user.loyalty_points + dto.points);

    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: dto.user_id },
        data: {
          loyalty_points: newBalance,
        },
      }),
      this.prisma.loyalty_transactions.create({
        data: {
          id: randomUUID(),
          user_id: dto.user_id,
          type: 'adjusted',
          points: dto.points,
          balance_after: newBalance,
          reference: dto.description,
          created_at: new Date(),
        },
      }),
    ]);

    return {
      user_id: dto.user_id,
      previous_balance: user.loyalty_points,
      adjustment: dto.points,
      new_balance: updatedUser.loyalty_points,
      description: dto.description,
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
