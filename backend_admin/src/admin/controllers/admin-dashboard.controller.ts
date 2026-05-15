import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { AdminDashboardService } from '../services/admin-dashboard.service';

@Controller('v1/admin/dashboard')
@UseGuards(JwtAuthGuard, AdminGuard, AdminRoleGuard)
export class AdminDashboardController {
  constructor(private readonly service: AdminDashboardService) {}

  @Get()
  async getDashboard(@Req() req: Request) {
    const adminRole = (req as any).adminUser?.adminRole;
    const result = await this.service.getDashboardOverview(adminRole);
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }
}
