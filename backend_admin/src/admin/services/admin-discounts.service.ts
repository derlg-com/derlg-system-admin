import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { verification_status } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminDiscountsService {
  private readonly logger = new Logger(AdminDiscountsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllDiscountCodes(filters: { page?: string; limit?: string }) {
    const { page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const [data, total] = await Promise.all([
      this.prisma.discount_codes.findMany({
        skip,
        take,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.discount_codes.count(),
    ]);

    const mapped = data.map((code) => ({
      id: code.id,
      code: code.code,
      discount_type: code.discount_type,
      value: Number(code.value),
      max_uses: code.max_uses,
      current_uses: code.current_uses,
      min_booking_usd: code.min_booking_usd ? Number(code.min_booking_usd) : null,
      valid_from: code.valid_from,
      valid_until: code.valid_until,
      is_active: code.is_active,
      festival_id: code.festival_id,
      booking_type: code.booking_type,
      user_id: code.user_id,
      created_at: code.created_at,
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

  async createDiscountCode(dto: {
    code: string;
    discount_type: string;
    value: number;
    max_uses?: number;
    min_booking_usd?: number;
    valid_from: string;
    valid_until: string;
    booking_type?: string;
    is_active?: boolean;
  }) {
    const existing = await this.prisma.discount_codes.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(`Discount code '${dto.code}' already exists`);
    }

    const codeId = randomUUID();

    return this.prisma.discount_codes.create({
      data: {
        id: codeId,
        code: dto.code,
        discount_type: dto.discount_type as any,
        value: dto.value,
        max_uses: dto.max_uses || null,
        min_booking_usd: dto.min_booking_usd || null,
        valid_from: new Date(dto.valid_from),
        valid_until: new Date(dto.valid_until),
        booking_type: dto.booking_type as any,
        is_active: dto.is_active ?? true,
      },
    });
  }

  async updateDiscountCode(
    id: string,
    dto: {
      code?: string;
      discount_type?: string;
      value?: number;
      max_uses?: number;
      min_booking_usd?: number;
      valid_from?: string;
      valid_until?: string;
      booking_type?: string;
      is_active?: boolean;
    },
  ) {
    const existing = await this.prisma.discount_codes.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Discount code with id ${id} not found`);
    }

    if (dto.code && dto.code !== existing.code) {
      const conflict = await this.prisma.discount_codes.findUnique({
        where: { code: dto.code },
      });
      if (conflict) {
        throw new ConflictException(`Discount code '${dto.code}' already exists`);
      }
    }

    return this.prisma.discount_codes.update({
      where: { id },
      data: {
        code: dto.code,
        discount_type: dto.discount_type as any,
        value: dto.value,
        max_uses: dto.max_uses,
        min_booking_usd: dto.min_booking_usd,
        valid_from: dto.valid_from ? new Date(dto.valid_from) : undefined,
        valid_until: dto.valid_until ? new Date(dto.valid_until) : undefined,
        booking_type: dto.booking_type as any,
        is_active: dto.is_active,
      },
    });
  }

  async deactivateDiscountCode(id: string) {
    const existing = await this.prisma.discount_codes.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Discount code with id ${id} not found`);
    }

    return this.prisma.discount_codes.update({
      where: { id },
      data: {
        is_active: false,
      },
    });
  }

  async getAllStudentVerifications(filters: {
    status?: string;
    page?: string;
    limit?: string;
  }) {
    const { status, page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.student_verifications.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              full_name: true,
              phone: true,
              is_student_verified: true,
            },
          },
        },
      }),
      this.prisma.student_verifications.count({ where }),
    ]);

    const mapped = data.map((v) => ({
      id: v.id,
      user_id: v.user_id,
      user: v.users,
      id_card_image_url: v.id_card_image_url,
      selfie_image_url: v.selfie_image_url,
      status: v.status,
      reviewed_by_id: v.reviewed_by_id,
      review_notes: v.review_notes,
      reviewed_at: v.reviewed_at,
      expires_at: v.expires_at,
      created_at: v.created_at,
      updated_at: v.updated_at,
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

  async reviewStudentVerification(
    id: string,
    dto: {
      status: verification_status;
      review_notes?: string;
    },
    reviewedById?: string,
  ) {
    const existing = await this.prisma.student_verifications.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true, is_student_verified: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Student verification with id ${id} not found`);
    }

    const verification = await this.prisma.student_verifications.update({
      where: { id },
      data: {
        status: dto.status,
        review_notes: dto.review_notes || existing.review_notes,
        reviewed_by_id: reviewedById || existing.reviewed_by_id,
        reviewed_at: new Date(),
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            full_name: true,
            phone: true,
            is_student_verified: true,
          },
        },
      },
    });

    if (dto.status === verification_status.approved) {
      await this.prisma.user.update({
        where: { id: verification.user_id },
        data: { is_student_verified: true },
      });
    } else if (dto.status === verification_status.rejected) {
      await this.prisma.user.update({
        where: { id: verification.user_id },
        data: { is_student_verified: false },
      });
    }

    return {
      id: verification.id,
      user_id: verification.user_id,
      user: verification.users,
      status: verification.status,
      reviewed_by_id: verification.reviewed_by_id,
      review_notes: verification.review_notes,
      reviewed_at: verification.reviewed_at,
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
