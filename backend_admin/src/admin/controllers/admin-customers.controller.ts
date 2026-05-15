import {
  Controller,
  Get,
  Post,
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
import { AdminCustomersService } from '../services/admin-customers.service';
import { AdminRole } from '@prisma/client';
import { AdjustLoyaltyDto } from '../dto/adjust-loyalty.dto';

@Controller('v1/admin/customers')
@UseGuards(JwtAuthGuard, AdminGuard, AdminRoleGuard)
@AdminRoles(AdminRole.SUPPORT_AGENT, AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)
export class AdminCustomersController {
  constructor(private readonly service: AdminCustomersService) {}

  @Get()
  async getAllCustomers(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getAllCustomers({ search, page, limit });
  }

  @Get(':id')
  async getCustomerById(@Param('id') id: string) {
    return this.service.getCustomerById(id);
  }

  @Get(':id/reviews')
  async getCustomerReviews(@Param('id') id: string) {
    const reviews = await this.service.getCustomerReviews(id);
    return {
      success: true,
      data: reviews,
      message: 'ok',
      error: null,
    };
  }
}

@Controller('v1/admin/loyalty')
@UseGuards(JwtAuthGuard, AdminGuard, AdminRoleGuard)
@AdminRoles(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)
export class AdminLoyaltyController {
  constructor(private readonly service: AdminCustomersService) {}

  @Post('adjust')
  async adjustLoyaltyPoints(
    @Body() dto: AdjustLoyaltyDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.adjustLoyaltyPoints(dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'USER',
      entityId: dto.user_id,
      metadata: {
        action: 'ADJUST_LOYALTY',
        adjustment: dto.points,
        previousBalance: result.previous_balance,
        newBalance: result.new_balance,
        description: dto.description,
      },
    });

    return {
      success: true,
      data: result,
      message: 'Loyalty points adjusted successfully',
      error: null,
    };
  }
}
