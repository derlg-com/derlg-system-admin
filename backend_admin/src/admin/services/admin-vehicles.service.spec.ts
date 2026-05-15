import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminVehiclesService } from './admin-vehicles.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockVehicle = {
  id: 'vehicle-uuid-1',
  name: 'Toyota Camry',
  vehicle_type: 'van',
  license_plate: 'PP-1234',
  capacity: 4,
  pricing_model: 'per_day',
  price_usd: 50.0,
  province: 'Phnom Penh',
  images: ['http://example.com/image.jpg'],
  is_active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AdminVehiclesService', () => {
  let service: AdminVehiclesService;
  let prisma: PrismaService;

  const mockPrisma = {
    transportationVehicle: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    driver: {
      findFirst: jest.fn(),
    },
    vehicleMaintenance: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminVehiclesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminVehiclesService>(AdminVehiclesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getAllVehicles', () => {
    it('should return paginated vehicle list', async () => {
      mockPrisma.transportationVehicle.findMany.mockResolvedValue([mockVehicle]);
      mockPrisma.transportationVehicle.count.mockResolvedValue(1);

      const result = await service.getAllVehicles({});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should filter by category', async () => {
      mockPrisma.transportationVehicle.findMany.mockResolvedValue([mockVehicle]);
      mockPrisma.transportationVehicle.count.mockResolvedValue(1);

      await service.getAllVehicles({ category: 'van' });

      expect(mockPrisma.transportationVehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ vehicle_type: 'van' }),
        }),
      );
    });

    it('should search by name or license plate', async () => {
      mockPrisma.transportationVehicle.findMany.mockResolvedValue([mockVehicle]);
      mockPrisma.transportationVehicle.count.mockResolvedValue(1);

      await service.getAllVehicles({ search: 'Toyota' });

      expect(mockPrisma.transportationVehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.any(Object) }),
            ]),
          }),
        }),
      );
    });
  });

  describe('getVehicleById', () => {
    it('should return vehicle with driver and maintenance', async () => {
      mockPrisma.transportationVehicle.findUnique.mockResolvedValue(mockVehicle);
      mockPrisma.driver.findFirst.mockResolvedValue({
        id: 'driver-1',
        driverName: 'John Doe',
        driverId: 'DRV001',
        status: 'AVAILABLE',
        phone: '+85512345678',
      });
      mockPrisma.vehicleMaintenance.findMany.mockResolvedValue([
        { id: 'maint-1', maintenanceType: 'Oil Change', scheduledDate: new Date(), status: 'COMPLETED' },
      ]);

      const result = await service.getVehicleById('vehicle-uuid-1');

      expect(result.id).toBe('vehicle-uuid-1');
      expect(result.assignedDriver).toBeDefined();
      expect(result.maintenanceHistory).toHaveLength(1);
    });

    it('should throw NotFoundException when vehicle not found', async () => {
      mockPrisma.transportationVehicle.findUnique.mockResolvedValue(null);

      await expect(service.getVehicleById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createVehicle', () => {
    it('should create vehicle', async () => {
      mockPrisma.transportationVehicle.create.mockResolvedValue(mockVehicle);

      const result = await service.createVehicle({
        name: 'Toyota Camry',
        vehicle_type: 'van',
        capacity: 4,
        pricing_model: 'per_day',
        price_usd: 50,
        province: 'Phnom Penh',
      });

      expect(result.name).toBe('Toyota Camry');
    });
  });

  describe('updateVehicle', () => {
    it('should update vehicle and log price change', async () => {
      mockPrisma.transportationVehicle.findUnique.mockResolvedValue(mockVehicle);
      mockPrisma.transportationVehicle.update.mockResolvedValue({
        ...mockVehicle,
        price_usd: 60.0,
      });
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      const result = await service.updateVehicle(
        'vehicle-uuid-1',
        { price_usd: 60 },
        'user-1',
      );

      expect(Number(result.price_usd)).toBe(60);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({ action: 'PRICING_CHANGE' }),
          }),
        }),
      );
    });

    it('should not log audit when price unchanged', async () => {
      mockPrisma.transportationVehicle.findUnique.mockResolvedValue(mockVehicle);
      mockPrisma.transportationVehicle.update.mockResolvedValue(mockVehicle);

      await service.updateVehicle('vehicle-uuid-1', { name: 'New Name' }, 'user-1');

      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when vehicle not found', async () => {
      mockPrisma.transportationVehicle.findUnique.mockResolvedValue(null);

      await expect(
        service.updateVehicle('invalid-id', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getVehicleAvailability', () => {
    it('should return available when driver is AVAILABLE and no maintenance', async () => {
      mockPrisma.transportationVehicle.findUnique.mockResolvedValue(mockVehicle);
      mockPrisma.driver.findFirst.mockResolvedValue({ status: 'AVAILABLE' });
      mockPrisma.vehicleMaintenance.findFirst.mockResolvedValue(null);

      const result = await service.getVehicleAvailability('vehicle-uuid-1');

      expect(result.isAvailable).toBe(true);
    });

    it('should return unavailable when vehicle is inactive', async () => {
      mockPrisma.transportationVehicle.findUnique.mockResolvedValue({
        ...mockVehicle,
        is_active: false,
      });

      const result = await service.getVehicleAvailability('vehicle-uuid-1');

      expect(result.isAvailable).toBe(false);
      expect(result.reason).toContain('inactive');
    });

    it('should return unavailable when in maintenance', async () => {
      mockPrisma.transportationVehicle.findUnique.mockResolvedValue(mockVehicle);
      mockPrisma.driver.findFirst.mockResolvedValue({ status: 'AVAILABLE' });
      mockPrisma.vehicleMaintenance.findFirst.mockResolvedValue({
        status: 'IN_MAINTENANCE',
      });

      const result = await service.getVehicleAvailability('vehicle-uuid-1');

      expect(result.isAvailable).toBe(false);
      expect(result.reason).toContain('maintenance');
    });
  });
});
