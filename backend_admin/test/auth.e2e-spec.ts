import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { getQueueToken } from '@nestjs/bullmq';
import { BroadcastProcessor } from './../src/telegram/jobs/broadcast.processor';
import { AssignmentTimeoutProcessor } from './../src/telegram/jobs/assignment-timeout.processor';
import { LocationCleanupProcessor } from './../src/telegram/jobs/location-cleanup.processor';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { RedisService } from './../src/redis/redis.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
}));

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    adminUser: {
      findUnique: jest.fn(),
    },
    refresh_tokens: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const mockRedisClient = {
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

    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/auth/login', () => {
    it('should return 200 with access token and set refresh cookie for valid admin', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        supabase_uid: 'sb-1',
        email: 'admin@derlg.com',
        role: 'admin',
        full_name: 'Admin',
      });
      mockPrisma.$queryRaw.mockResolvedValue([{ encrypted_password: '$2b$10$hash' }]);
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-1',
        userId: 'user-1',
        adminRole: 'SUPER_ADMIN',
        permissions: {},
        isActive: true,
      });
      mockPrisma.refresh_tokens.create.mockResolvedValue({ id: 'rt-1' });

      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'admin@derlg.com', password: 'password123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.user.email).toBe('admin@derlg.com');
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('refresh_token=');
      expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    });

    it('should return 401 for invalid credentials', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'unknown@derlg.com', password: 'password' })
        .expect(401);
    });

    it('should return 400 for invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'not-an-email', password: 'password' })
        .expect(400);
    });

    it('should return 400 for missing password', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'admin@derlg.com' })
        .expect(400);
    });
  });

  describe('POST /v1/auth/refresh', () => {
    it('should return new access token with valid refresh cookie', async () => {
      mockPrisma.refresh_tokens.findFirst.mockResolvedValue({
        id: 'rt-1',
        token_id: 'refresh-token-1',
        user_id: 'user-1',
        expires_at: new Date(Date.now() + 86400000),
        revoked_at: null,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@derlg.com',
        role: 'admin',
        full_name: 'Admin',
      });
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-1',
        userId: 'user-1',
        adminRole: 'SUPER_ADMIN',
        permissions: {},
        isActive: true,
      });

      const response = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', ['refresh_token=refresh-token-1'])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should return 401 when refresh cookie is missing', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .expect(401);
    });
  });

  describe('POST /v1/auth/logout', () => {
    it('should clear refresh cookie and revoke token', async () => {
      mockPrisma.refresh_tokens.findFirst.mockResolvedValue({
        id: 'rt-1',
        token_id: 'refresh-token-1',
        user_id: 'user-1',
      });
      mockPrisma.refresh_tokens.updateMany.mockResolvedValue({ count: 1 });

      const response = await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Cookie', ['refresh_token=refresh-token-1'])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('refresh_token=;');
    });
  });
});
