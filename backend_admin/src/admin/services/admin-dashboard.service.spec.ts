import { Test, TestingModule } from '@nestjs/testing';
import { AdminDashboardService } from './admin-dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminRole } from '@prisma/client';

describe('AdminDashboardService', () => {
  let service: AdminDashboardService;

  const mockPrisma = {
    booking: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    driver: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    driverAssignment: {
      findMany: jest.fn(),
    },
    vehicleMaintenance: {
      count: jest.fn(),
    },
    emergencyAlert: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminDashboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminDashboardService>(AdminDashboardService);
  });

  describe('getDashboardOverview', () => {
    it('should return full overview for SUPER_ADMIN', async () => {
      mockPrisma.booking.count.mockResolvedValue(5);
      mockPrisma.booking.aggregate.mockResolvedValue({ _sum: { totalUsd: 1000 } });
      mockPrisma.driver.count.mockResolvedValue(3);
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.driverAssignment.findMany.mockResolvedValue([]);
      mockPrisma.vehicleMaintenance.count.mockResolvedValue(2);
      mockPrisma.emergencyAlert.findMany.mockResolvedValue([]);
      mockPrisma.driver.groupBy.mockResolvedValue([
        { status: 'AVAILABLE', _count: { _all: 2 } },
        { status: 'BUSY', _count: { _all: 1 } },
      ]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const result = await service.getDashboardOverview(AdminRole.SUPER_ADMIN);

      expect(result.total_bookings_today).toBe(5);
      expect(result.total_revenue_today).toBe(1000);
      expect(result.active_drivers_count).toBe(3);
      expect(result.booking_trends).toHaveLength(30);
      expect(result.driver_summary).toEqual({ AVAILABLE: 2, BUSY: 1, OFFLINE: 0 });
    });

    it('should return fleet metrics for FLEET_MANAGER', async () => {
      mockPrisma.driver.count.mockResolvedValue(3);
      mockPrisma.vehicleMaintenance.count.mockResolvedValue(2);
      mockPrisma.emergencyAlert.findMany.mockResolvedValue([]);
      mockPrisma.driver.groupBy.mockResolvedValue([
        { status: 'AVAILABLE', _count: { _all: 2 } },
        { status: 'OFFLINE', _count: { _all: 1 } },
      ]);

      const result = await service.getDashboardOverview(AdminRole.FLEET_MANAGER);

      expect(result.active_drivers_count).toBe(3);
      expect(result.total_bookings_today).toBeUndefined();
      expect(result.pending_actions?.upcoming_maintenance).toBe(2);
    });

    it('should return support metrics for SUPPORT_AGENT', async () => {
      mockPrisma.booking.count.mockResolvedValue(5);
      mockPrisma.booking.aggregate.mockResolvedValue({ _sum: { totalUsd: 500 } });
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.driverAssignment.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const result = await service.getDashboardOverview(AdminRole.SUPPORT_AGENT);

      expect(result.total_bookings_today).toBe(5);
      expect(result.total_revenue_today).toBe(500);
      expect(result.active_drivers_count).toBeUndefined();
      expect(result.pending_actions?.unassigned_bookings).toBeDefined();
    });

    it('should return full overview when no role specified', async () => {
      mockPrisma.booking.count.mockResolvedValue(0);
      mockPrisma.booking.aggregate.mockResolvedValue({ _sum: { totalUsd: 0 } });
      mockPrisma.driver.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.driverAssignment.findMany.mockResolvedValue([]);
      mockPrisma.vehicleMaintenance.count.mockResolvedValue(0);
      mockPrisma.emergencyAlert.findMany.mockResolvedValue([]);
      mockPrisma.driver.groupBy.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const result = await service.getDashboardOverview();

      expect(result.total_bookings_today).toBe(0);
      expect(result.booking_trends).toHaveLength(30);
    });

    it('should fill booking trends with zeros for days without data', async () => {
      mockPrisma.booking.count.mockResolvedValue(0);
      mockPrisma.booking.aggregate.mockResolvedValue({ _sum: { totalUsd: 0 } });
      mockPrisma.driver.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.driverAssignment.findMany.mockResolvedValue([]);
      mockPrisma.vehicleMaintenance.count.mockResolvedValue(0);
      mockPrisma.emergencyAlert.findMany.mockResolvedValue([]);
      mockPrisma.driver.groupBy.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const result = await service.getDashboardOverview();

      expect(result.booking_trends.every((t: any) => t.count === 0)).toBe(true);
    });
  });
});
