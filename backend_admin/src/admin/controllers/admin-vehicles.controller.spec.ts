import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminVehiclesController } from './admin-vehicles.controller';
import { AdminVehiclesService } from '../services/admin-vehicles.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

describe('AdminVehiclesController', () => {
  let controller: AdminVehiclesController;
  let service: AdminVehiclesService;

  const mockVehicle = {
    id: 'vehicle-1',
    name: 'Toyota Camry',
    vehicle_type: 'van',
    price_usd: 50,
  };

  const mockService = {
    getAllVehicles: jest.fn(),
    getVehicleById: jest.fn(),
    getVehicleAvailability: jest.fn(),
    createVehicle: jest.fn(),
    updateVehicle: jest.fn(),
    createAuditLog: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminVehiclesController],
      providers: [
        { provide: AdminVehiclesService, useValue: mockService },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: { getClient: jest.fn() } },
        Reflector,
      ],
    }).compile();

    controller = module.get<AdminVehiclesController>(AdminVehiclesController);
    service = module.get<AdminVehiclesService>(AdminVehiclesService);
  });

  describe('getAllVehicles', () => {
    it('should return vehicle list', async () => {
      mockService.getAllVehicles.mockResolvedValue({ data: [mockVehicle], meta: {} });

      const result = await controller.getAllVehicles();

      expect(result.data).toHaveLength(1);
    });
  });

  describe('getVehicleById', () => {
    it('should return vehicle details', async () => {
      mockService.getVehicleById.mockResolvedValue(mockVehicle);

      const result = await controller.getVehicleById('vehicle-1');

      expect(result).toEqual(mockVehicle);
    });
  });

  describe('getVehicleAvailability', () => {
    it('should return availability status', async () => {
      mockService.getVehicleAvailability.mockResolvedValue({
        vehicleId: 'vehicle-1',
        isAvailable: true,
        reason: 'Available for assignment',
      });

      const result = await controller.getVehicleAvailability('vehicle-1');

      expect(result.isAvailable).toBe(true);
    });
  });

  describe('createVehicle', () => {
    it('should create vehicle and log audit', async () => {
      mockService.createVehicle.mockResolvedValue(mockVehicle);
      mockService.createAuditLog.mockResolvedValue(undefined);

      const dto = {
        name: 'Toyota Camry',
        vehicle_type: 'van' as const,
        capacity: 4,
        pricing_model: 'per_day' as const,
        price_usd: 50,
        province: 'Phnom Penh',
      };

      const result = await controller.createVehicle(dto, 'user-1');

      expect(result.success).toBe(true);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          entityType: 'VEHICLE',
          metadata: expect.objectContaining({ action: 'CREATE_VEHICLE' }),
        }),
      );
    });
  });

  describe('updateVehicle', () => {
    it('should update vehicle and log audit', async () => {
      mockService.updateVehicle.mockResolvedValue(mockVehicle);
      mockService.createAuditLog.mockResolvedValue(undefined);

      const dto = { name: 'Updated Name' };
      const result = await controller.updateVehicle('vehicle-1', dto, 'user-1');

      expect(result.success).toBe(true);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          entityType: 'VEHICLE',
          metadata: expect.objectContaining({ action: 'UPDATE_VEHICLE' }),
        }),
      );
    });
  });
});
