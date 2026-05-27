import { Test, TestingModule } from '@nestjs/testing';
import { register } from 'prom-client';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    register.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
    service.onModuleInit();
  });

  afterEach(() => {
    register.clear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should record webhook request', () => {
    expect(() => service.recordWebhookRequest('success', 'command')).not.toThrow();
  });

  it('should record command usage', () => {
    expect(() => service.recordCommandUsage('/start')).not.toThrow();
  });

  it('should record assignment action', () => {
    expect(() => service.recordAssignmentAction('accept', 'success')).not.toThrow();
  });

  it('should record broadcast message', () => {
    expect(() => service.recordBroadcastMessage('sent')).not.toThrow();
  });

  it('should record response time', () => {
    expect(() => service.recordResponseTime(0.15)).not.toThrow();
  });

  it('should return metrics string', async () => {
    const metrics = await service.getMetrics();
    expect(typeof metrics).toBe('string');
    expect(metrics.length).toBeGreaterThan(0);
  });
});
