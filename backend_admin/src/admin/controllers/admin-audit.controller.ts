import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminAuditService } from '../services/admin-audit.service';
import { AdminRole } from '@prisma/client';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';

@Controller('v1/admin/audit-logs')
@UseGuards(JwtAuthGuard, AdminGuard, AdminRoleGuard)
@AdminRoles(AdminRole.SUPER_ADMIN)
export class AdminAuditController {
  constructor(private readonly service: AdminAuditService) {}

  @Get()
  async getAllAuditLogs(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('admin_user_id') adminUserId?: string,
    @Query('action_type') actionType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.service.getAllAuditLogs({
      startDate,
      endDate,
      adminUserId,
      actionType,
      page,
      limit,
    });
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Post()
  async createAuditLog(
    @Body() dto: CreateAuditLogDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.createAuditLog({
      userId,
      eventType: dto.event_type,
      entityType: dto.entity_type,
      entityId: dto.entity_id,
      ipAddress: dto.ip_address,
      userAgent: dto.user_agent,
      metadata: dto.metadata,
    });

    return {
      success: true,
      data: result,
      message: 'Audit log entry created successfully',
      error: null,
    };
  }

  @Get('export')
  async exportAuditLogs(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('admin_user_id') adminUserId?: string,
    @Query('action_type') actionType?: string,
  ) {
    const result = await this.service.exportAuditLogs({
      startDate,
      endDate,
      adminUserId,
      actionType,
    });

    return {
      success: true,
      data: result,
      message: 'Audit logs exported successfully',
      error: null,
    };
  }
}
