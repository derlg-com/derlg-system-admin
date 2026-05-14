import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminDriversController } from './admin-drivers.controller';
import { AdminDriversService } from '../services/admin-drivers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

describe('AdminDriversController', () => {
  let controller: AdminDriversController;
  let service: AdminDriversService;

  const mockDriver = {
    id: 'driver-1',
    driverName: 'John Doe',
    driverId: 'DRV001',
    status: 'AVAILABLE',
  };

  const mockService = {
    getAllDrivers: jest.fn(),
    getDriverById: jest.fn(),
    createDriver: jest.fn(),
    updateDriver: jest.fn(),
    deactivateDriver: jest.fn(),
    createAuditLog: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminDriversController],
      providers: [
        { provide: AdminDriversService, useValue: mockService },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: { getClient: jest.fn() } },
        Reflector,
      ],
    }).compile();

    controller = module.get<AdminDriversController>(AdminDriversController);
    service = module.get<AdminDriversService>(AdminDriversService);
  });

  describe('getAllDrivers', () => {
    it('should return driver list', async () => {
      mockService.getAllDrivers.mockResolvedValue({ data: [mockDriver], meta: {} });

      const result = await controller.getAllDrivers();

      expect(result.data).toHaveLength(1);
      expect(mockService.getAllDrivers).toHaveBeenCalledWith({
        status: undefined,
        search: undefined,
        page: undefined,
        limit: undefined,
      });
    });
  });

  describe('getDriverById', () => {
    it('should return driver details', async () => {
      mockService.getDriverById.mockResolvedValue(mockDriver);

      const result = await controller.getDriverById('driver-1');

      expect(result).toEqual(mockDriver);
    });
  });

  describe('createDriver', () => {
    it('should create driver and log audit', async () => {
      mockService.createDriver.mockResolvedValue(mockDriver);
      mockService.createAuditLog.mockResolvedValue(undefined);

      const dto = {
        driverName: 'John Doe',
        driverId: 'DRV001',
        phone: '+85512345678',
      };

      const result = await controller.createDriver(dto as any, 'user-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockDriver);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          entityType: 'DRIVER',
          metadata: expect.objectContaining({ action: 'CREATE_DRIVER' }),
        }),
      );
    });
  });

  describe('updateDriver', () => {
    it('should update driver and log audit', async () => {
      mockService.updateDriver.mockResolvedValue(mockDriver);
      mockService.createAuditLog.mockResolvedValue(undefined);

      const dto = { status: 'BUSY' as any };
      const result = await controller.updateDriver('driver-1', dto, 'user-1');

      expect(result.success).toBe(true);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          entityType: 'DRIVER',
          metadata: expect.objectContaining({ action: 'UPDATE_DRIVER' }),
        }),
      );
    });
  });

  describe('deactivateDriver', () => {
    it('should deactivate driver and log audit', async () => {
      mockService.deactivateDriver.mockResolvedValue({ ...mockDriver, status: 'OFFLINE' });
      mockService.createAuditLog.mockResolvedValue(undefined);

      const result = await controller.deactivateDriver('driver-1', 'user-1');

      expect(result.success).toBe(true);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          entityType: 'DRIVER',
          metadata: expect.objectContaining({ action: 'DEACTIVATE_DRIVER' }),
        }),
      );
    });
  });
});
