import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const mockUser = {
  id: 'user-uuid-1',
  supabase_uid: 'supabase-uuid-1',
  email: 'admin@derlg.com',
  role: 'admin',
  full_name: 'Admin User',
};

const mockAdminUser = {
  id: 'admin-uuid-1',
  userId: 'user-uuid-1',
  adminRole: 'SUPER_ADMIN',
  permissions: { canEditDrivers: true },
  isActive: true,
};

const mockRefreshTokenRecord = {
  id: 'rt-uuid-1',
  token_id: 'refresh-token-1',
  user_id: 'user-uuid-1',
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  revoked_at: null,
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let redisService: RedisService;

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    adminUser: {
      findUnique: jest.fn(),
    },
    refresh_tokens: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('signed-jwt-token'),
  };

  const mockRedisClient = {
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    redisService = module.get<RedisService>(RedisService);
  });

  describe('login', () => {
    it('should login successfully with valid admin credentials', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.$queryRaw.mockResolvedValue([{ encrypted_password: '$2b$10$abcdefghijklmnopqrstuvwxycdefghijklmnopqrstu' }]);
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser);
      mockPrisma.refresh_tokens.create.mockResolvedValue(mockRefreshTokenRecord);

      const bcryptCompareSpy = jest
        .spyOn(require('bcrypt'), 'compare')
        .mockResolvedValue(true);

      const result = await service.login('admin@derlg.com', 'password123');

      expect(result.accessToken).toBe('signed-jwt-token');
      expect(result.user.email).toBe('admin@derlg.com');
      expect(result.user.adminRole).toBe('SUPER_ADMIN');
      expect(mockPrisma.refresh_tokens.create).toHaveBeenCalled();
      expect(mockRedisClient.setex).toHaveBeenCalled();

      bcryptCompareSpy.mockRestore();
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.login('unknown@derlg.com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.$queryRaw.mockResolvedValue([{ encrypted_password: '$2b$10$hash' }]);

      const bcryptCompareSpy = jest
        .spyOn(require('bcrypt'), 'compare')
        .mockResolvedValue(false);

      await expect(service.login('admin@derlg.com', 'wrongpassword')).rejects.toThrow(
        UnauthorizedException,
      );

      bcryptCompareSpy.mockRestore();
    });

    it('should throw ForbiddenException when user role is not admin', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, role: 'user' });
      mockPrisma.$queryRaw.mockResolvedValue([{ encrypted_password: '$2b$10$hash' }]);

      const bcryptCompareSpy = jest
        .spyOn(require('bcrypt'), 'compare')
        .mockResolvedValue(true);

      await expect(service.login('user@derlg.com', 'password')).rejects.toThrow(
        ForbiddenException,
      );

      bcryptCompareSpy.mockRestore();
    });

    it('should throw ForbiddenException when no admin record exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.$queryRaw.mockResolvedValue([{ encrypted_password: '$2b$10$hash' }]);
      mockPrisma.adminUser.findUnique.mockResolvedValue(null);

      const bcryptCompareSpy = jest
        .spyOn(require('bcrypt'), 'compare')
        .mockResolvedValue(true);

      await expect(service.login('admin@derlg.com', 'password')).rejects.toThrow(
        ForbiddenException,
      );

      bcryptCompareSpy.mockRestore();
    });

    it('should throw ForbiddenException when admin account is deactivated', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.$queryRaw.mockResolvedValue([{ encrypted_password: '$2b$10$hash' }]);
      mockPrisma.adminUser.findUnique.mockResolvedValue({ ...mockAdminUser, isActive: false });

      const bcryptCompareSpy = jest
        .spyOn(require('bcrypt'), 'compare')
        .mockResolvedValue(true);

      await expect(service.login('admin@derlg.com', 'password')).rejects.toThrow(
        ForbiddenException,
      );

      bcryptCompareSpy.mockRestore();
    });

    it('should handle auth schema query failure gracefully', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.$queryRaw.mockRejectedValue(new Error('permission denied'));

      await expect(service.login('admin@derlg.com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshTokens', () => {
    it('should return new access token with valid refresh token', async () => {
      mockPrisma.refresh_tokens.findFirst.mockResolvedValue(mockRefreshTokenRecord);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser);

      const result = await service.refreshTokens('refresh-token-1');

      expect(result.accessToken).toBe('signed-jwt-token');
      expect(result.user.id).toBe('user-uuid-1');
      expect(mockJwtService.sign).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when refresh token is missing', async () => {
      await expect(service.refreshTokens('')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when refresh token is invalid', async () => {
      mockPrisma.refresh_tokens.findFirst.mockResolvedValue(null);

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw ForbiddenException when admin account is inactive', async () => {
      mockPrisma.refresh_tokens.findFirst.mockResolvedValue(mockRefreshTokenRecord);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.adminUser.findUnique.mockResolvedValue({ ...mockAdminUser, isActive: false });

      await expect(service.refreshTokens('refresh-token-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke refresh token and clear redis cache', async () => {
      mockPrisma.refresh_tokens.findFirst.mockResolvedValue(mockRefreshTokenRecord);
      mockPrisma.refresh_tokens.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('refresh-token-1');

      expect(mockPrisma.refresh_tokens.updateMany).toHaveBeenCalledWith({
        where: { token_id: 'refresh-token-1' },
        data: { revoked_at: expect.any(Date) },
      });
      expect(mockRedisClient.del).toHaveBeenCalledWith('admin:permissions:user-uuid-1');
    });

    it('should do nothing when refresh token is missing', async () => {
      await service.logout('');

      expect(mockPrisma.refresh_tokens.updateMany).not.toHaveBeenCalled();
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });
});
