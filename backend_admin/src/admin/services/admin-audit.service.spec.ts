import { Test, TestingModule } from '@nestjs/testing';
import { AdminAuditService } from './admin-audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { audit_event_type } from '@prisma/client';

const mockAuditLog = {
  id: 'audit-uuid-1',
  user_id: 'user-uuid-1',
  event_type: audit_event_type.admin_action,
  entity_type: 'BOOKING',
  entity_id: 'booking-1',
  ipAddress: '127.0.0.1',
  userAgent: 'Mozilla/5.0',
  metadata: { action: 'UPDATE' },
  created_at: new Date('2026-05-01'),
  users: {
    email: 'admin@example.com',
    full_name: 'Admin User',
  },
};

describe('AdminAuditService', () => {
  let service: AdminAuditService;
  let prisma: PrismaService;

  const mockPrisma = {
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminAuditService>(AdminAuditService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getAllAuditLogs', () => {
    it('should return paginated audit logs with user info', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await service.getAllAuditLogs({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].event_type).toBe(audit_event_type.admin_action);
      expect(result.data[0].user?.email).toBe('admin@example.com');
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('should apply date filters', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.getAllAuditLogs({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            created_at: expect.objectContaining({
              gte: new Date('2026-01-01'),
              lte: new Date('2026-01-31'),
            }),
          }),
        }),
      );
    });

    it('should apply admin user and action type filters', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.getAllAuditLogs({
        adminUserId: 'user-1',
        actionType: 'admin_action',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user_id: 'user-1',
            event_type: 'admin_action',
          }),
        }),
      );
    });

    it('should parse page and limit', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.getAllAuditLogs({ page: '2', limit: '50' });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 50, take: 50 }),
      );
    });
  });

  describe('createAuditLog', () => {
    it('should create a manual audit log entry', async () => {
      mockPrisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.createAuditLog({
        userId: 'user-1',
        eventType: audit_event_type.admin_action,
        entityType: 'BOOKING',
        entityId: 'booking-1',
        metadata: { action: 'TEST' },
      });

      expect(result.event_type).toBe(audit_event_type.admin_action);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: 'user-1',
            event_type: audit_event_type.admin_action,
            entity_type: 'BOOKING',
            entity_id: 'booking-1',
          }),
        }),
      );
    });
  });

  describe('exportAuditLogs', () => {
    it('should export audit logs as CSV', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);

      const result = await service.exportAuditLogs({});

      expect(result.format).toBe('csv');
      expect(result.content).toContain('id,user_id,user_email');
      expect(result.content).toContain('admin@example.com');
    });

    it('should apply filters to export', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await service.exportAuditLogs({
        startDate: '2026-01-01',
        adminUserId: 'user-1',
        actionType: 'admin_action',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            created_at: expect.objectContaining({ gte: new Date('2026-01-01') }),
            user_id: 'user-1',
            event_type: 'admin_action',
          }),
          take: 5000,
        }),
      );
    });

    it('should handle empty results', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.exportAuditLogs({});

      expect(result.format).toBe('csv');
      expect(result.content).toBe('');
    });
  });
});
