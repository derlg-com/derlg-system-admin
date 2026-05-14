import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AdminRole } from '@prisma/client';

const mockUser = {
  id: 'user-uuid-1',
  email: 'admin@example.com',
  full_name: 'Admin User',
  phone: '+85512345678',
  role: 'admin',
  createdAt: new Date(),
};

const mockAdminUser = {
  id: 'admin-uuid-1',
  userId: 'user-uuid-1',
  adminRole: AdminRole.OPERATIONS_MANAGER,
  permissions: { can_edit: true },
  isActive: true,
  createdAt: new Date(),
};

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prisma: PrismaService;

  const mockRedisClient = {
    del: jest.fn(),
    setex: jest.fn(),
  };

  const mockRedis = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
  };

  const mockPrisma = {
    adminUser: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refresh_tokens: {
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AdminUsersService>(AdminUsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getAllAdminUsers', () => {
    it('should return admin users with user details merged', async () => {
      mockPrisma.adminUser.findMany.mockResolvedValue([mockAdminUser]);
      mockPrisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.getAllAdminUsers();

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('admin@example.com');
      expect(result[0].admin_role).toBe(AdminRole.OPERATIONS_MANAGER);
      expect(result[0].is_active).toBe(true);
    });

    it('should return empty array when no admin users', async () => {
      mockPrisma.adminUser.findMany.mockResolvedValue([]);

      const result = await service.getAllAdminUsers();

      expect(result).toHaveLength(0);
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('createAdminUser', () => {
    it('should create admin user for existing user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.adminUser.findUnique.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, role: 'admin' });
      mockPrisma.adminUser.create.mockResolvedValue(mockAdminUser);

      const result = await service.createAdminUser({
        email: 'admin@example.com',
        admin_role: AdminRole.OPERATIONS_MANAGER,
      });

      expect(result.email).toBe('admin@example.com');
      expect(result.admin_role).toBe(AdminRole.OPERATIONS_MANAGER);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-uuid-1' },
          data: { role: 'admin' },
        }),
      );
      expect(mockPrisma.adminUser.create).toHaveBeenCalled();
    });

    it('should create new user and admin user when user does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.adminUser.create.mockResolvedValue(mockAdminUser);

      const result = await service.createAdminUser({
        email: 'admin@example.com',
        full_name: 'Admin User',
        phone: '+85512345678',
        admin_role: AdminRole.SUPPORT_AGENT,
      });

      expect(result.email).toBe('admin@example.com');
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockPrisma.adminUser.create).toHaveBeenCalled();
    });

    it('should throw ConflictException when user is already an admin', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser);

      await expect(
        service.createAdminUser({
          email: 'admin@example.com',
          admin_role: AdminRole.OPERATIONS_MANAGER,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateAdminUser', () => {
    it('should update admin user and invalidate cache', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser);
      mockPrisma.adminUser.update.mockResolvedValue({
        ...mockAdminUser,
        adminRole: AdminRole.FLEET_MANAGER,
      });

      const result = await service.updateAdminUser('admin-uuid-1', {
        admin_role: AdminRole.FLEET_MANAGER,
      });

      expect(result.adminRole).toBe(AdminRole.FLEET_MANAGER);
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'admin:permissions:user-uuid-1',
      );
    });

    it('should throw NotFoundException when admin user not found', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null);

      await expect(
        service.updateAdminUser('invalid-id', {
          admin_role: AdminRole.FLEET_MANAGER,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivateAdminUser', () => {
    it('should deactivate admin user, revoke tokens, and clear cache', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser);
      mockPrisma.adminUser.update.mockResolvedValue({
        ...mockAdminUser,
        isActive: false,
      });

      const result = await service.deactivateAdminUser('admin-uuid-1');

      expect(result.isActive).toBe(false);
      expect(mockPrisma.refresh_tokens.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'user-uuid-1', revoked_at: null },
          data: { revoked_at: expect.any(Date) },
        }),
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'admin:permissions:user-uuid-1',
      );
    });

    it('should throw NotFoundException when admin user not found', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null);

      await expect(
        service.deactivateAdminUser('invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createAuditLog', () => {
    it('should create audit log', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      await service.createAuditLog({
        userId: 'admin-1',
        eventType: 'admin_action',
        entityType: 'ADMIN_USER',
        metadata: { action: 'CREATE' },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should not throw on audit log failure', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.createAuditLog({
          eventType: 'admin_action',
          entityType: 'ADMIN_USER',
        }),
      ).resolves.toBeUndefined();
    });
  });
});
