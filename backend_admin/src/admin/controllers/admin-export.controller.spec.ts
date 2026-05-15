import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminExportController } from './admin-export.controller';
import { AdminExportService } from '../services/admin-export.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

describe('AdminExportController', () => {
  let controller: AdminExportController;

  const mockService = {
    exportBookings: jest.fn(),
    exportDrivers: jest.fn(),
    exportPayments: jest.fn(),
    triggerBackup: jest.fn(),
    getBackups: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminExportController],
      providers: [
        { provide: AdminExportService, useValue: mockService },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: { getClient: jest.fn() } },
        Reflector,
      ],
    }).compile();

    controller = module.get<AdminExportController>(AdminExportController);
  });

  describe('exportBookings', () => {
    it('should export bookings with envelope', async () => {
      mockService.exportBookings.mockResolvedValue({
        format: 'csv',
        content: 'reference,status\nBK001,confirmed',
      });

      const result = await controller.exportBookings('2026-01-01', '2026-01-31', 'csv');

      expect(result.success).toBe(true);
      expect(result.data.format).toBe('csv');
      expect(mockService.exportBookings).toHaveBeenCalledWith({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        format: 'csv',
      });
    });
  });

  describe('exportDrivers', () => {
    it('should export drivers with envelope', async () => {
      mockService.exportDrivers.mockResolvedValue({
        format: 'csv',
        content: 'driver_id,driver_name\nDRV001,John',
      });

      const result = await controller.exportDrivers();

      expect(result.success).toBe(true);
      expect(result.data.format).toBe('csv');
    });
  });

  describe('exportPayments', () => {
    it('should export payments with envelope', async () => {
      mockService.exportPayments.mockResolvedValue({
        format: 'csv.encrypted',
        content: 'encrypted-data',
        iv: 'iv-hex',
        authTag: 'tag-hex',
      });

      const result = await controller.exportPayments();

      expect(result.success).toBe(true);
      expect(result.data.format).toBe('csv.encrypted');
    });
  });

  describe('triggerBackup', () => {
    it('should trigger backup with userId', async () => {
      mockService.triggerBackup.mockResolvedValue({
        id: 'backup-1',
        backup_file_url: 'https://example.com/backup.sql',
      });

      const result = await controller.triggerBackup('admin-1');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('backup-1');
      expect(mockService.triggerBackup).toHaveBeenCalledWith('admin-1');
    });

    it('should use system fallback when no userId', async () => {
      mockService.triggerBackup.mockResolvedValue({ id: 'backup-1' });

      await controller.triggerBackup(undefined);

      expect(mockService.triggerBackup).toHaveBeenCalledWith('system');
    });
  });

  describe('getBackups', () => {
    it('should return backups with envelope', async () => {
      mockService.getBackups.mockResolvedValue([
        { id: 'backup-1', createdAt: new Date() },
      ]);

      const result = await controller.getBackups();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });
});
