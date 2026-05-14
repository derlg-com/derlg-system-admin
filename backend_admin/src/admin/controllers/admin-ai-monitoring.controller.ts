import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminAIMonitoringService } from '../services/admin-ai-monitoring.service';
import { AdminRole } from '@prisma/client';

@Controller('v1/admin/ai-sessions')
@UseGuards(JwtAuthGuard, AdminGuard, AdminRoleGuard)
@AdminRoles(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)
export class AdminAIMonitoringController {
  constructor(private readonly service: AdminAIMonitoringService) {}

  @Get('bookings')
  async getAIAssistedBookings(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const result = await this.service.getAIAssistedBookings({
      startDate,
      endDate,
    });
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Get(':sessionId')
  async getAISessionDetails(@Param('sessionId') sessionId: string) {
    const result = await this.service.getAISessionDetails(sessionId);

    if (result === null) {
      throw new NotFoundException('Session not found');
    }

    if (result.expired) {
      return {
        success: false,
        data: null,
        message: 'Session expired',
        error: 'Session expired',
      };
    }

    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Get('metrics/success-rate')
  async getAIBookingSuccessRate(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const result = await this.service.getAIBookingSuccessRate({
      startDate,
      endDate,
    });
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Get('metrics/performance')
  async getAIPerformanceMetrics(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const result = await this.service.getAIPerformanceMetrics({
      startDate,
      endDate,
    });
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }
}
