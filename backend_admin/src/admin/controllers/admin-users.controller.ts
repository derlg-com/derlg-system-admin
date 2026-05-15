import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminUsersService } from '../services/admin-users.service';
import { AdminRole } from '@prisma/client';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UpdateAdminUserDto } from '../dto/update-admin-user.dto';

@Controller('v1/admin/users')
@UseGuards(JwtAuthGuard, AdminGuard, AdminRoleGuard)
@AdminRoles(AdminRole.SUPER_ADMIN)
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get()
  async getAllAdminUsers() {
    const result = await this.service.getAllAdminUsers();
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Post()
  async createAdminUser(
    @Body() dto: CreateAdminUserDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.createAdminUser(dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'ADMIN_USER',
      entityId: result.id,
      metadata: {
        action: 'CREATE_ADMIN_USER',
        email: result.email,
        admin_role: result.admin_role,
      },
    });

    return {
      success: true,
      data: result,
      message: 'Admin user created successfully',
      error: null,
    };
  }

  @Patch(':id')
  async updateAdminUser(
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.updateAdminUser(id, dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'ADMIN_USER',
      entityId: id,
      metadata: {
        action: 'UPDATE_ADMIN_USER',
        fields: Object.keys(dto),
      },
    });

    return {
      success: true,
      data: result,
      message: 'Admin user updated successfully',
      error: null,
    };
  }

  @Patch(':id/deactivate')
  async deactivateAdminUser(
    @Param('id') id: string,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.deactivateAdminUser(id);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'ADMIN_USER',
      entityId: id,
      metadata: {
        action: 'DEACTIVATE_ADMIN_USER',
        user_id: result.userId,
      },
    });

    return {
      success: true,
      data: result,
      message: 'Admin user deactivated successfully',
      error: null,
    };
  }
}
