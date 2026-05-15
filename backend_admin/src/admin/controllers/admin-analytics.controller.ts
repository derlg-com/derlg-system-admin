import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminAnalyticsService } from '../services/admin-analytics.service';
import { AdminRole } from '@prisma/client';

@Controller('v1/admin/analytics')
@UseGuards(JwtAuthGuard, AdminGuard, AdminRoleGuard)
@AdminRoles(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)
export class AdminAnalyticsController {
  constructor(private readonly service: AdminAnalyticsService) {}

  @Get('revenue')
  async getRevenueAnalytics(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const result = await this.service.getRevenueAnalytics({
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

  @Get('bookings')
  async getBookingStatistics() {
    const result = await this.service.getBookingStatistics();
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Get('drivers')
  async getDriverPerformance() {
    const result = await this.service.getDriverPerformance();
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Get('destinations')
  async getPopularDestinations() {
    const result = await this.service.getPopularDestinations();
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Get('hotels')
  async getHotelOccupancy() {
    const result = await this.service.getHotelOccupancy();
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Get('guides')
  async getGuideUtilization() {
    const result = await this.service.getGuideUtilization();
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Get('ai-bookings')
  async getAIAssistedBookings() {
    const result = await this.service.getAIAssistedBookings();
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Get('ai-performance')
  async getAIPerformanceMetrics() {
    const result = await this.service.getAIPerformanceMetrics();
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Get('export')
  async exportData(
    @Query('format') format: string,
    @Query('metric') metric?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.exportData({
      format,
      metric,
      startDate,
      endDate,
    });

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'ANALYTICS_EXPORT',
      metadata: {
        action: 'EXPORT_DATA',
        format,
        metric,
        startDate,
        endDate,
      },
    });

    return {
      success: true,
      data: result,
      message: 'Export generated successfully',
      error: null,
    };
  }
}
