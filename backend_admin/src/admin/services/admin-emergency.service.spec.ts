import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { emergency_alert_status, emergency_alert_type } from '@prisma/client';
import { AdminEmergencyService } from './admin-emergency.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

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

const mockUser = {
  id: 'user-uuid-1',
  email: 'user@example.com',
  full_name: 'John Doe',
  phone: '+85512345678',
};

const mockDriver = {
  id: 'driver-uuid-1',
  driverName: 'Jane Driver',
  phone: '+85587654321',
  status: 'AVAILABLE',
};

describe('AdminEmergencyService', () => {
  let service: AdminEmergencyService;
  let prisma: PrismaService;

  const mockPrisma = {
    emergencyAlert: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const mockRedis = {
    getClient: jest.fn().mockReturnValue({
      publish: jest.fn().mockResolvedValue(1),
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminEmergencyService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AdminEmergencyService>(AdminEmergencyService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getAllEmergencyAlerts', () => {
    it('should return paginated alerts with user and driver info', async () => {
      mockPrisma.emergencyAlert.findMany.mockResolvedValue([
        { ...mockAlert, users: mockUser, driver: mockDriver },
      ]);
      mockPrisma.emergencyAlert.count.mockResolvedValue(1);

      const result = await service.getAllEmergencyAlerts({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].user).toBeDefined();
      expect(result.data[0].driver).toBeDefined();
      expect(result.meta.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.emergencyAlert.findMany.mockResolvedValue([]);
      mockPrisma.emergencyAlert.count.mockResolvedValue(0);

      await service.getAllEmergencyAlerts({ status: 'triggered' });

      expect(mockPrisma.emergencyAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'triggered' }),
        }),
      );
    });

    it('should filter by alert type', async () => {
      mockPrisma.emergencyAlert.findMany.mockResolvedValue([]);
      mockPrisma.emergencyAlert.count.mockResolvedValue(0);

      await service.getAllEmergencyAlerts({ alertType: 'sos' });

      expect(mockPrisma.emergencyAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ alertType: 'sos' }),
        }),
      );
    });
  });

  describe('getEmergencyAlertById', () => {
    it('should return alert with full details', async () => {
      mockPrisma.emergencyAlert.findUnique.mockResolvedValue({
        ...mockAlert,
        users: mockUser,
        driver: mockDriver,
      });

      const result = await service.getEmergencyAlertById('alert-uuid-1');

      expect(result.id).toBe('alert-uuid-1');
      expect(result.user).toBeDefined();
      expect(result.driver).toBeDefined();
    });

    it('should throw NotFoundException when alert not found', async () => {
      mockPrisma.emergencyAlert.findUnique.mockResolvedValue(null);

      await expect(
        service.getEmergencyAlertById('invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge alert and publish event', async () => {
      mockPrisma.emergencyAlert.findUnique.mockResolvedValue(mockAlert);
      mockPrisma.emergencyAlert.update.mockResolvedValue({
        ...mockAlert,
        status: emergency_alert_status.acknowledged,
        acknowledged_at: new Date(),
        acknowledged_by: 'admin-uuid-1',
        users: mockUser,
        driver: mockDriver,
      });

      const result = await service.acknowledgeAlert('alert-uuid-1', 'admin-uuid-1');

      expect(result.status).toBe(emergency_alert_status.acknowledged);
      expect(result.acknowledged_by).toBe('admin-uuid-1');
      expect(mockRedis.getClient().publish).toHaveBeenCalled();
    });

    it('should throw NotFoundException when alert not found', async () => {
      mockPrisma.emergencyAlert.findUnique.mockResolvedValue(null);

      await expect(
        service.acknowledgeAlert('invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when already resolved', async () => {
      mockPrisma.emergencyAlert.findUnique.mockResolvedValue({
        ...mockAlert,
        status: emergency_alert_status.resolved,
      });

      await expect(
        service.acknowledgeAlert('alert-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when already cancelled', async () => {
      mockPrisma.emergencyAlert.findUnique.mockResolvedValue({
        ...mockAlert,
        status: emergency_alert_status.cancelled,
      });

      await expect(
        service.acknowledgeAlert('alert-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resolveAlert', () => {
    it('should resolve alert with notes and publish event', async () => {
      mockPrisma.emergencyAlert.findUnique.mockResolvedValue({
        ...mockAlert,
        status: emergency_alert_status.acknowledged,
        acknowledged_at: new Date(),
      });
      mockPrisma.emergencyAlert.update.mockResolvedValue({
        ...mockAlert,
        status: emergency_alert_status.resolved,
        resolved_at: new Date(),
        notes: 'Customer safe',
        users: mockUser,
        driver: mockDriver,
      });

      const result = await service.resolveAlert('alert-uuid-1', 'Customer safe', 'admin-uuid-1');

      expect(result.status).toBe(emergency_alert_status.resolved);
      expect(result.notes).toBe('Customer safe');
      expect(mockRedis.getClient().publish).toHaveBeenCalled();
    });

    it('should throw NotFoundException when alert not found', async () => {
      mockPrisma.emergencyAlert.findUnique.mockResolvedValue(null);

      await expect(
        service.resolveAlert('invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when already resolved', async () => {
      mockPrisma.emergencyAlert.findUnique.mockResolvedValue({
        ...mockAlert,
        status: emergency_alert_status.resolved,
      });

      await expect(
        service.resolveAlert('alert-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when cancelled', async () => {
      mockPrisma.emergencyAlert.findUnique.mockResolvedValue({
        ...mockAlert,
        status: emergency_alert_status.cancelled,
      });

      await expect(
        service.resolveAlert('alert-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
