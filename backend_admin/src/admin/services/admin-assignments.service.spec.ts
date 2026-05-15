import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AssignmentStatus, DriverStatus } from '@prisma/client';
import { AdminAssignmentsService } from './admin-assignments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

const mockAssignment = {
  id: 'assignment-uuid-1',
  driverId: 'driver-uuid-1',
  bookingId: 'booking-uuid-1',
  vehicleId: 'vehicle-uuid-1',
  status: AssignmentStatus.PENDING,
  assignmentTimestamp: new Date(),
  responseTimestamp: null,
  tripStartTime: null,
  completionTimestamp: null,
  rejectionReason: null,
  telegramNotified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDriver = {
  id: 'driver-uuid-1',
  driverName: 'John Doe',
  driverId: 'DRV001',
  phone: '+85512345678',
  status: DriverStatus.AVAILABLE,
};

const mockBooking = {
  id: 'booking-uuid-1',
  reference: 'BK001',
  passenger_count: 3,
  status: 'reserved',
  start_date: new Date(),
};

const mockVehicle = {
  id: 'vehicle-uuid-1',
  name: 'Toyota Camry',
  vehicle_type: 'van',
  capacity: 4,
  license_plate: 'PP-1234',
};

describe('AdminAssignmentsService', () => {
  let service: AdminAssignmentsService;
  let prisma: PrismaService;
  let redis: RedisService;

  const mockPrisma = {
    driverAssignment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    driver: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    booking: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    transportationVehicle: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    vehicleMaintenance: {
      findFirst: jest.fn(),
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
        AdminAssignmentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<AdminAssignmentsService>(AdminAssignmentsService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
  });

  describe('getAssignments', () => {
    it('should return paginated assignments with relations', async () => {
      mockPrisma.driverAssignment.findMany.mockResolvedValue([mockAssignment]);
      mockPrisma.driverAssignment.count.mockResolvedValue(1);
      mockPrisma.driver.findMany.mockResolvedValue([mockDriver]);
      mockPrisma.booking.findMany.mockResolvedValue([mockBooking]);
      mockPrisma.transportationVehicle.findMany.mockResolvedValue([mockVehicle]);

      const result = await service.getAssignments({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].driver).toBeDefined();
      expect(result.data[0].booking).toBeDefined();
      expect(result.data[0].vehicle).toBeDefined();
      expect(result.meta.total).toBe(1);
    });

    it('should filter by driver_id', async () => {
      mockPrisma.driverAssignment.findMany.mockResolvedValue([mockAssignment]);
      mockPrisma.driverAssignment.count.mockResolvedValue(1);
      mockPrisma.driver.findMany.mockResolvedValue([mockDriver]);
      mockPrisma.booking.findMany.mockResolvedValue([mockBooking]);
      mockPrisma.transportationVehicle.findMany.mockResolvedValue([mockVehicle]);

      await service.getAssignments({ driverId: 'driver-uuid-1' });

      expect(mockPrisma.driverAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ driverId: 'driver-uuid-1' }),
        }),
      );
    });
  });

  describe('assignDriver', () => {
    it('should create assignment when all validations pass', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue(mockDriver);
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrisma.transportationVehicle.findUnique.mockResolvedValue(mockVehicle);
      mockPrisma.vehicleMaintenance.findFirst.mockResolvedValue(null);
      mockPrisma.driverAssignment.create.mockResolvedValue(mockAssignment);
      mockPrisma.driver.update.mockResolvedValue({ ...mockDriver, status: DriverStatus.BUSY });

      const result = await service.assignDriver({
        driverId: 'driver-uuid-1',
        bookingId: 'booking-uuid-1',
        vehicleId: 'vehicle-uuid-1',
      });

      expect(result.status).toBe(AssignmentStatus.PENDING);
      expect(mockPrisma.driver.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: DriverStatus.BUSY }),
        }),
      );
      expect(mockRedisClient.publish).toHaveBeenCalledWith(
        'driver_assignments',
        expect.any(String),
      );
    });

    it('should throw NotFoundException when driver not found', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue(null);

      await expect(
        service.assignDriver({
          driverId: 'invalid-id',
          bookingId: 'booking-uuid-1',
          vehicleId: 'vehicle-uuid-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when driver is not AVAILABLE', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({
        ...mockDriver,
        status: DriverStatus.BUSY,
      });

      await expect(
        service.assignDriver({
          driverId: 'driver-uuid-1',
          bookingId: 'booking-uuid-1',
          vehicleId: 'vehicle-uuid-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when vehicle capacity is insufficient', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue(mockDriver);
      mockPrisma.booking.findUnique.mockResolvedValue({ ...mockBooking, passenger_count: 10 });
      mockPrisma.transportationVehicle.findUnique.mockResolvedValue(mockVehicle);

      await expect(
        service.assignDriver({
          driverId: 'driver-uuid-1',
          bookingId: 'booking-uuid-1',
          vehicleId: 'vehicle-uuid-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when vehicle is in maintenance', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue(mockDriver);
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrisma.transportationVehicle.findUnique.mockResolvedValue(mockVehicle);
      mockPrisma.vehicleMaintenance.findFirst.mockResolvedValue({
        id: 'maint-1',
        status: 'IN_MAINTENANCE',
      });

      await expect(
        service.assignDriver({
          driverId: 'driver-uuid-1',
          bookingId: 'booking-uuid-1',
          vehicleId: 'vehicle-uuid-1',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('completeAssignment', () => {
    it('should complete assignment and free driver', async () => {
      mockPrisma.driverAssignment.findUnique.mockResolvedValue(mockAssignment);
      mockPrisma.driverAssignment.update.mockResolvedValue({
        ...mockAssignment,
        status: AssignmentStatus.COMPLETED,
      });
      mockPrisma.driver.update.mockResolvedValue({ ...mockDriver, status: DriverStatus.AVAILABLE });

      const result = await service.completeAssignment('assignment-uuid-1');

      expect(result.status).toBe(AssignmentStatus.COMPLETED);
      expect(mockPrisma.driver.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: DriverStatus.AVAILABLE }),
        }),
      );
      expect(mockRedisClient.publish).toHaveBeenCalledWith(
        'driver_assignments',
        expect.any(String),
      );
    });

    it('should throw NotFoundException when assignment not found', async () => {
      mockPrisma.driverAssignment.findUnique.mockResolvedValue(null);

      await expect(service.completeAssignment('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when already completed', async () => {
      mockPrisma.driverAssignment.findUnique.mockResolvedValue({
        ...mockAssignment,
        status: AssignmentStatus.COMPLETED,
      });

      await expect(service.completeAssignment('assignment-uuid-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
