import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { GuideResponseDto } from '../dto/guide-response.dto';

@Injectable()
export class AdminGuidesService {
  private readonly logger = new Logger(AdminGuidesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllGuides(filters: {
    languages?: string;
    specialties?: string;
    page?: string;
    limit?: string;
  }) {
    const { languages, specialties, page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const languageList = languages ? languages.split(',') : undefined;
    const specialtyList = specialties ? specialties.split(',') : undefined;

    const where: any = {};

    if (languageList && languageList.length > 0) {
      where.guide_languages = {
        some: { language: { in: languageList } },
      };
    }

    if (specialtyList && specialtyList.length > 0) {
      where.guide_specialities = {
        some: { speciality: { in: specialtyList } },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.guides.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          guide_languages: { select: { language: true } },
          guide_specialities: { select: { speciality: true } },
          _count: {
            select: { booking_items: true, reviews: true },
          },
        },
      }),
      this.prisma.guides.count({ where }),
    ]);

    const mapped = data.map((guide) => ({
      id: guide.id,
      user_id: guide.user_id,
      bio: guide.bio,
      avatar_url: guide.avatar_url,
      images: guide.images,
      price_per_day_usd: Number(guide.price_per_day_usd),
      is_verified: guide.is_verified,
      province: guide.province,
      provinces: guide.provinces,
      is_active: guide.is_active,
      languages: guide.guide_languages.map((l) => l.language),
      specialties: guide.guide_specialities.map((s) => s.speciality),
      assignment_count: guide._count.booking_items,
      review_count: guide._count.reviews,
      created_at: guide.created_at,
      updated_at: guide.updated_at,
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

  async getGuideById(id: string): Promise<GuideResponseDto> {
    const guide = await this.prisma.guides.findUnique({
      where: { id },
      include: {
        guide_languages: { select: { language: true } },
        guide_specialities: { select: { speciality: true } },
        booking_items: {
          select: {
            id: true,
            date: true,
            bookings: {
              select: {
                id: true,
                reference: true,
                status: true,
                start_date: true,
                end_date: true,
              },
            },
          },
          orderBy: { date: 'desc' },
          take: 20,
        },
        reviews: {
          select: { id: true, rating: true },
        },
        _count: {
          select: { booking_items: true, reviews: true },
        },
      },
    });

    if (!guide) {
      throw new NotFoundException(`Guide with id ${id} not found`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: guide.user_id },
      select: {
        id: true,
        email: true,
        full_name: true,
        phone: true,
      },
    });

    const avgRating =
      guide.reviews.length > 0
        ? guide.reviews.reduce((sum, r) => sum + r.rating, 0) / guide.reviews.length
        : null;

    return {
      id: guide.id,
      user_id: guide.user_id,
      user,
      bio: guide.bio,
      avatar_url: guide.avatar_url,
      images: guide.images,
      price_per_day_usd: Number(guide.price_per_day_usd),
      is_verified: guide.is_verified,
      province: guide.province,
      provinces: guide.provinces,
      is_active: guide.is_active,
      languages: guide.guide_languages.map((l) => l.language),
      specialties: guide.guide_specialities.map((s) => s.speciality),
      assignment_count: guide._count.booking_items,
      review_count: guide._count.reviews,
      average_rating: avgRating ? Number(avgRating.toFixed(2)) : null,
      created_at: guide.created_at,
      updated_at: guide.updated_at,
    };
  }

  async createGuide(dto: {
    user_id: string;
    bio?: string;
    languages?: string[];
    specialties?: string[];
    province: string;
    provinces?: string[];
    price_per_day_usd: number;
    avatar_url?: string;
    images?: string[];
    is_verified?: boolean;
    is_active?: boolean;
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: dto.user_id },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with id ${dto.user_id} not found`);
    }

    const existingGuide = await this.prisma.guides.findUnique({
      where: { user_id: dto.user_id },
    });

    if (existingGuide) {
      throw new NotFoundException(
        `Guide profile already exists for user ${dto.user_id}`,
      );
    }

    const guideId = randomUUID();
    const now = new Date();

    const guide = await this.prisma.guides.create({
      data: {
        id: guideId,
        user_id: dto.user_id,
        bio: dto.bio || null,
        avatar_url: dto.avatar_url || null,
        images: dto.images || [],
        price_per_day_usd: dto.price_per_day_usd,
        is_verified: dto.is_verified ?? false,
        province: dto.province,
        provinces: dto.provinces || [dto.province],
        is_active: dto.is_active ?? true,
        updated_at: now,
      },
    });

    if (dto.languages && dto.languages.length > 0) {
      await this.prisma.guide_languages.createMany({
        data: dto.languages.map((lang) => ({
          id: randomUUID(),
          guide_id: guideId,
          language: lang as any,
        })),
      });
    }

    if (dto.specialties && dto.specialties.length > 0) {
      await this.prisma.guide_specialities.createMany({
        data: dto.specialties.map((spec) => ({
          id: randomUUID(),
          guide_id: guideId,
          speciality: spec,
        })),
      });
    }

    return {
      id: guide.id,
      user_id: guide.user_id,
      bio: guide.bio,
      avatar_url: guide.avatar_url,
      images: guide.images,
      price_per_day_usd: Number(guide.price_per_day_usd),
      is_verified: guide.is_verified,
      province: guide.province,
      provinces: guide.provinces,
      is_active: guide.is_active,
      languages: dto.languages || [],
      specialties: dto.specialties || [],
      created_at: guide.created_at,
      updated_at: guide.updated_at,
    };
  }

  async updateGuide(
    id: string,
    dto: {
      bio?: string;
      languages?: string[];
      specialties?: string[];
      province?: string;
      provinces?: string[];
      price_per_day_usd?: number;
      avatar_url?: string;
      images?: string[];
      is_verified?: boolean;
      is_active?: boolean;
    },
  ) {
    const existing = await this.prisma.guides.findUnique({
      where: { id },
      include: {
        guide_languages: true,
        guide_specialities: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Guide with id ${id} not found`);
    }

    const guide = await this.prisma.guides.update({
      where: { id },
      data: {
        bio: dto.bio,
        avatar_url: dto.avatar_url,
        images: dto.images,
        price_per_day_usd: dto.price_per_day_usd,
        is_verified: dto.is_verified,
        province: dto.province,
        provinces: dto.provinces,
        is_active: dto.is_active,
        updated_at: new Date(),
      },
    });

    if (dto.languages !== undefined) {
      await this.prisma.guide_languages.deleteMany({
        where: { guide_id: id },
      });
      if (dto.languages.length > 0) {
        await this.prisma.guide_languages.createMany({
          data: dto.languages.map((lang) => ({
            id: randomUUID(),
            guide_id: id,
            language: lang as any,
          })),
        });
      }
    }

    if (dto.specialties !== undefined) {
      await this.prisma.guide_specialities.deleteMany({
        where: { guide_id: id },
      });
      if (dto.specialties.length > 0) {
        await this.prisma.guide_specialities.createMany({
          data: dto.specialties.map((spec) => ({
            id: randomUUID(),
            guide_id: id,
            speciality: spec,
          })),
        });
      }
    }

    const finalLanguages =
      dto.languages !== undefined
        ? dto.languages
        : existing.guide_languages.map((l) => l.language);
    const finalSpecialties =
      dto.specialties !== undefined
        ? dto.specialties
        : existing.guide_specialities.map((s) => s.speciality);

    return {
      id: guide.id,
      user_id: guide.user_id,
      bio: guide.bio,
      avatar_url: guide.avatar_url,
      images: guide.images,
      price_per_day_usd: Number(guide.price_per_day_usd),
      is_verified: guide.is_verified,
      province: guide.province,
      provinces: guide.provinces,
      is_active: guide.is_active,
      languages: finalLanguages,
      specialties: finalSpecialties,
      created_at: guide.created_at,
      updated_at: guide.updated_at,
    };
  }

