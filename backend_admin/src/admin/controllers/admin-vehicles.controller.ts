import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminVehiclesService } from '../services/admin-vehicles.service';
import { AdminRole } from '@prisma/client';
import { CreateVehicleDto } from '../dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../dto/update-vehicle.dto';

@Controller('admin/vehicles')
@UseGuards(JwtAuthGuard, AdminGuard, AdminRoleGuard)
@AdminRoles(AdminRole.FLEET_MANAGER, AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)
export class AdminVehiclesController {
  constructor(private readonly service: AdminVehiclesService) {}

  @Get()
  async getAllVehicles(
    @Query('category') category?: string,
    @Query('tier') tier?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getAllVehicles({ category, tier, search, page, limit });
  }

  @Get(':id')
  async getVehicleById(@Param('id') id: string) {
    return this.service.getVehicleById(id);
  }

  @Get(':id/availability')
  async getVehicleAvailability(@Param('id') id: string) {
    return this.service.getVehicleAvailability(id);
  }

  @Post()
  async createVehicle(
    @Body() dto: CreateVehicleDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const vehicle = await this.service.createVehicle(dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'VEHICLE',
      entityId: vehicle.id,
      metadata: {
        action: 'CREATE_VEHICLE',
        name: vehicle.name,
        vehicleType: vehicle.vehicle_type,
      },
    });

    return {
      success: true,
      data: vehicle,
      message: 'ok',
      error: null,
    };
  }

  @Patch(':id')
  async updateVehicle(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const vehicle = await this.service.updateVehicle(id, dto, userId);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'VEHICLE',
      entityId: vehicle.id,
      metadata: {
        action: 'UPDATE_VEHICLE',
        changedFields: Object.keys(dto),
      },
    });

    return {
      success: true,
      data: vehicle,
      message: 'ok',
      error: null,
    };
  }
}
