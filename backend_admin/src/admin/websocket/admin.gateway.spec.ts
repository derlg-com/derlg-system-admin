import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AdminGateway } from './admin.gateway';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminRole } from '@prisma/client';

describe('AdminGateway', () => {
  let gateway: AdminGateway;
  let jwtService: JwtService;
  let prisma: PrismaService;

  const mockTo = jest.fn().mockReturnThis();
  const mockEmit = jest.fn().mockReturnThis();
  const mockJoin = jest.fn();
  const mockDisconnect = jest.fn();
  const mockServer = {
    to: mockTo,
    emit: mockEmit,
  };

  const mockRedisSubscriber = {
    psubscribe: jest.fn(),
    on: jest.fn(),
    quit: jest.fn(),
  };

  const mockRedisClient = {
    duplicate: jest.fn().mockReturnValue(mockRedisSubscriber),
    ping: jest.fn().mockResolvedValue('PONG'),
    publish: jest.fn().mockResolvedValue(1),
    subscribe: jest.fn(),
    psubscribe: jest.fn(),
  };

  const mockRedis = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
    ping: jest.fn().mockResolvedValue('PONG'),
    healthCheck: jest.fn().mockResolvedValue({ status: 'ok', response: 'PONG' }),
    publish: jest.fn().mockResolvedValue(1),
    subscribe: jest.fn(),
    psubscribe: jest.fn(),
  };

  const mockPrisma = {
    adminUser: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminGateway,
        { provide: RedisService, useValue: mockRedis },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    gateway = module.get<AdminGateway>(AdminGateway);
    jwtService = module.get<JwtService>(JwtService);
    prisma = module.get<PrismaService>(PrismaService);

    // Mock the server
    (gateway as any).server = mockServer;
  });

  describe('afterInit', () => {
    it('should subscribe to Redis channels', () => {
      gateway.afterInit();

      expect(mockRedisClient.duplicate).toHaveBeenCalled();
      expect(mockRedisSubscriber.psubscribe).toHaveBeenCalledWith(
        'admin_events',
        'driver_status_changed:*',
        'emergency_alerts',
        'driver_assignments',
        expect.any(Function),
      );
    });
  });

  describe('handleConnection', () => {
    const createMockSocket = (overrides?: any) => ({
      id: 'socket-1',
      handshake: {
        headers: { authorization: 'Bearer valid-token' },
        query: {},
      },
      join: mockJoin,
      disconnect: mockDisconnect,
      emit: jest.fn(),
      ...overrides,
    });

    it('should accept connection with valid token and join role room', async () => {
      const client = createMockSocket();

      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
        sub: 'user-1',
        email: 'admin@example.com',
        role: 'admin',
      } as any);

      mockPrisma.adminUser.findUnique.mockResolvedValue({
        adminRole: AdminRole.OPERATIONS_MANAGER,
        isActive: true,
      });

      await gateway.handleConnection(client as any);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token', {
        secret: expect.any(String),
      });
      expect(mockPrisma.adminUser.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { adminRole: true, isActive: true },
      });
      expect(mockJoin).toHaveBeenCalledWith('room:OPERATIONS_MANAGER');
      expect(mockJoin).toHaveBeenCalledWith('room:all');
      expect(client.emit).toHaveBeenCalledWith(
        'connected',
        expect.objectContaining({
          socketId: 'socket-1',
          role: 'OPERATIONS_MANAGER',
        }),
      );
    });

    it('should accept connection with token in query', async () => {
      const client = createMockSocket({
        handshake: {
          headers: {},
          query: { token: 'query-token' },
        },
      });

      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
        sub: 'user-2',
        email: 'admin2@example.com',
        role: 'admin',
      } as any);

      mockPrisma.adminUser.findUnique.mockResolvedValue({
        adminRole: AdminRole.SUPER_ADMIN,
        isActive: true,
      });

      await gateway.handleConnection(client as any);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('query-token', {
        secret: expect.any(String),
      });
      expect(mockJoin).toHaveBeenCalledWith('room:SUPER_ADMIN');
    });

    it('should reject connection without token', async () => {
      const client = createMockSocket({
        handshake: { headers: {}, query: {} },
      });

      await gateway.handleConnection(client as any);

      expect(mockDisconnect).toHaveBeenCalledWith(true);
      expect(mockJoin).not.toHaveBeenCalled();
    });

    it('should reject connection with invalid token', async () => {
      const client = createMockSocket();

      jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(
        new Error('invalid token'),
      );

      await gateway.handleConnection(client as any);

      expect(mockDisconnect).toHaveBeenCalledWith(true);
      expect(mockJoin).not.toHaveBeenCalled();
    });

    it('should reject inactive admin user', async () => {
      const client = createMockSocket();

      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
        sub: 'user-1',
        email: 'admin@example.com',
        role: 'admin',
      } as any);

      mockPrisma.adminUser.findUnique.mockResolvedValue({
        adminRole: AdminRole.OPERATIONS_MANAGER,
        isActive: false,
      });

      await gateway.handleConnection(client as any);

      expect(mockDisconnect).toHaveBeenCalledWith(true);
      expect(mockJoin).not.toHaveBeenCalled();
    });

    it('should reject non-admin user', async () => {
      const client = createMockSocket();

      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
        sub: 'user-1',
        email: 'user@example.com',
        role: 'user',
      } as any);

      mockPrisma.adminUser.findUnique.mockResolvedValue(null);

      await gateway.handleConnection(client as any);

      expect(mockDisconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleDisconnect', () => {
    it('should remove connected admin on disconnect', async () => {
      const client = {
        id: 'socket-1',
        handshake: {
          headers: { authorization: 'Bearer token' },
          query: {},
        },
        join: mockJoin,
        disconnect: mockDisconnect,
        emit: jest.fn(),
      };

      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
        sub: 'user-1',
        email: 'admin@example.com',
        role: 'admin',
      } as any);

      mockPrisma.adminUser.findUnique.mockResolvedValue({
        adminRole: AdminRole.SUPER_ADMIN,
        isActive: true,
      });

      await gateway.handleConnection(client as any);
      expect(gateway.getConnectedClients()).toHaveLength(1);

      gateway.handleDisconnect(client as any);
      expect(gateway.getConnectedClients()).toHaveLength(0);
    });
  });

  describe('broadcastEvent', () => {
    it('should broadcast driver status updates to relevant rooms', () => {
      (gateway as any).broadcastEvent('driver_status_changed:drv-1', {
        driverId: 'drv-1',
        status: 'AVAILABLE',
      });

      expect(mockTo).toHaveBeenCalledWith('room:all');
      expect(mockTo).toHaveBeenCalledWith('room:FLEET_MANAGER');
      expect(mockTo).toHaveBeenCalledWith('room:OPERATIONS_MANAGER');
      expect(mockTo).toHaveBeenCalledWith('room:SUPER_ADMIN');
      expect(mockEmit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          event: 'DRIVER_STATUS_UPDATE',
          data: { driverId: 'drv-1', status: 'AVAILABLE' },
        }),
      );
    });

    it('should broadcast emergency alerts to relevant rooms', () => {
      (gateway as any).broadcastEvent('emergency_alerts', {
        alertId: 'alert-1',
        severity: 'high',
      });

      expect(mockTo).toHaveBeenCalledWith('room:all');
      expect(mockTo).toHaveBeenCalledWith('room:OPERATIONS_MANAGER');
      expect(mockTo).toHaveBeenCalledWith('room:SUPER_ADMIN');
      expect(mockEmit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          event: 'EMERGENCY_ALERT',
          data: { alertId: 'alert-1', severity: 'high' },
        }),
      );
    });

    it('should broadcast admin events to all rooms', () => {
      (gateway as any).broadcastEvent('admin_events', {
        type: 'BROADCAST_SENT',
      });

      expect(mockTo).toHaveBeenCalledWith('room:all');
      expect(mockEmit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          event: 'ADMIN_EVENT',
          data: { type: 'BROADCAST_SENT' },
        }),
      );
    });

    it('should handle non-JSON messages gracefully', () => {
      (gateway as any).broadcastEvent('driver_assignments', { raw: 'not-json' });

      expect(mockEmit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          event: 'DRIVER_ASSIGNMENT',
          data: { raw: 'not-json' },
        }),
      );
    });
  });

  describe('public broadcast methods', () => {
    it('should broadcast to specific room', () => {
      gateway.broadcastToRoom('room:test', 'custom-event', { foo: 'bar' });

      expect(mockTo).toHaveBeenCalledWith('room:test');
      expect(mockEmit).toHaveBeenCalledWith('custom-event', { foo: 'bar' });
    });

    it('should broadcast to all clients', () => {
      gateway.broadcastToAll('global-event', { data: true });

      expect(mockEmit).toHaveBeenCalledWith('global-event', { data: true });
    });

    it('should broadcast to specific role', () => {
      gateway.broadcastToRole(AdminRole.SUPER_ADMIN, 'role-event', {
        secret: true,
      });

      expect(mockTo).toHaveBeenCalledWith('room:SUPER_ADMIN');
      expect(mockEmit).toHaveBeenCalledWith('role-event', { secret: true });
    });
  });
});
