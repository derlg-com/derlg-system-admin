import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { getQueueToken } from '@nestjs/bullmq';
import { BroadcastProcessor } from './../src/telegram/jobs/broadcast.processor';
import { AssignmentTimeoutProcessor } from './../src/telegram/jobs/assignment-timeout.processor';
import { LocationCleanupProcessor } from './../src/telegram/jobs/location-cleanup.processor';
import { AppModule } from './../src/app.module';
import { JwtAuthGuard } from './../src/auth/jwt-auth.guard';
import { AdminGuard } from './../src/admin/guards/admin.guard';
import { AdminRoleGuard } from './../src/admin/guards/admin-role.guard';
import { PrismaService } from './../src/prisma/prisma.service';
import { RedisService } from './../src/redis/redis.service';
import { DriverStatus, AssignmentStatus, booking_status, vehicle_type, pricing_model } from '@prisma/client';

jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
}));

class MockAuthGuard implements CanActivate {
  canActivate() { return true; }
}

describe('Admin Endpoints (e2e)', () => {
  let app: INestApplication<App>;

  const mockPrisma = {
    driver: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    transportationVehicle: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    vehicleMaintenance: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    driverAssignment: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const mockRedisClient = {
    publish: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    ping: jest.fn().mockResolvedValue('PONG'),
    duplicate: jest.fn().mockReturnValue({
      psubscribe: jest.fn(),
      on: jest.fn(),
      quit: jest.fn(),
    }),
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
    ping: jest.fn().mockResolvedValue('PONG'),
    healthCheck: jest.fn().mockResolvedValue({ status: 'ok', response: 'PONG' }),
    publish: jest.fn().mockResolvedValue(1),
    subscribe: jest.fn(),
    psubscribe: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    addBulk: jest.fn().mockResolvedValue([]),
    getJob: jest.fn().mockResolvedValue(null),
    close: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .overrideProvider(getQueueToken('broadcast'))
      .useValue(mockQueue)
      .overrideProvider(getQueueToken('assignment-timeout'))
      .useValue(mockQueue)
      .overrideProvider(getQueueToken('location-cleanup'))
      .useValue(mockQueue)
      .overrideProvider(BroadcastProcessor)
      .useValue({})
      .overrideProvider(AssignmentTimeoutProcessor)
      .useValue({})
      .overrideProvider(LocationCleanupProcessor)
      .useValue({})
      .overrideGuard(JwtAuthGuard)
      .useValue(new MockAuthGuard())
      .overrideGuard(AdminGuard)
      .useValue(new MockAuthGuard())
      .overrideGuard(AdminRoleGuard)
      .useValue(new MockAuthGuard())
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Driver Management ───

  describe('GET /v1/admin/drivers', () => {
    it('should return paginated driver list', async () => {
      mockPrisma.driver.findMany.mockResolvedValue([
        { id: 'drv-1', driverName: 'John', driverId: 'DRV001', status: 'AVAILABLE' },
      ]);
      mockPrisma.driver.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/v1/admin/drivers')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.total).toBe(1);
    });

    it('should filter drivers by status', async () => {
      mockPrisma.driver.findMany.mockResolvedValue([]);
      mockPrisma.driver.count.mockResolvedValue(0);

      const response = await request(app.getHttpServer())
        .get('/v1/admin/drivers?status=AVAILABLE')
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /v1/admin/drivers/:id', () => {
    it('should return driver by id', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({
        id: 'drv-1',
        driverName: 'John',
        driverId: 'DRV001',
        status: DriverStatus.AVAILABLE,
        assignments: [{ id: 'a1' }],
      });

      const response = await request(app.getHttpServer())
        .get('/v1/admin/drivers/drv-1')
        .expect(200);

      expect(response.body.driverName).toBe('John');
    });

    it('should return 404 for non-existent driver', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/v1/admin/drivers/nonexistent')
        .expect(404);
    });
  });

  describe('POST /v1/admin/drivers', () => {
    it('should create a new driver', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue(null);
      mockPrisma.driver.create.mockResolvedValue({
        id: 'drv-new',
        driverName: 'Jane',
        driverId: 'DRV002',
        status: DriverStatus.OFFLINE,
      });

      const response = await request(app.getHttpServer())
        .post('/v1/admin/drivers')
        .send({
          driverName: 'Jane',
          driverId: 'DRV002',
          phone: '+85512345678',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.driverName).toBe('Jane');
    });
  });

  // ─── Vehicle Management ───

  describe('GET /v1/admin/vehicles', () => {
    it('should return paginated vehicle list', async () => {
      mockPrisma.transportationVehicle.findMany.mockResolvedValue([
        { id: 'veh-1', name: 'Toyota Camry', licensePlate: 'ABC123', is_active: true },
      ]);
      mockPrisma.transportationVehicle.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/v1/admin/vehicles')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /v1/admin/vehicles/:id', () => {
    it('should return vehicle by id', async () => {
      mockPrisma.transportationVehicle.findUnique.mockResolvedValue({
        id: 'veh-1',
        name: 'Toyota Camry',
        license_plate: 'ABC123',
        vehicle_type: 'van',
        capacity: 4,
        pricing_model: 'per_day',
        price_usd: 50,
        province: 'Phnom Penh',
        images: [],
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.driver.findFirst.mockResolvedValue(null);
      mockPrisma.vehicleMaintenance.findMany.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/v1/admin/vehicles/veh-1')
        .expect(200);

      expect(response.body.name).toBe('Toyota Camry');
    });
  });

  describe('POST /v1/admin/vehicles', () => {
    it('should create a new vehicle', async () => {
      mockPrisma.transportationVehicle.create.mockResolvedValue({
        id: 'veh-new',
        name: 'Honda Civic',
        licensePlate: 'XYZ789',
        is_active: true,
      });

      const response = await request(app.getHttpServer())
        .post('/v1/admin/vehicles')
        .send({
          name: 'Honda Civic',
          license_plate: 'XYZ789',
          vehicle_type: vehicle_type.van,
          capacity: 4,
          pricing_model: pricing_model.per_day,
          price_usd: 50,
          province: 'Phnom Penh',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Honda Civic');
    });
  });

  // ─── Maintenance ───

  describe('GET /v1/admin/maintenance', () => {
    it('should return maintenance records', async () => {
      mockPrisma.vehicleMaintenance.findMany.mockResolvedValue([
        { id: 'mnt-1', vehicleId: 'veh-1', maintenanceType: 'Oil Change', status: 'SCHEDULED' },
      ]);
      mockPrisma.vehicleMaintenance.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/v1/admin/maintenance')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('POST /v1/admin/maintenance', () => {
    it('should create a maintenance record', async () => {
      mockPrisma.vehicleMaintenance.create.mockResolvedValue({
        id: 'mnt-new',
        vehicleId: 'veh-1',
        maintenanceType: 'Tire Rotation',
        status: 'SCHEDULED',
        scheduledDate: new Date('2026-06-01'),
      });

      const response = await request(app.getHttpServer())
        .post('/v1/admin/maintenance')
        .send({
          vehicleId: 'veh-1',
          maintenanceType: 'Tire Rotation',
          scheduledDate: '2026-06-01',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.maintenanceType).toBe('Tire Rotation');
    });
  });

  // ─── Bookings ───

  describe('GET /v1/admin/bookings', () => {
    it('should return paginated booking list', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([
        { id: 'bk-1', reference: 'BK001', status: 'confirmed', totalUsd: 250 },
      ]);
      mockPrisma.booking.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/v1/admin/bookings')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].reference).toBe('BK001');
    });
  });

  describe('GET /v1/admin/bookings/:id', () => {
    it('should return booking by id', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'bk-1',
        reference: 'BK001',
        status: booking_status.confirmed,
        totalUsd: 250,
        subtotal_usd: 200,
        discount_usd: 0,
        loyalty_discount_usd: 0,
        start_date: new Date(),
        end_date: new Date(),
        expires_at: new Date(),
        cancelled_at: null,
        cancel_reason: null,
        refund_percentage: null,
        passenger_count: 2,
        room_count: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        booking_items: [],
        users: { id: 'user-1', email: 'user@example.com', full_name: 'User' },
        payments: [],
      });
      mockPrisma.driverAssignment.findFirst.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/v1/admin/bookings/bk-1')
        .expect(200);

      expect(response.body.reference).toBe('BK001');
    });
  });

  describe('PATCH /v1/admin/bookings/:id', () => {
    it('should update booking', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'bk-1',
        status: booking_status.reserved,
      });
      mockPrisma.booking.update.mockResolvedValue({
        id: 'bk-1',
        reference: 'BK001',
        status: booking_status.confirmed,
      });

      const response = await request(app.getHttpServer())
        .patch('/v1/admin/bookings/bk-1')
        .send({ status: 'confirmed' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('confirmed');
    });
  });

  // ─── Assignments ───

  describe('GET /v1/admin/assignments', () => {
    it('should return assignment list', async () => {
      mockPrisma.driverAssignment.findMany.mockResolvedValue([
        { id: 'asn-1', driverId: 'drv-1', bookingId: 'bk-1', status: 'PENDING' },
      ]);
      mockPrisma.driverAssignment.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/v1/admin/assignments')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('POST /v1/admin/assignments', () => {
    it('should create a driver assignment', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        status: DriverStatus.AVAILABLE,
      });
      mockPrisma.transportationVehicle.findUnique.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440002',
        capacity: 4,
      });
      mockPrisma.vehicleMaintenance.findFirst.mockResolvedValue(null);
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440003',
        passenger_count: 2,
      });
      mockPrisma.driverAssignment.create.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440004',
        driverId: '550e8400-e29b-41d4-a716-446655440001',
        bookingId: '550e8400-e29b-41d4-a716-446655440003',
        vehicleId: '550e8400-e29b-41d4-a716-446655440002',
        status: AssignmentStatus.PENDING,
      });

      const response = await request(app.getHttpServer())
        .post('/v1/admin/assignments')
        .send({
          driverId: '550e8400-e29b-41d4-a716-446655440001',
          bookingId: '550e8400-e29b-41d4-a716-446655440003',
          vehicleId: '550e8400-e29b-41d4-a716-446655440002',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PENDING');
    });
  });
});
