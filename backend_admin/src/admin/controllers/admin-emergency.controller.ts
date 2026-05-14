import {
  Controller,
  Get,
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
import { AdminEmergencyService } from '../services/admin-emergency.service';
import { AdminRole } from '@prisma/client';
import { UpdateEmergencyDto } from '../dto/update-emergency.dto';

@Controller('v1/admin/emergency')
@UseGuards(JwtAuthGuard, AdminGuard, AdminRoleGuard)
@AdminRoles(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)
export class AdminEmergencyController {
  constructor(private readonly service: AdminEmergencyService) {}

  @Get()
  async getAllEmergencyAlerts(
    @Query('status') status?: string,
    @Query('alert_type') alertType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getAllEmergencyAlerts({ status, alertType, page, limit });
  }

  @Get(':id')
  async getEmergencyAlertById(@Param('id') id: string) {
    return this.service.getEmergencyAlertById(id);
  }

  @Patch(':id')
  async updateEmergencyAlert(
    @Param('id') id: string,
    @Body() dto: UpdateEmergencyDto,
    @CurrentUser('sub') userId?: string,
  ) {
    let alert;
    let action: string;

    if (dto.status === 'acknowledged') {
      alert = await this.service.acknowledgeAlert(id, userId);
      action = 'ACKNOWLEDGE_EMERGENCY';
    } else if (dto.status === 'resolved') {
      alert = await this.service.resolveAlert(id, dto.notes, userId);
      action = 'RESOLVE_EMERGENCY';
    } else {
      throw new Error('Invalid status transition. Use "acknowledged" or "resolved"');
    }

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'EMERGENCY',
      entityId: id,
      metadata: {
        action,
        newStatus: alert.status,
        notes: dto.notes,
      },
    });

    return {
      success: true,
      data: alert,
      message: 'ok',
      error: null,
    };
  }
}
