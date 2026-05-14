import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditService } from '../services/admin-audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { audit_event_type } from '@prisma/client';

describe('AdminAuditController', () => {
  let controller: AdminAuditController;
  let service: AdminAuditService;

  const mockService = {
    getAllAuditLogs: jest.fn(),
    createAuditLog: jest.fn(),
    exportAuditLogs: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuditController],
      providers: [
        { provide: AdminAuditService, useValue: mockService },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: { getClient: jest.fn() } },
        Reflector,
      ],
    }).compile();

    controller = module.get<AdminAuditController>(AdminAuditController);
    service = module.get<AdminAuditService>(AdminAuditService);
  });

  describe('getAllAuditLogs', () => {
    it('should return paginated audit logs with envelope', async () => {
      mockService.getAllAuditLogs.mockResolvedValue({
        data: [{ id: 'audit-1', event_type: audit_event_type.admin_action }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await controller.getAllAuditLogs(
        '2026-01-01',
        '2026-01-31',
        'user-1',
        'admin_action',
        '1',
        '20',
      );

      expect(result.success).toBe(true);
      expect(result.data.data).toHaveLength(1);
      expect(mockService.getAllAuditLogs).toHaveBeenCalledWith({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        adminUserId: 'user-1',
        actionType: 'admin_action',
        page: '1',
        limit: '20',
      });
    });
  });

  describe('createAuditLog', () => {
    it('should create manual audit log entry', async () => {
      mockService.createAuditLog.mockResolvedValue({
        id: 'audit-1',
        event_type: audit_event_type.security_event,
      });

      const dto = {
        event_type: audit_event_type.security_event,
        entity_type: 'USER',
        metadata: { action: 'MANUAL_LOG' },
      };

      const result = await controller.createAuditLog(dto as any, 'admin-1');

      expect(result.success).toBe(true);
      expect(result.data.event_type).toBe(audit_event_type.security_event);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-1',
          eventType: audit_event_type.security_event,
          entityType: 'USER',
        }),
      );
    });
  });

  describe('exportAuditLogs', () => {
    it('should export audit logs with envelope', async () => {
      mockService.exportAuditLogs.mockResolvedValue({
        format: 'csv',
        content: 'id,event_type\naudit-1,admin_action',
      });

      const result = await controller.exportAuditLogs(
        '2026-01-01',
        '2026-01-31',
        'user-1',
        'admin_action',
      );

      expect(result.success).toBe(true);
      expect(result.data.format).toBe('csv');
      expect(mockService.exportAuditLogs).toHaveBeenCalledWith({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        adminUserId: 'user-1',
        actionType: 'admin_action',
      });
    });
  });
});
