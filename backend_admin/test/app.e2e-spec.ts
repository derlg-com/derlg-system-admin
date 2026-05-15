import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getQueueToken } from '@nestjs/bullmq';
import { BroadcastProcessor } from './../src/telegram/jobs/broadcast.processor';
import { AssignmentTimeoutProcessor } from './../src/telegram/jobs/assignment-timeout.processor';
import { LocationCleanupProcessor } from './../src/telegram/jobs/location-cleanup.processor';
import { AppModule } from './../src/app.module';
import { RedisService } from './../src/redis/redis.service';

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

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
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
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app.close();
  });
});
