import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminEmergencyController } from './admin-emergency.controller';
import { AdminEmergencyService } from '../services/admin-emergency.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { emergency_alert_status, emergency_alert_type } from '@prisma/client';

describe('AdminEmergencyController', () => {
  let controller: AdminEmergencyController;
  let service: AdminEmergencyService;

  const mockAlert = {
    id: 'alert-uuid-1',
    userId: 'user-uuid-1',
    alertType: emergency_alert_type.sos,
    status: emergency_alert_status.triggered,
    latitude: 13.3614,
    longitude: 103.857,
    accuracy_meters: 5.0,
    acknowledged_at: null,
    acknowledged_by: null,
    resolved_at: null,
    notes: null,
    createdAt: new Date(),
  };

  const mockService = {
    getAllEmergencyAlerts: jest.fn(),
    getEmergencyAlertById: jest.fn(),
    acknowledgeAlert: jest.fn(),
    resolveAlert: jest.fn(),
    createAuditLog: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminEmergencyController],
      providers: [
        { provide: AdminEmergencyService, useValue: mockService },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: { getClient: jest.fn() } },
        Reflector,
      ],
    }).compile();

    controller = module.get<AdminEmergencyController>(AdminEmergencyController);
    service = module.get<AdminEmergencyService>(AdminEmergencyService);
  });

  describe('getAllEmergencyAlerts', () => {
    it('should return paginated alerts', async () => {
      mockService.getAllEmergencyAlerts.mockResolvedValue({
        data: [mockAlert],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await controller.getAllEmergencyAlerts();

      expect(result.data).toHaveLength(1);
      expect(mockService.getAllEmergencyAlerts).toHaveBeenCalledWith({});
    });

    it('should pass query filters to service', async () => {
      mockService.getAllEmergencyAlerts.mockResolvedValue({
        data: [],
        meta: { total: 0 },
      });

      await controller.getAllEmergencyAlerts('triggered', 'sos', '2', '50');

      expect(mockService.getAllEmergencyAlerts).toHaveBeenCalledWith({
        status: 'triggered',
        alertType: 'sos',
        page: '2',
        limit: '50',
      });
    });
  });

  describe('getEmergencyAlertById', () => {
    it('should return a single alert', async () => {
      mockService.getEmergencyAlertById.mockResolvedValue(mockAlert);

      const result = await controller.getEmergencyAlertById('alert-uuid-1');

      expect(result.id).toBe('alert-uuid-1');
    });
  });

  describe('updateEmergencyAlert', () => {
    it('should acknowledge alert and log audit', async () => {
      mockService.acknowledgeAlert.mockResolvedValue({
        ...mockAlert,
        status: emergency_alert_status.acknowledged,
      });
      mockService.createAuditLog.mockResolvedValue(undefined);

      const result = await controller.updateEmergencyAlert(
        'alert-uuid-1',
        { status: emergency_alert_status.acknowledged },
        'user-1',
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(emergency_alert_status.acknowledged);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          entityType: 'EMERGENCY',
          metadata: expect.objectContaining({
            action: 'ACKNOWLEDGE_EMERGENCY',
          }),
        }),
      );
    });

    it('should resolve alert and log audit', async () => {
      mockService.resolveAlert.mockResolvedValue({
        ...mockAlert,
        status: emergency_alert_status.resolved,
        notes: 'Customer safe',
      });
      mockService.createAuditLog.mockResolvedValue(undefined);

      const result = await controller.updateEmergencyAlert(
        'alert-uuid-1',
        { status: emergency_alert_status.resolved, notes: 'Customer safe' },
        'user-1',
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(emergency_alert_status.resolved);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          entityType: 'EMERGENCY',
          metadata: expect.objectContaining({
            action: 'RESOLVE_EMERGENCY',
          }),
        }),
      );
    });

    it('should throw error for invalid status', async () => {
      mockService.createAuditLog.mockResolvedValue(undefined);

      await expect(
        controller.updateEmergencyAlert(
          'alert-uuid-1',
          { status: emergency_alert_status.triggered },
          'user-1',
        ),
      ).rejects.toThrow('Invalid status transition');
    });
  });
});
