import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { audit_event_type } from '@prisma/client';

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllAuditLogs(filters: {
    startDate?: string;
    endDate?: string;
    adminUserId?: string;
    actionType?: string;
    page?: string;
    limit?: string;
  }) {
    const { page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const where: any = {};
    if (filters.startDate || filters.endDate) {
      where.created_at = {};
      if (filters.startDate) where.created_at.gte = new Date(filters.startDate);
      if (filters.endDate) where.created_at.lte = new Date(filters.endDate);
    }
    if (filters.adminUserId) where.user_id = filters.adminUserId;
    if (filters.actionType) where.event_type = filters.actionType;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          users: {
            select: { email: true, full_name: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const mapped = data.map((log) => ({
      id: log.id,
      user_id: log.user_id,
      user: log.users,
      event_type: log.event_type,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      ip_address: log.ipAddress,
      user_agent: log.userAgent,
      metadata: log.metadata,
      created_at: log.created_at,
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

  async createAuditLog(params: {
    userId?: string;
    eventType: audit_event_type;
    entityType: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        user_id: params.userId || null,
        event_type: params.eventType,
        entity_type: params.entityType,
        entity_id: params.entityId || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        metadata: params.metadata || {},
      },
    });
  }

  async exportAuditLogs(filters: {
    startDate?: string;
    endDate?: string;
    adminUserId?: string;
    actionType?: string;
  }) {
    const where: any = {};
    if (filters.startDate || filters.endDate) {
      where.created_at = {};
      if (filters.startDate) where.created_at.gte = new Date(filters.startDate);
      if (filters.endDate) where.created_at.lte = new Date(filters.endDate);
    }
    if (filters.adminUserId) where.user_id = filters.adminUserId;
    if (filters.actionType) where.event_type = filters.actionType;

    const data = await this.prisma.auditLog.findMany({
      where,
      include: {
        users: {
          select: { email: true, full_name: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 5000,
    });

    const mapped = data.map((log) => ({
      id: log.id,
      user_id: log.user_id,
      user_email: log.users?.email || '',
      event_type: log.event_type,
      entity_type: log.entity_type,
      entity_id: log.entity_id || '',
      ip_address: log.ipAddress || '',
      created_at: log.created_at.toISOString(),
      metadata: JSON.stringify(log.metadata || {}),
    }));

    return { format: 'csv', content: this.toCsv(mapped) };
  }

  private toCsv(data: any[]): string {
    if (!data.length) return '';
    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
          return String(val);
        })
        .join(','),
    );
    return [headers.join(','), ...rows].join('\n');
  }
}
