import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminRole } from '@prisma/client';
import type { JwtPayload } from '../../auth/jwt.strategy';

interface ConnectedAdmin {
  socketId: string;
  userId: string;
  adminRole: AdminRole;
  email: string;
}

@WebSocketGateway({
  namespace: 'v1/admin/ws',
  cors: { origin: process.env.ADMIN_CORS_ORIGIN || '*' },
})
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(AdminGateway.name);
  private connectedAdmins = new Map<string, ConnectedAdmin>();

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit() {
    this.logger.log('Admin WebSocket Gateway initialized');
    this.subscribeToRedis();
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: no token provided`);
        client.disconnect(true);
        return;
      }

      const payload = await this.verifyToken(token);
      if (!payload) {
        this.logger.warn(`Client ${client.id} rejected: invalid token`);
        client.disconnect(true);
        return;
      }

      const adminUser = await this.prisma.adminUser.findUnique({
        where: { userId: payload.sub },
        select: { adminRole: true, isActive: true },
      });

      if (!adminUser || !adminUser.isActive) {
        this.logger.warn(
          `Client ${client.id} rejected: not an active admin user`,
        );
        client.disconnect(true);
        return;
      }

      // Join role-based room
      const roleRoom = `room:${adminUser.adminRole}`;
      client.join(roleRoom);
      client.join('room:all');

      this.connectedAdmins.set(client.id, {
        socketId: client.id,
        userId: payload.sub,
        adminRole: adminUser.adminRole,
        email: payload.email,
      });

      this.logger.log(
        `Client connected: ${client.id} (user=${payload.sub}, role=${adminUser.adminRole})`,
      );

      // Notify client of successful connection
      client.emit('connected', {
        socketId: client.id,
        role: adminUser.adminRole,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Connection error for ${client.id}: ${error.message}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const admin = this.connectedAdmins.get(client.id);
    if (admin) {
      this.logger.log(
        `Client disconnected: ${client.id} (user=${admin.userId}, role=${admin.adminRole})`,
      );
      this.connectedAdmins.delete(client.id);
    } else {
      this.logger.log(`Client disconnected: ${client.id}`);
    }
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    const queryToken = client.handshake.query.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }
    if (Array.isArray(queryToken) && queryToken.length > 0) {
      return queryToken[0];
    }
    return null;
  }

  private async verifyToken(token: string): Promise<JwtPayload | null> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret:
          process.env.JWT_SECRET ||
          'fallback-secret-do-not-use-in-production',
      });
      return payload;
    } catch {
      return null;
    }
  }

  private subscribeToRedis() {
    const client = this.redis.getClient();
    if (!client) {
      this.logger.warn('Redis client not ready, retrying in 1s...');
      setTimeout(() => this.subscribeToRedis(), 1000);
      return;
    }

    const subscriber = client.duplicate();

    const patterns = [
      'admin_events',
      'driver_status_changed:*',
      'emergency_alerts',
      'driver_assignments',
    ];

    subscriber.psubscribe(...patterns, (err) => {
      if (err) {
        this.logger.error('Redis subscription error:', err.message);
      } else {
        this.logger.log(
          `Subscribed to Redis patterns: ${patterns.join(', ')}`,
        );
      }
    });

    subscriber.on('pmessage', (pattern, channel, message) => {
      this.logger.debug(`Redis message on ${channel} (pattern: ${pattern})`);
      try {
        const payload = JSON.parse(message);
        this.broadcastEvent(channel, payload);
      } catch {
        this.broadcastEvent(channel, { raw: message });
      }
    });
  }

  private broadcastEvent(channel: string, payload: any) {
    const eventMap: Record<string, string> = {
      admin_events: 'ADMIN_EVENT',
      emergency_alerts: 'EMERGENCY_ALERT',
      driver_assignments: 'DRIVER_ASSIGNMENT',
    };

    const event = channel.startsWith('driver_status_changed:')
      ? 'DRIVER_STATUS_UPDATE'
      : eventMap[channel] || 'UNKNOWN';

    const envelope = {
      event,
      data: payload,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to all connected admins
    this.server.to('room:all').emit('message', envelope);

    // Also send to specific role rooms based on event type
    if (event === 'DRIVER_STATUS_UPDATE') {
      this.server
        .to('room:FLEET_MANAGER')
        .to('room:OPERATIONS_MANAGER')
        .to('room:SUPER_ADMIN')
        .emit('message', envelope);
    } else if (event === 'EMERGENCY_ALERT') {
      this.server
        .to('room:OPERATIONS_MANAGER')
        .to('room:SUPER_ADMIN')
        .emit('message', envelope);
    } else if (event === 'DRIVER_ASSIGNMENT') {
      this.server
        .to('room:FLEET_MANAGER')
        .to('room:OPERATIONS_MANAGER')
        .to('room:SUPER_ADMIN')
        .emit('message', envelope);
    } else {
      this.server.to('room:all').emit('message', envelope);
    }
  }

  // Public methods for services to broadcast events to specific rooms
  broadcastToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data);
  }

  broadcastToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  broadcastToRole(role: AdminRole, event: string, data: any) {
    this.server.to(`room:${role}`).emit(event, data);
  }

  getConnectedClients(): ConnectedAdmin[] {
    return Array.from(this.connectedAdmins.values());
  }
}
