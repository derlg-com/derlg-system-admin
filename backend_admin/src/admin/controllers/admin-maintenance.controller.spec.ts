import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminMaintenanceController } from './admin-maintenance.controller';
import { AdminMaintenanceService } from '../services/admin-maintenance.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

describe('AdminMaintenanceController', () => {
  let controller: AdminMaintenanceController;
  let service: AdminMaintenanceService;

  const mockMaintenance = {
    id: 'maint-1',
    vehicleId: 'vehicle-1',
    maintenanceType: 'Oil Change',
    status: 'SCHEDULED',
  };

  const mockService = {
    getMaintenanceSchedule: jest.fn(),
    getUpcomingMaintenance: jest.fn(),
    getMaintenanceHistory: jest.fn(),
    scheduleMaintenance: jest.fn(),
    updateMaintenanceStatus: jest.fn(),
    createAuditLog: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminMaintenanceController],
      providers: [
        { provide: AdminMaintenanceService, useValue: mockService },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: { getClient: jest.fn() } },
        Reflector,
      ],
    }).compile();

    controller = module.get<AdminMaintenanceController>(AdminMaintenanceController);
    service = module.get<AdminMaintenanceService>(AdminMaintenanceService);
  });

  describe('getMaintenanceSchedule', () => {
    it('should return maintenance schedule', async () => {
      mockService.getMaintenanceSchedule.mockResolvedValue({
        data: [mockMaintenance],
        meta: {},
      });

      const result = await controller.getMaintenanceSchedule();

      expect(result.data).toHaveLength(1);
    });
  });

  describe('getUpcomingMaintenance', () => {
    it('should return upcoming maintenance', async () => {
      mockService.getUpcomingMaintenance.mockResolvedValue([mockMaintenance]);

      const result = await controller.getUpcomingMaintenance();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getMaintenanceHistory', () => {
    it('should return history for vehicle', async () => {
      mockService.getMaintenanceHistory.mockResolvedValue([mockMaintenance]);

      const result = await controller.getMaintenanceHistory('vehicle-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('scheduleMaintenance', () => {
    it('should schedule maintenance and log audit', async () => {
      mockService.scheduleMaintenance.mockResolvedValue(mockMaintenance);
      mockService.createAuditLog.mockResolvedValue(undefined);

      const dto = {
        vehicleId: 'vehicle-1',
        maintenanceType: 'Oil Change',
        scheduledDate: '2026-06-01',
      };

      const result = await controller.scheduleMaintenance(dto, 'user-1');

      expect(result.success).toBe(true);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          entityType: 'VEHICLE_MAINTENANCE',
          metadata: expect.objectContaining({ action: 'SCHEDULE_MAINTENANCE' }),
        }),
      );
    });
  });

  describe('updateMaintenanceStatus', () => {
    it('should update status and log audit', async () => {
      mockService.updateMaintenanceStatus.mockResolvedValue(mockMaintenance);
      mockService.createAuditLog.mockResolvedValue(undefined);

      const dto = { status: 'IN_MAINTENANCE' as any };
      const result = await controller.updateMaintenanceStatus('maint-1', dto, 'user-1');

      expect(result.success).toBe(true);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          entityType: 'VEHICLE_MAINTENANCE',
          metadata: expect.objectContaining({ action: 'UPDATE_MAINTENANCE_STATUS' }),
        }),
      );
    });
  });
});
