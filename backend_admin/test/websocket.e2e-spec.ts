import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getQueueToken } from '@nestjs/bullmq';
import { BroadcastProcessor } from './../src/telegram/jobs/broadcast.processor';
import { AssignmentTimeoutProcessor } from './../src/telegram/jobs/assignment-timeout.processor';
import { LocationCleanupProcessor } from './../src/telegram/jobs/location-cleanup.processor';
import { io, Socket as ClientSocket } from 'socket.io-client';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { RedisService } from './../src/redis/redis.service';
import { AdminRole } from '@prisma/client';

describe('Admin WebSocket Gateway (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let validToken: string;
  let pmessageHandler: ((pattern: string, channel: string, message: string) => void) | undefined;

  const mockRedisSubscriber = {
    psubscribe: jest.fn(),
    on: jest.fn((event: string, handler: any) => {
      if (event === 'pmessage') {
        pmessageHandler = handler;
      }
    }),
    quit: jest.fn(),
  };

  const mockRedisClient = {
    publish: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    ping: jest.fn().mockResolvedValue('PONG'),
    duplicate: jest.fn().mockReturnValue(mockRedisSubscriber),
    subscribe: jest.fn(),
    psubscribe: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
    ping: jest.fn().mockResolvedValue('PONG'),
    healthCheck: jest.fn().mockResolvedValue({ status: 'ok', response: 'PONG' }),
    publish: jest.fn().mockResolvedValue(1),
    subscribe: jest.fn(),
    psubscribe: jest.fn(),
  };

  const mockPrisma = {
    adminUser: {
      findUnique: jest.fn(),
    },
    driver: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    transportationVehicle: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
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
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.init();
    await app.listen(0); // random port

    jwtService = moduleFixture.get<JwtService>(JwtService);

    validToken = jwtService.sign(
      { sub: 'admin-user-1', email: 'admin@derlg.com', role: 'admin' },
      { secret: process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-production' },
    );
  });

  beforeEach(() => {
    // Clear mocks but preserve pmessage handler reference
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  function connectClient(token?: string): ClientSocket {
    const port = (app.getHttpServer().address() as any).port;
    const url = `http://localhost:${port}/v1/admin/ws`;

    if (token) {
      return io(url, {
        transports: ['websocket'],
        extraHeaders: {
          authorization: `Bearer ${token}`,
        },
      });
    }

    return io(url, {
      transports: ['websocket'],
    });
  }

  describe('Connection', () => {
    it('should connect and receive connected event with valid token', (done) => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        adminRole: AdminRole.SUPER_ADMIN,
        isActive: true,
      });

      const client = connectClient(validToken);

      client.on('connected', (data: any) => {
        expect(data.role).toBe('SUPER_ADMIN');
        expect(data.socketId).toBeDefined();
        expect(data.timestamp).toBeDefined();
        client.disconnect();
        done();
      });

      client.on('connect_error', (err) => {
        client.disconnect();
        done(err);
      });
    });

    it('should connect with token in query string', (done) => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        adminRole: AdminRole.FLEET_MANAGER,
        isActive: true,
      });

      const port = (app.getHttpServer().address() as any).port;
      const client = io(`http://localhost:${port}/v1/admin/ws`, {
        transports: ['websocket'],
        query: { token: validToken },
      });

      client.on('connected', (data: any) => {
        expect(data.role).toBe('FLEET_MANAGER');
        client.disconnect();
        done();
      });

      client.on('connect_error', (err) => {
        client.disconnect();
        done(err);
      });
    });

    it('should disconnect without token', (done) => {
      const client = connectClient();

      client.on('connect', () => {
        // Wait briefly then check if still connected
        setTimeout(() => {
          expect(client.connected).toBe(false);
          client.disconnect();
          done();
        }, 200);
      });

      client.on('connect_error', () => {
        // Expected to fail
        setTimeout(() => {
          expect(client.connected).toBe(false);
          client.disconnect();
          done();
        }, 200);
      });
    });

    it('should disconnect with invalid token', (done) => {
      const client = connectClient('invalid-token');

      client.on('connect', () => {
        setTimeout(() => {
          expect(client.connected).toBe(false);
          client.disconnect();
          done();
        }, 200);
      });

      client.on('connect_error', () => {
        setTimeout(() => {
          expect(client.connected).toBe(false);
          client.disconnect();
          done();
        }, 200);
      });
    });

    it('should disconnect for inactive admin user', (done) => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        adminRole: AdminRole.OPERATIONS_MANAGER,
        isActive: false,
      });

      const client = connectClient(validToken);

      client.on('connect', () => {
        setTimeout(() => {
          expect(client.connected).toBe(false);
          client.disconnect();
          done();
        }, 200);
      });

      client.on('connect_error', () => {
        setTimeout(() => {
          expect(client.connected).toBe(false);
          client.disconnect();
          done();
        }, 200);
      });
    });

    it('should disconnect for non-admin user', (done) => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null);

      const client = connectClient(validToken);

      client.on('connect', () => {
        setTimeout(() => {
          expect(client.connected).toBe(false);
          client.disconnect();
          done();
        }, 200);
      });

      client.on('connect_error', () => {
        setTimeout(() => {
          expect(client.connected).toBe(false);
          client.disconnect();
          done();
        }, 200);
      });
    });
  });

  describe('Redis pub/sub broadcasting', () => {
    it('should broadcast driver status update to connected client', (done) => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        adminRole: AdminRole.SUPER_ADMIN,
        isActive: true,
      });

      const client = connectClient(validToken);

      client.on('connected', () => {
        if (pmessageHandler) {
          pmessageHandler(
            'driver_status_changed:*',
            'driver_status_changed:drv-1',
            JSON.stringify({ driverId: 'drv-1', status: 'AVAILABLE' }),
          );
        }
      });

      client.on('message', (envelope: any) => {
        expect(envelope.event).toBe('DRIVER_STATUS_UPDATE');
        expect(envelope.data.driverId).toBe('drv-1');
        expect(envelope.timestamp).toBeDefined();
        client.disconnect();
        done();
      });

      client.on('connect_error', (err) => {
        client.disconnect();
        done(err);
      });
    });

    it('should broadcast emergency alert to connected client', (done) => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        adminRole: AdminRole.OPERATIONS_MANAGER,
        isActive: true,
      });

      const client = connectClient(validToken);

      client.on('connected', () => {
        if (pmessageHandler) {
          pmessageHandler(
            'emergency_alerts',
            'emergency_alerts',
            JSON.stringify({ alertId: 'alert-1', type: 'sos' }),
          );
        }
      });

      client.on('message', (envelope: any) => {
        expect(envelope.event).toBe('EMERGENCY_ALERT');
        expect(envelope.data.alertId).toBe('alert-1');
        client.disconnect();
        done();
      });

      client.on('connect_error', (err) => {
        client.disconnect();
        done(err);
      });
    });

    it('should broadcast admin events to connected client', (done) => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        adminRole: AdminRole.SUPPORT_AGENT,
        isActive: true,
      });

      const client = connectClient(validToken);

      client.on('connected', () => {
        if (pmessageHandler) {
          pmessageHandler(
            'admin_events',
            'admin_events',
            JSON.stringify({ type: 'BROADCAST_SENT' }),
          );
        }
      });

      client.on('message', (envelope: any) => {
        expect(envelope.event).toBe('ADMIN_EVENT');
        expect(envelope.data.type).toBe('BROADCAST_SENT');
        client.disconnect();
        done();
      });

      client.on('connect_error', (err) => {
        client.disconnect();
        done(err);
      });
    });

    it('should handle non-JSON Redis messages gracefully', (done) => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        adminRole: AdminRole.SUPER_ADMIN,
        isActive: true,
      });

      const client = connectClient(validToken);

      client.on('connected', () => {
        if (pmessageHandler) {
          pmessageHandler(
            'driver_assignments',
            'driver_assignments',
            'not-valid-json',
          );
        }
      });

      client.on('message', (envelope: any) => {
        expect(envelope.event).toBe('DRIVER_ASSIGNMENT');
        expect(envelope.data.raw).toBe('not-valid-json');
        client.disconnect();
        done();
      });

      client.on('connect_error', (err) => {
        client.disconnect();
        done(err);
      });
    });
  });
});
