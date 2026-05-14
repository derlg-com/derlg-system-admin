import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ADMIN_ROLES_KEY } from '../../common/decorators/admin-roles.decorator';

interface CachedAdminPermissions {
  adminRole: AdminRole;
  permissions: Record<string, boolean> | null;
  isActive: boolean;
}

@Injectable()
export class AdminRoleGuard implements CanActivate {
  private readonly logger = new Logger(AdminRoleGuard.name);
  private readonly CACHE_TTL_SECONDS = 5 * 60; // 5 minutes

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(
      ADMIN_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no @AdminRoles() decorator is set, allow access (AdminGuard already checked basic admin)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sub) {
      throw new ForbiddenException('Access denied: user not authenticated');
    }

    const userId = user.sub;
    const cacheKey = `admin:permissions:${userId}`;

    // Try cache first
    let cached: CachedAdminPermissions | null = null;
    try {
      const cachedRaw = await this.redis.getClient().get(cacheKey);
      if (cachedRaw) {
        cached = JSON.parse(cachedRaw) as CachedAdminPermissions;
        this.logger.debug(`Admin permissions cache hit for user ${userId}`);
      }
    } catch (err) {
      this.logger.warn(`Redis cache read failed: ${err.message}`);
    }

    // If not cached, query database
    if (!cached) {
      const adminUser = await this.prisma.adminUser.findUnique({
        where: { userId },
      });

      if (!adminUser) {
        throw new ForbiddenException('Access denied: not an admin user');
      }

      if (!adminUser.isActive) {
        throw new ForbiddenException('Access denied: admin account is deactivated');
      }

      cached = {
        adminRole: adminUser.adminRole,
        permissions: (adminUser.permissions as Record<string, boolean>) || null,
        isActive: adminUser.isActive,
      };

      // Store in cache
      try {
        await this.redis
          .getClient()
          .setex(cacheKey, this.CACHE_TTL_SECONDS, JSON.stringify(cached));
        this.logger.debug(`Admin permissions cached for user ${userId}`);
      } catch (err) {
        this.logger.warn(`Redis cache write failed: ${err.message}`);
      }
    }

    // Check if admin is active
    if (!cached.isActive) {
      throw new ForbiddenException('Access denied: admin account is deactivated');
    }

    // SUPER_ADMIN bypasses all specific role checks
    if (cached.adminRole === AdminRole.SUPER_ADMIN) {
      this.logger.debug(`SUPER_ADMIN access granted for user ${userId}`);
    } else {
      // Check role match
      const hasRole = requiredRoles.includes(cached.adminRole);
      if (!hasRole) {
        throw new ForbiddenException(
          `Access denied: requires one of [${requiredRoles.join(', ')}], but you have ${cached.adminRole}`,
        );
      }
    }

    // Attach admin metadata to request for downstream use
    request.adminUser = {
      userId,
      adminRole: cached.adminRole,
      permissions: cached.permissions,
    };

    return true;
  }
}
