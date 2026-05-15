import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { DriverStatus } from '@prisma/client';
import { AdminDriversService } from './admin-drivers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

const mockDriver = {
  id: 'driver-uuid-1',
  driverName: 'John Doe',
  driverId: 'DRV001',
  telegramId: BigInt('123456789'),
  authPin: '123456',
  phone: '+85512345678',
  vehicleId: 'vehicle-uuid-1',
  status: DriverStatus.AVAILABLE,
  preferredLanguage: 'en',
  lastStatusUpdate: new Date(),
  lastTelegramActivity: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockVehicle = {
  id: 'vehicle-uuid-1',
  name: 'Toyota Camry',
  vehicle_type: 'sedan',
  capacity: 4,
  license_plate: 'PP-1234',
};

describe('AdminDriversService', () => {
  let service: AdminDriversService;
  let prisma: PrismaService;
  let redis: RedisService;

  const mockPrisma = {
    driver: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    transportationVehicle: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const mockRedisClient = {
    publish: jest.fn().mockResolvedValue(1),
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminDriversService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<AdminDriversService>(AdminDriversService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
  });

  describe('getAllDrivers', () => {
    it('should return paginated driver list', async () => {
      mockPrisma.driver.findMany.mockResolvedValue([mockDriver]);
      mockPrisma.driver.count.mockResolvedValue(1);

      const result = await service.getAllDrivers({});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('should filter by status', async () => {
      mockPrisma.driver.findMany.mockResolvedValue([mockDriver]);
      mockPrisma.driver.count.mockResolvedValue(1);

      await service.getAllDrivers({ status: 'AVAILABLE' });

      expect(mockPrisma.driver.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: DriverStatus.AVAILABLE }),
        }),
      );
    });

    it('should search by name, driverId, or phone', async () => {
      mockPrisma.driver.findMany.mockResolvedValue([mockDriver]);
      mockPrisma.driver.count.mockResolvedValue(1);

      await service.getAllDrivers({ search: 'John' });

      expect(mockPrisma.driver.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ driverName: expect.any(Object) }),
            ]),
          }),
        }),
      );
    });
  });

  describe('getDriverById', () => {
    it('should return driver with vehicle and assignment count', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({
        ...mockDriver,
        assignments: [{ id: 'a1' }, { id: 'a2' }],
      });
      mockPrisma.transportationVehicle.findUnique.mockResolvedValue(mockVehicle);

      const result = await service.getDriverById('driver-uuid-1');

      expect(result.id).toBe('driver-uuid-1');
      expect(result.vehicle).toEqual(mockVehicle);
      expect(result.assignmentCount).toBe(2);
    });

    it('should throw NotFoundException when driver not found', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue(null);

      await expect(service.getDriverById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createDriver', () => {
    it('should create driver with auto-generated PIN', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue(null);
      mockPrisma.driver.create.mockResolvedValue(mockDriver);

      const result = await service.createDriver({
        driverName: 'John Doe',
        driverId: 'DRV001',
        phone: '+85512345678',
      });

      expect(result.driverId).toBe('DRV001');
      expect(mockPrisma.driver.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authPin: expect.stringMatching(/^\d{6}$/),
            status: DriverStatus.OFFLINE,
          }),
        }),
      );
    });

    it('should throw ConflictException for duplicate telegram ID', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue(mockDriver);

      await expect(
        service.createDriver({
          driverName: 'Jane Doe',
          driverId: 'DRV002',
          telegramId: '123456789',
          phone: '+85512345679',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateDriver', () => {
    it('should update driver and publish status change', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue(mockDriver);
      mockPrisma.driver.findFirst.mockResolvedValue(null);
      mockPrisma.driver.update.mockResolvedValue({
        ...mockDriver,
        status: DriverStatus.BUSY,
      });

      const result = await service.updateDriver('driver-uuid-1', {
        status: DriverStatus.BUSY,
      });

      expect(result.status).toBe(DriverStatus.BUSY);
      expect(mockRedisClient.publish).toHaveBeenCalled();
    });

    it('should not publish when status unchanged', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue(mockDriver);
      mockPrisma.driver.update.mockResolvedValue(mockDriver);

      await service.updateDriver('driver-uuid-1', { phone: '+85599999999' });

      expect(mockRedisClient.publish).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when driver not found', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue(null);

      await expect(
        service.updateDriver('invalid-id', { phone: '+85599999999' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivateDriver', () => {
    it('should set status to OFFLINE and publish event', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue(mockDriver);
      mockPrisma.driver.update.mockResolvedValue({
        ...mockDriver,
        status: DriverStatus.OFFLINE,
      });

      const result = await service.deactivateDriver('driver-uuid-1');

      expect(result.status).toBe(DriverStatus.OFFLINE);
      expect(mockRedisClient.publish).toHaveBeenCalledWith(
        'driver_status_changed:driver-uuid-1',
        expect.any(String),
      );
    });

    it('should throw NotFoundException when driver not found', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue(null);

      await expect(service.deactivateDriver('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createAuditLog', () => {
    it('should create audit log entry', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      await service.createAuditLog({
        userId: 'user-1',
        eventType: 'admin_action',
        entityType: 'DRIVER',
        entityId: 'driver-1',
        metadata: { action: 'CREATE_DRIVER' },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: 'user-1',
            entity_type: 'DRIVER',
            event_type: 'admin_action',
          }),
        }),
      );
    });

    it('should not throw when audit log creation fails', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.createAuditLog({
          eventType: 'admin_action',
          entityType: 'DRIVER',
        }),
      ).resolves.toBeUndefined();
    });
  });
});