  async getGuideAssignments(guideId: string) {
    const guide = await this.prisma.guides.findUnique({
      where: { id: guideId },
      select: { id: true },
    });

    if (!guide) {
      throw new NotFoundException(`Guide with id ${guideId} not found`);
    }

    const assignments = await this.prisma.booking_items.findMany({
      where: { guide_id: guideId },
      orderBy: { date: 'desc' },
      include: {
        bookings: {
          select: {
            id: true,
            reference: true,
            status: true,
            start_date: true,
            end_date: true,
            userId: true,
          },
        },
        hotel_rooms: {
          select: { room_type: true },
        },
      },
    });

    return assignments.map((item) => ({
      id: item.id,
      booking_id: item.booking_id,
      reference: item.bookings.reference,
      status: item.bookings.status,
      date: item.date,
      quantity: item.quantity,
      unit_price_usd: Number(item.unit_price_usd),
      subtotal_usd: Number(item.subtotal_usd),
      customer_id: item.bookings.userId,
      room_type: item.hotel_rooms?.room_type || null,
    }));
  }

  async getGuideAvailability(
    guideId: string,
    startDate: string,
    endDate: string,
  ) {
    const guide = await this.prisma.guides.findUnique({
      where: { id: guideId },
      select: { id: true, is_active: true },
    });

    if (!guide) {
      throw new NotFoundException(`Guide with id ${guideId} not found`);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const overlappingItems = await this.prisma.booking_items.findMany({
      where: {
        guide_id: guideId,
        date: {
          gte: start,
          lte: end,
        },
        bookings: {
          status: { not: 'cancelled' },
        },
      },
      include: {
        bookings: {
          select: {
            id: true,
            reference: true,
            status: true,
            start_date: true,
            end_date: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    const bookedDates = overlappingItems.map((item) => ({
      date: item.date,
      booking_id: item.bookings.id,
      reference: item.bookings.reference,
      status: item.bookings.status,
    }));

    const isAvailable = bookedDates.length === 0 && guide.is_active;

    return {
      guide_id: guideId,
      is_available: isAvailable,
      is_active: guide.is_active,
      requested_range: { start_date: start, end_date: end },
      booked_dates: bookedDates,
      total_booked_days: bookedDates.length,
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
