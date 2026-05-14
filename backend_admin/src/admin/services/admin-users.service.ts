import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminRole } from '@prisma/client';

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);
  private readonly CACHE_TTL_SECONDS = 5 * 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getAllAdminUsers() {
    const adminUsers = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const userIds = adminUsers.map((au) => au.userId);
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              email: true,
              full_name: true,
              phone: true,
              role: true,
              createdAt: true,
            },
          })
        : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    return adminUsers.map((au) => {
      const user = userMap.get(au.userId);
      return {
        id: au.id,
        user_id: au.userId,
        email: user?.email || null,
        full_name: user?.full_name || null,
        phone: user?.phone || null,
        role: user?.role || null,
        admin_role: au.adminRole,
        permissions: au.permissions,
        is_active: au.isActive,
        created_at: au.createdAt,
        user_created_at: user?.createdAt || null,
      };
    });
  }

  async createAdminUser(dto: {
    email: string;
    full_name?: string;
    phone?: string;
    admin_role: AdminRole;
    permissions?: Record<string, boolean>;
  }) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: { equals: dto.email, mode: 'insensitive' } },
    });

    let userId: string;

    if (existingUser) {
      // If user exists, check if already an admin
      const existingAdmin = await this.prisma.adminUser.findUnique({
        where: { userId: existingUser.id },
      });

      if (existingAdmin) {
        throw new ConflictException(
          `User with email '${dto.email}' is already an admin`,
        );
      }

      // Update existing user role to admin
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: { role: 'admin' as any },
      });

      userId = existingUser.id;
    } else {
      // Create new user
      const newUser = await this.prisma.user.create({
        data: {
          id: randomUUID(),
          supabase_uid: randomUUID(),
          email: dto.email.toLowerCase(),
          full_name: dto.full_name || null,
          phone: dto.phone || null,
          role: 'admin' as any,
        },
      });
      userId = newUser.id;
    }

    const adminUser = await this.prisma.adminUser.create({
      data: {
        userId,
        adminRole: dto.admin_role,
        permissions: dto.permissions || {},
      },
    });

    // Cache admin permissions
    await this.cacheAdminPermissions(userId, dto.admin_role, dto.permissions);

    return {
      id: adminUser.id,
      user_id: adminUser.userId,
      email: dto.email.toLowerCase(),
      full_name: dto.full_name || null,
      phone: dto.phone || null,
      admin_role: adminUser.adminRole,
      permissions: adminUser.permissions,
      is_active: adminUser.isActive,
      created_at: adminUser.createdAt,
    };
  }

  async updateAdminUser(
    id: string,
    dto: {
      admin_role?: AdminRole;
      permissions?: Record<string, boolean>;
      is_active?: boolean;
    },
  ) {
    const existing = await this.prisma.adminUser.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Admin user with id ${id} not found`);
    }

    const adminUser = await this.prisma.adminUser.update({
      where: { id },
      data: {
        adminRole: dto.admin_role,
        permissions: dto.permissions,
        isActive: dto.is_active,
      },
    });

    // Invalidate and refresh cache
    await this.redis.getClient().del(`admin:permissions:${existing.userId}`);

    if (dto.admin_role && dto.is_active !== false) {
      await this.cacheAdminPermissions(
        existing.userId,
        dto.admin_role,
        dto.permissions ?? (existing.permissions as Record<string, boolean>),
      );
    }

    return adminUser;
  }

  async deactivateAdminUser(id: string) {
    const existing = await this.prisma.adminUser.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Admin user with id ${id} not found`);
    }

    const adminUser = await this.prisma.adminUser.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    // Revoke all refresh tokens for this user
    await this.prisma.refresh_tokens.updateMany({
      where: { user_id: existing.userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });

    // Clear cache
    await this.redis.getClient().del(`admin:permissions:${existing.userId}`);

    return adminUser;
  }

  async createAuditLog(params: {
    userId?: string;
    eventType: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          user_id: params.userId || null,
          event_type: params.eventType as any,
          entity_type: params.entityType,
          entity_id: params.entityId || null,
          metadata: params.metadata || {},
        },
      });
    } catch (err) {
      this.logger.warn(`Audit log creation failed: ${err.message}`);
    }
  }

  private async cacheAdminPermissions(
    userId: string,
    adminRole: AdminRole,
    permissions: Record<string, boolean> | undefined,
  ): Promise<void> {
    const cacheKey = `admin:permissions:${userId}`;
    const cacheData = {
      adminRole,
      permissions: permissions || null,
      isActive: true,
    };

    try {
      await this.redis
        .getClient()
        .setex(cacheKey, this.CACHE_TTL_SECONDS, JSON.stringify(cacheData));
    } catch (err) {
      this.logger.warn(`Redis cache write failed: ${err.message}`);
    }
  }
}
