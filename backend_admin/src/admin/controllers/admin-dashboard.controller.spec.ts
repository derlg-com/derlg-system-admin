import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from '../services/admin-dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AdminRole } from '@prisma/client';

describe('AdminDashboardController', () => {
  let controller: AdminDashboardController;

  const mockService = {
    getDashboardOverview: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminDashboardController],
      providers: [
        { provide: AdminDashboardService, useValue: mockService },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: { getClient: jest.fn() } },
        Reflector,
      ],
    }).compile();

    controller = module.get<AdminDashboardController>(AdminDashboardController);
  });

  describe('getDashboard', () => {
    it('should return dashboard data with envelope', async () => {
      mockService.getDashboardOverview.mockResolvedValue({
        total_bookings_today: 10,
        total_revenue_today: 5000,
      });

      const req = { adminUser: { adminRole: AdminRole.SUPER_ADMIN } } as any;
      const result = await controller.getDashboard(req);

      expect(result.success).toBe(true);
      expect(result.data.total_bookings_today).toBe(10);
      expect(mockService.getDashboardOverview).toHaveBeenCalledWith(
        AdminRole.SUPER_ADMIN,
      );
    });

    it('should pass role from request to service', async () => {
      mockService.getDashboardOverview.mockResolvedValue({
        active_drivers_count: 5,
      });

      const req = { adminUser: { adminRole: AdminRole.FLEET_MANAGER } } as any;
      await controller.getDashboard(req);

      expect(mockService.getDashboardOverview).toHaveBeenCalledWith(
        AdminRole.FLEET_MANAGER,
      );
    });

    it('should handle request without adminUser', async () => {
      mockService.getDashboardOverview.mockResolvedValue({
        total_bookings_today: 0,
      });

      const req = {} as any;
      const result = await controller.getDashboard(req);

      expect(result.success).toBe(true);
      expect(mockService.getDashboardOverview).toHaveBeenCalledWith(undefined);
    });
  });
});
