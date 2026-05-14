import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from '../services/admin-users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AdminRole } from '@prisma/client';

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  let service: AdminUsersService;

  const mockService = {
    getAllAdminUsers: jest.fn(),
    createAdminUser: jest.fn(),
    updateAdminUser: jest.fn(),
    deactivateAdminUser: jest.fn(),
    createAuditLog: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        { provide: AdminUsersService, useValue: mockService },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: { getClient: jest.fn() } },
        Reflector,
      ],
    }).compile();

    controller = module.get<AdminUsersController>(AdminUsersController);
    service = module.get<AdminUsersService>(AdminUsersService);
  });

  describe('getAllAdminUsers', () => {
    it('should return admin users with envelope', async () => {
      mockService.getAllAdminUsers.mockResolvedValue([
        { id: 'admin-1', email: 'admin@example.com', admin_role: AdminRole.SUPER_ADMIN },
      ]);

      const result = await controller.getAllAdminUsers();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].email).toBe('admin@example.com');
    });
  });

  describe('createAdminUser', () => {
    it('should create admin user and log audit', async () => {
      mockService.createAdminUser.mockResolvedValue({
        id: 'admin-1',
        email: 'new@example.com',
        admin_role: AdminRole.OPERATIONS_MANAGER,
      });
      mockService.createAuditLog.mockResolvedValue(undefined);

      const dto = {
        email: 'new@example.com',
        admin_role: AdminRole.OPERATIONS_MANAGER,
      };

      const result = await controller.createAdminUser(dto as any, 'admin-1');

      expect(result.success).toBe(true);
      expect(result.data.email).toBe('new@example.com');
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-1',
          entityType: 'ADMIN_USER',
          metadata: expect.objectContaining({ action: 'CREATE_ADMIN_USER' }),
        }),
      );
    });
  });

  describe('updateAdminUser', () => {
    it('should update admin user and log audit', async () => {
      mockService.updateAdminUser.mockResolvedValue({
        id: 'admin-1',
        adminRole: AdminRole.FLEET_MANAGER,
      });
      mockService.createAuditLog.mockResolvedValue(undefined);

      const dto = { admin_role: AdminRole.FLEET_MANAGER };

      const result = await controller.updateAdminUser('admin-1', dto as any, 'admin-1');

      expect(result.success).toBe(true);
      expect(result.data.adminRole).toBe(AdminRole.FLEET_MANAGER);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-1',
          entityType: 'ADMIN_USER',
          entityId: 'admin-1',
          metadata: expect.objectContaining({ action: 'UPDATE_ADMIN_USER' }),
        }),
      );
    });
  });

  describe('deactivateAdminUser', () => {
    it('should deactivate admin user and log audit', async () => {
      mockService.deactivateAdminUser.mockResolvedValue({
        id: 'admin-1',
        userId: 'user-1',
        isActive: false,
      });
      mockService.createAuditLog.mockResolvedValue(undefined);

      const result = await controller.deactivateAdminUser('admin-1', 'admin-1');

      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(false);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-1',
          entityType: 'ADMIN_USER',
          entityId: 'admin-1',
          metadata: expect.objectContaining({ action: 'DEACTIVATE_ADMIN_USER' }),
        }),
      );
    });
  });
});
