import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AdminExportService } from './admin-export.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminExportService', () => {
  let service: AdminExportService;

  const mockPrisma = {
    booking: {
      findMany: jest.fn(),
    },
    driver: {
      findMany: jest.fn(),
    },
    payments: {
      findMany: jest.fn(),
    },
    backup: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockConfig = {
    get: jest.fn().mockReturnValue('test-encryption-key-32-characters-long!'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminExportService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AdminExportService>(AdminExportService);
  });

  describe('exportBookings', () => {
    it('should export bookings as CSV by default', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([
        {
          id: 'bk-1',
          reference: 'BK001',
          users: { email: 'user@example.com', full_name: 'User' },
          start_date: new Date('2026-05-01'),
          end_date: new Date('2026-05-05'),
          status: 'confirmed',
          totalUsd: 250,
          payments: [{ amount_usd: 250, status: 'succeeded' }],
          passenger_count: 2,
          createdAt: new Date('2026-04-01'),
        },
      ]);

      const result = await service.exportBookings({});

      expect(result.format).toBe('csv');
      expect(result.content).toContain('reference');
      expect(result.content).toContain('BK001');
    });

    it('should export bookings as JSON when requested', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([
        {
          id: 'bk-1',
          reference: 'BK001',
          users: { email: 'user@example.com', full_name: 'User' },
          start_date: new Date('2026-05-01'),
          end_date: new Date('2026-05-05'),
          status: 'confirmed',
          totalUsd: 250,
          payments: [],
          passenger_count: 2,
          createdAt: new Date('2026-04-01'),
        },
      ]);

      const result = await service.exportBookings({ format: 'json' });

      expect(result.format).toBe('json');
      expect(result.content).toContain('BK001');
    });

    it('should apply date filters', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);

      await service.exportBookings({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: new Date('2026-01-01'),
              lte: new Date('2026-01-31'),
            }),
          }),
        }),
      );
    });
  });

  describe('exportDrivers', () => {
    it('should export drivers with performance metrics', async () => {
      mockPrisma.driver.findMany.mockResolvedValue([
        {
          id: 'drv-1',
          driverId: 'DRV001',
          driverName: 'John Doe',
          phone: '+85512345678',
          status: 'AVAILABLE',
          telegramId: BigInt(123456),
          assignments: [{ id: 'a1' }, { id: 'a2' }],
          createdAt: new Date('2026-01-01'),
        },
      ]);

      const result = await service.exportDrivers();

      expect(result.format).toBe('csv');
      expect(result.content).toContain('DRV001');
      expect(result.content).toContain('John Doe');
      expect(result.content).toContain('2');
    });
  });

  describe('exportPayments', () => {
    it('should export payments as encrypted CSV', async () => {
      mockPrisma.payments.findMany.mockResolvedValue([
        {
          id: 'pay-1',
          bookings: { reference: 'BK001' },
          users: { email: 'user@example.com', full_name: 'User' },
          provider: 'stripe',
          amount_usd: 250,
          currency: 'usd',
          status: 'succeeded',
          paid_at: new Date('2026-05-01'),
          created_at: new Date('2026-05-01'),
        },
      ]);

      const result = await service.exportPayments();

      expect(result.format).toBe('csv.encrypted');
      expect(result.content).toBeTruthy();
      expect(result.iv).toBeTruthy();
      expect(result.authTag).toBeTruthy();

      // Verify we can decrypt
      const decrypted = service.decrypt(result.content, result.iv, result.authTag);
      expect(decrypted).toContain('BK001');
      expect(decrypted).toContain('stripe');
    });
  });

  describe('triggerBackup', () => {
    it('should create backup record', async () => {
      mockPrisma.backup.create.mockResolvedValue({
        id: 'backup-1',
        backupFileUrl: 'https://storage.supabase.co/backups/backup-1.sql',
        backupSizeBytes: BigInt(0),
        createdByAdminId: 'admin-1',
        createdAt: new Date('2026-05-01'),
      });

      const result = await service.triggerBackup('admin-1');

      expect(result.id).toBe('backup-1');
      expect(result.created_by_admin_id).toBe('admin-1');
      expect(mockPrisma.backup.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdByAdminId: 'admin-1',
          }),
        }),
      );
    });
  });

  describe('getBackups', () => {
    it('should return all backups ordered by createdAt desc', async () => {
      mockPrisma.backup.findMany.mockResolvedValue([
        { id: 'backup-2', createdAt: new Date('2026-05-02') },
        { id: 'backup-1', createdAt: new Date('2026-05-01') },
      ]);

      const result = await service.getBackups();

      expect(result).toHaveLength(2);
      expect(mockPrisma.backup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });
});
