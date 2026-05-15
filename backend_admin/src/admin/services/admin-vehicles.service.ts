import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VehicleResponseDto } from '../dto/vehicle-response.dto';

@Injectable()
export class AdminVehiclesService {
  private readonly logger = new Logger(AdminVehiclesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllVehicles(filters: {
    category?: string;
    tier?: string;
    search?: string;
    page?: string;
    limit?: string;
  }) {
    const { category, search, page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const where: any = {};
    if (category) where.vehicle_type = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { license_plate: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.transportationVehicle.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transportationVehicle.count({ where }),
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

  async getVehicleById(id: string): Promise<VehicleResponseDto> {
    const vehicle = await this.prisma.transportationVehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with id ${id} not found`);
    }

    const assignedDriver = await this.prisma.driver.findFirst({
      where: { vehicleId: id },
      select: {
        id: true,
        driverName: true,
        driverId: true,
        status: true,
        phone: true,
      },
    });

    const maintenanceHistory = await this.prisma.vehicleMaintenance.findMany({
      where: { vehicleId: id },
      orderBy: { scheduledDate: 'desc' },
      select: {
        id: true,
        maintenanceType: true,
        scheduledDate: true,
        status: true,
      },
    });

    const activeMaintenance = maintenanceHistory.find(
      (m) => m.status === 'IN_MAINTENANCE' || m.status === 'SCHEDULED',
    );

    return {
      id: vehicle.id,
      name: vehicle.name,
      vehicle_type: vehicle.vehicle_type,
      license_plate: vehicle.license_plate,
      capacity: vehicle.capacity,
      pricing_model: vehicle.pricing_model,
      price_usd: Number(vehicle.price_usd),
      province: vehicle.province,
      images: vehicle.images,
      is_active: vehicle.is_active,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
      assignedDriver: assignedDriver || null,
      maintenanceStatus: activeMaintenance?.status || null,
      maintenanceHistory: maintenanceHistory.length > 0 ? maintenanceHistory : undefined,
    };
  }

  async createVehicle(dto: {
    name: string;
    vehicle_type: string;
    license_plate?: string;
    capacity: number;
    pricing_model: string;
    price_usd: number;
    province: string;
    images?: string[];
  }) {
    return this.prisma.transportationVehicle.create({
      data: {
        name: dto.name,
        vehicle_type: dto.vehicle_type as any,
        license_plate: dto.license_plate || null,
        capacity: dto.capacity,
        pricing_model: dto.pricing_model as any,
        price_usd: dto.price_usd,
        province: dto.province,
        images: dto.images || [],
      },
    });
  }

  async updateVehicle(
    id: string,
    dto: {
      name?: string;
      vehicle_type?: string;
      license_plate?: string;
      capacity?: number;
      pricing_model?: string;
      price_usd?: number;
      province?: string;
      images?: string[];
      is_active?: boolean;
    },
    adminUserId?: string,
  ) {
    const existing = await this.prisma.transportationVehicle.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Vehicle with id ${id} not found`);
    }

    const oldPrice = Number(existing.price_usd);
    const newPrice = dto.price_usd !== undefined ? dto.price_usd : oldPrice;

    const vehicle = await this.prisma.transportationVehicle.update({
      where: { id },
      data: {
        name: dto.name,
        vehicle_type: dto.vehicle_type as any,
        license_plate: dto.license_plate,
        capacity: dto.capacity,
        pricing_model: dto.pricing_model as any,
        price_usd: dto.price_usd,
        province: dto.province,
        images: dto.images,
        is_active: dto.is_active,
      },
    });

    if (dto.price_usd !== undefined && newPrice !== oldPrice) {
      await this.createAuditLog({
        userId: adminUserId,
        eventType: 'admin_action',
        entityType: 'VEHICLE',
        entityId: id,
        metadata: {
          action: 'PRICING_CHANGE',
          oldPrice,
          newPrice,
          vehicleName: vehicle.name,
        },
      });
    }

    return vehicle;
  }

  async getVehicleAvailability(id: string) {
    const vehicle = await this.prisma.transportationVehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with id ${id} not found`);
    }

    const assignedDriver = await this.prisma.driver.findFirst({
      where: { vehicleId: id },
      select: { status: true },
    });

    const activeMaintenance = await this.prisma.vehicleMaintenance.findFirst({
      where: {
        vehicleId: id,
        status: { in: ['SCHEDULED', 'IN_MAINTENANCE'] },
      },
    });

    const isAvailable =
      vehicle.is_active &&
      assignedDriver?.status === 'AVAILABLE' &&
      !activeMaintenance;

    return {
      vehicleId: id,
      isAvailable,
      reason: isAvailable
        ? 'Available for assignment'
        : !vehicle.is_active
          ? 'Vehicle is inactive'
          : activeMaintenance
            ? `Vehicle is in maintenance (${activeMaintenance.status})`
            : assignedDriver?.status !== 'AVAILABLE'
              ? `Assigned driver is ${assignedDriver?.status || 'not assigned'}`
              : 'Unavailable',
      driverStatus: assignedDriver?.status || null,
      maintenanceStatus: activeMaintenance?.status || null,
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
