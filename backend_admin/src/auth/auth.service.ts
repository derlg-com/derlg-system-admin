import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  adminRole: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_TTL_DAYS = 7;
  private readonly CACHE_TTL_SECONDS = 5 * 60;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await this.verifyPassword(user.supabase_uid, password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userRole = String(user.role).toLowerCase();
    if (!['admin', 'support'].includes(userRole)) {
      throw new ForbiddenException('Access denied: admin privileges required');
    }

    const adminUser = await this.prisma.adminUser.findUnique({
      where: { userId: user.id },
    });

    if (!adminUser) {
      throw new ForbiddenException('Access denied: not an admin user');
    }

    if (!adminUser.isActive) {
      throw new ForbiddenException('Access denied: admin account is deactivated');
    }

    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: this.ACCESS_TOKEN_EXPIRY },
    );

    const refreshToken = randomUUID();
    const refreshTokenExpiresAt = new Date(
      Date.now() + this.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.refresh_tokens.create({
      data: {
        id: randomUUID(),
        token_id: refreshToken,
        user_id: user.id,
        expires_at: refreshTokenExpiresAt,
      },
    });

    await this.cacheAdminPermissions(user.id, adminUser.adminRole, adminUser.permissions, adminUser.isActive);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        adminRole: adminUser.adminRole,
      },
    };
  }

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; user: AuthUser }> {
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const tokenRecord = await this.prisma.refresh_tokens.findFirst({
      where: {
        token_id: refreshToken,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: tokenRecord.user_id },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const adminUser = await this.prisma.adminUser.findUnique({
      where: { userId: user.id },
    });

    if (!adminUser || !adminUser.isActive) {
      throw new ForbiddenException('Access denied: admin account inactive');
    }

    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: this.ACCESS_TOKEN_EXPIRY },
    );

    await this.cacheAdminPermissions(user.id, adminUser.adminRole, adminUser.permissions, adminUser.isActive);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        adminRole: adminUser.adminRole,
      },
    };
  }

  async logout(refreshToken: string): Promise<void> {
    if (!refreshToken) return;

    const tokenRecord = await this.prisma.refresh_tokens.findFirst({
      where: { token_id: refreshToken },
    });

    if (tokenRecord) {
      await this.prisma.refresh_tokens.updateMany({
        where: { token_id: refreshToken },
        data: { revoked_at: new Date() },
      });

      try {
        await this.redis.getClient().del(`admin:permissions:${tokenRecord.user_id}`);
      } catch (err) {
        this.logger.warn(`Failed to clear Redis cache on logout: ${err.message}`);
      }
    }
  }

  private async verifyPassword(supabaseUid: string, password: string): Promise<boolean> {
    try {
      const rows = await this.prisma.$queryRaw<{ encrypted_password: string }[]>`
        SELECT encrypted_password FROM auth.users WHERE id = ${supabaseUid}::uuid LIMIT 1
      `;

      if (!rows || rows.length === 0 || !rows[0].encrypted_password) {
        return false;
      }

      return bcrypt.compare(password, rows[0].encrypted_password);
    } catch (err) {
      this.logger.error(`Password verification failed: ${err.message}`);
      return false;
    }
  }

  private async cacheAdminPermissions(
    userId: string,
    adminRole: string,
    permissions: any,
    isActive: boolean,
  ): Promise<void> {
    const cacheKey = `admin:permissions:${userId}`;
    const cacheData = {
      adminRole,
      permissions: (permissions as Record<string, boolean>) || null,
      isActive,
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
