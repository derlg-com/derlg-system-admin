import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MaintenanceStatus } from '@prisma/client';
import { AdminMaintenanceService } from './admin-maintenance.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockMaintenance = {
  id: 'maint-uuid-1',
  vehicleId: 'vehicle-uuid-1',
  maintenanceType: 'Oil Change',
  scheduledDate: new Date('2026-06-01'),
  completionDate: null,
  maintenanceCost: null,
  maintenanceNotes: 'Regular service',
  status: MaintenanceStatus.SCHEDULED,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockVehicle = {
  id: 'vehicle-uuid-1',
  name: 'Toyota Camry',
  license_plate: 'PP-1234',
};

describe('AdminMaintenanceService', () => {
  let service: AdminMaintenanceService;
  let prisma: PrismaService;

  const mockPrisma = {
    vehicleMaintenance: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    transportationVehicle: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminMaintenanceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminMaintenanceService>(AdminMaintenanceService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getMaintenanceSchedule', () => {
    it('should return paginated maintenance list', async () => {
      mockPrisma.vehicleMaintenance.findMany.mockResolvedValue([mockMaintenance]);
      mockPrisma.vehicleMaintenance.count.mockResolvedValue(1);
      mockPrisma.transportationVehicle.findMany.mockResolvedValue([mockVehicle]);

      const result = await service.getMaintenanceSchedule({});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by vehicle_id', async () => {
      mockPrisma.vehicleMaintenance.findMany.mockResolvedValue([mockMaintenance]);
      mockPrisma.vehicleMaintenance.count.mockResolvedValue(1);
      mockPrisma.transportationVehicle.findMany.mockResolvedValue([mockVehicle]);

      await service.getMaintenanceSchedule({ vehicleId: 'vehicle-uuid-1' });

      expect(mockPrisma.vehicleMaintenance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ vehicleId: 'vehicle-uuid-1' }),
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.vehicleMaintenance.findMany.mockResolvedValue([mockMaintenance]);
      mockPrisma.vehicleMaintenance.count.mockResolvedValue(1);
      mockPrisma.transportationVehicle.findMany.mockResolvedValue([mockVehicle]);

      await service.getMaintenanceSchedule({
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });

      expect(mockPrisma.vehicleMaintenance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            scheduledDate: expect.objectContaining({
              gte: new Date('2026-01-01'),
              lte: new Date('2026-12-31'),
            }),
          }),
        }),
      );
    });
  });

  describe('getUpcomingMaintenance', () => {
    it('should return maintenance within 3 days', async () => {
      mockPrisma.vehicleMaintenance.findMany.mockResolvedValue([mockMaintenance]);
      mockPrisma.transportationVehicle.findMany.mockResolvedValue([mockVehicle]);

      const result = await service.getUpcomingMaintenance();

      expect(result).toHaveLength(1);
    });
  });

  describe('getMaintenanceHistory', () => {
    it('should return history for vehicle with vehicle details', async () => {
      mockPrisma.vehicleMaintenance.findMany.mockResolvedValue([mockMaintenance]);
      mockPrisma.transportationVehicle.findUnique.mockResolvedValue(mockVehicle);

      const result = await service.getMaintenanceHistory('vehicle-uuid-1');

      expect(result).toHaveLength(1);
      expect(result[0].vehicle).toEqual(mockVehicle);
    });
  });

  describe('scheduleMaintenance', () => {
    it('should create maintenance record', async () => {
      mockPrisma.transportationVehicle.findUnique.mockResolvedValue(mockVehicle);
      mockPrisma.vehicleMaintenance.create.mockResolvedValue(mockMaintenance);

      const result = await service.scheduleMaintenance({
        vehicleId: 'vehicle-uuid-1',
        maintenanceType: 'Oil Change',
        scheduledDate: '2026-06-01',
        maintenanceNotes: 'Regular service',
      });

      expect(result.maintenanceType).toBe('Oil Change');
      expect(result.status).toBe(MaintenanceStatus.SCHEDULED);
    });

    it('should throw NotFoundException when vehicle not found', async () => {
      mockPrisma.transportationVehicle.findUnique.mockResolvedValue(null);

      await expect(
        service.scheduleMaintenance({
          vehicleId: 'invalid-id',
          maintenanceType: 'Oil Change',
          scheduledDate: '2026-06-01',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMaintenanceStatus', () => {
    it('should update status with valid transition', async () => {
      mockPrisma.vehicleMaintenance.findUnique.mockResolvedValue(mockMaintenance);
      mockPrisma.vehicleMaintenance.update.mockResolvedValue({
        ...mockMaintenance,
        status: MaintenanceStatus.IN_MAINTENANCE,
      });

      const result = await service.updateMaintenanceStatus('maint-uuid-1', {
        status: MaintenanceStatus.IN_MAINTENANCE,
      });

      expect(result.status).toBe(MaintenanceStatus.IN_MAINTENANCE);
    });

    it('should throw BadRequestException for invalid transition', async () => {
      mockPrisma.vehicleMaintenance.findUnique.mockResolvedValue({
        ...mockMaintenance,
        status: MaintenanceStatus.COMPLETED,
      });

      await expect(
        service.updateMaintenanceStatus('maint-uuid-1', {
          status: MaintenanceStatus.SCHEDULED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when record not found', async () => {
      mockPrisma.vehicleMaintenance.findUnique.mockResolvedValue(null);

      await expect(
        service.updateMaintenanceStatus('invalid-id', { status: MaintenanceStatus.COMPLETED }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('isVehicleInMaintenance', () => {
    it('should return true when vehicle is in maintenance', async () => {
      mockPrisma.vehicleMaintenance.count.mockResolvedValue(1);

      const result = await service.isVehicleInMaintenance('vehicle-uuid-1');

      expect(result).toBe(true);
    });

    it('should return false when vehicle is not in maintenance', async () => {
      mockPrisma.vehicleMaintenance.count.mockResolvedValue(0);

      const result = await service.isVehicleInMaintenance('vehicle-uuid-1');

      expect(result).toBe(false);
    });
  });
});
