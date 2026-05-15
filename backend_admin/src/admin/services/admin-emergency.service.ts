import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { emergency_alert_status, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { EmergencyDetailResponseDto } from '../dto/emergency-detail-response.dto';

@Injectable()
export class AdminEmergencyService {
  private readonly logger = new Logger(AdminEmergencyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getAllEmergencyAlerts(filters: {
    status?: string;
    alertType?: string;
    page?: string;
    limit?: string;
  }) {
    const { status, alertType, page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const where: Prisma.EmergencyAlertWhereInput = {};

    if (status) {
      where.status = status as emergency_alert_status;
    }

    if (alertType) {
      where.alertType = alertType as any;
    }

    const [data, total] = await Promise.all([
      this.prisma.emergencyAlert.findMany({
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
          driver: {
            select: {
              id: true,
              driverName: true,
              phone: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.emergencyAlert.count({ where }),
    ]);

    const mapped = data.map((alert) => ({
      id: alert.id,
      userId: alert.userId,
      user: alert.users,
      alertType: alert.alertType,
      status: alert.status,
      latitude: Number(alert.latitude),
      longitude: Number(alert.longitude),
      accuracy_meters: alert.accuracy_meters ? Number(alert.accuracy_meters) : null,
      acknowledged_at: alert.acknowledged_at,
      acknowledged_by: alert.acknowledged_by,
      resolved_at: alert.resolved_at,
      notes: alert.notes,
      driver: alert.driver,
      createdAt: alert.createdAt,
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

  async getEmergencyAlertById(id: string): Promise<EmergencyDetailResponseDto> {
    const alert = await this.prisma.emergencyAlert.findUnique({
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
        driver: {
          select: {
            id: true,
            driverName: true,
            phone: true,
            status: true,
          },
        },
      },
    });

    if (!alert) {
      throw new NotFoundException(`Emergency alert with id ${id} not found`);
    }

    return {
      id: alert.id,
      userId: alert.userId,
      user: alert.users,
      alertType: alert.alertType,
      status: alert.status,
      latitude: Number(alert.latitude),
      longitude: Number(alert.longitude),
      accuracy_meters: alert.accuracy_meters ? Number(alert.accuracy_meters) : null,
      acknowledged_at: alert.acknowledged_at,
      acknowledged_by: alert.acknowledged_by,
      resolved_at: alert.resolved_at,
      notes: alert.notes,
      driver: alert.driver,
      createdAt: alert.createdAt,
    };
  }

  async acknowledgeAlert(id: string, acknowledgedBy?: string) {
    const existing = await this.prisma.emergencyAlert.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Emergency alert with id ${id} not found`);
    }

    if (existing.status === emergency_alert_status.resolved) {
      throw new NotFoundException('Cannot acknowledge a resolved alert');
    }

    if (existing.status === emergency_alert_status.cancelled) {
      throw new NotFoundException('Cannot acknowledge a cancelled alert');
    }

    const alert = await this.prisma.emergencyAlert.update({
      where: { id },
      data: {
        status: emergency_alert_status.acknowledged,
        acknowledged_at: new Date(),
        acknowledged_by: acknowledgedBy || null,
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            full_name: true,
            phone: true,
          },
        },
        driver: {
          select: {
            id: true,
            driverName: true,
            phone: true,
            status: true,
          },
        },
      },
    });

    await this.publishEmergencyEvent({
      alert_id: alert.id,
      alert_type: alert.alertType,
      status: alert.status,
      user_id: alert.userId,
      lat: Number(alert.latitude),
      lng: Number(alert.longitude),
      timestamp: new Date().toISOString(),
      action: 'ACKNOWLEDGED',
    });

    return {
      id: alert.id,
      userId: alert.userId,
      user: alert.users,
      alertType: alert.alertType,
      status: alert.status,
      latitude: Number(alert.latitude),
      longitude: Number(alert.longitude),
      accuracy_meters: alert.accuracy_meters ? Number(alert.accuracy_meters) : null,
      acknowledged_at: alert.acknowledged_at,
      acknowledged_by: alert.acknowledged_by,
      resolved_at: alert.resolved_at,
      notes: alert.notes,
      driver: alert.driver,
      createdAt: alert.createdAt,
    };
  }

  async resolveAlert(id: string, notes?: string, resolvedBy?: string) {
    const existing = await this.prisma.emergencyAlert.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Emergency alert with id ${id} not found`);
    }

    if (existing.status === emergency_alert_status.resolved) {
      throw new NotFoundException('Alert is already resolved');
    }

    if (existing.status === emergency_alert_status.cancelled) {
      throw new NotFoundException('Cannot resolve a cancelled alert');
    }

    const alert = await this.prisma.emergencyAlert.update({
      where: { id },
      data: {
        status: emergency_alert_status.resolved,
        resolved_at: new Date(),
        notes: notes || existing.notes,
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            full_name: true,
            phone: true,
          },
        },
        driver: {
          select: {
            id: true,
            driverName: true,
            phone: true,
            status: true,
          },
        },
      },
    });

    await this.publishEmergencyEvent({
      alert_id: alert.id,
      alert_type: alert.alertType,
      status: alert.status,
      user_id: alert.userId,
      lat: Number(alert.latitude),
      lng: Number(alert.longitude),
      timestamp: new Date().toISOString(),
      action: 'RESOLVED',
      notes: notes || undefined,
    });

    return {
      id: alert.id,
      userId: alert.userId,
      user: alert.users,
      alertType: alert.alertType,
      status: alert.status,
      latitude: Number(alert.latitude),
      longitude: Number(alert.longitude),
      accuracy_meters: alert.accuracy_meters ? Number(alert.accuracy_meters) : null,
      acknowledged_at: alert.acknowledged_at,
      acknowledged_by: alert.acknowledged_by,
      resolved_at: alert.resolved_at,
      notes: alert.notes,
      driver: alert.driver,
      createdAt: alert.createdAt,
    };
  }

  private async publishEmergencyEvent(payload: {
    alert_id: string;
    alert_type: string;
    status: string;
    user_id: string;
    lat: number;
    lng: number;
    timestamp: string;
    action: string;
    notes?: string;
  }): Promise<void> {
    const channel = 'emergency_alerts';

    try {
      await this.redis.getClient().publish(channel, JSON.stringify(payload));
      this.logger.debug(`Published emergency event to ${channel}`);
    } catch (err) {
      this.logger.warn(`Redis publish failed: ${err.message}`);
    }
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
