import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { DriverStatus } from '@prisma/client';

@Injectable()
export class CommandHandler {
  private readonly logger = new Logger(CommandHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async handleCommand(telegramId: string, command: string, args?: string[]) {
    switch (command.toLowerCase()) {
      case '/start':
        return this.handleStart(telegramId);
      case '/register':
        return { text: 'Use the registration form to link your account.' };
      case '/status':
        return this.handleStatus(telegramId);
      case '/online':
        return this.handleSetStatus(telegramId, DriverStatus.AVAILABLE);
      case '/offline':
        return this.handleSetStatus(telegramId, DriverStatus.OFFLINE);
      case '/assignments':
        return this.handleAssignments(telegramId);
      case '/earnings':
        return this.handleEarnings(telegramId);
      default:
        return { text: 'Unknown command. Use /start for help.' };
    }
  }

  private async handleStart(telegramId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (driver) {
      return {
        text: `Welcome back, ${driver.driverName}! Status: ${driver.status}. Use /status, /online, /offline, /assignments.`,
      };
    }

    return {
      text: 'Welcome to DerLg Driver Bot! Use /register to link your account.',
    };
  }

  private async handleStatus(telegramId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /register first.' };
    }

    return {
      text: `Your status: ${driver.status}. Vehicle: ${driver.vehicleId || 'none'}.`,
    };
  }

  private async handleSetStatus(telegramId: string, status: DriverStatus) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /register first.' };
    }

    if (status === DriverStatus.OFFLINE) {
      const activeAssignments = await this.prisma.driverAssignment.count({
        where: {
          driverId: driver.id,
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
      });

      if (activeAssignments > 0) {
        return {
          text: 'Cannot go offline while you have active assignments.',
        };
      }
    }

    await this.prisma.driver.update({
      where: { id: driver.id },
      data: {
        status,
        lastStatusUpdate: new Date(),
        lastTelegramActivity: new Date(),
      },
    });

    await this.redis.getClient().publish(
      `driver_status_changed:${driver.id}`,
      JSON.stringify({
        driverId: driver.id,
        status,
        timestamp: new Date().toISOString(),
      }),
    );

    return { text: `Status updated to ${status}.` };
  }

  private async handleAssignments(telegramId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered.' };
    }

    const assignments = await this.prisma.driverAssignment.findMany({
      where: {
        driverId: driver.id,
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
      orderBy: { assignmentTimestamp: 'desc' },
      take: 5,
    });

    if (assignments.length === 0) {
      return { text: 'No active assignments.' };
    }

    const lines = assignments.map(
      (a) => `- ${a.id}: ${a.status} (since ${a.assignmentTimestamp.toISOString()})`,
    );

    return {
      text: `Active assignments:\n${lines.join('\n')}`,
    };
  }

  private async handleEarnings(telegramId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered.' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [todayCount, weekCount] = await Promise.all([
      this.prisma.driverAssignment.count({
        where: {
          driverId: driver.id,
          status: 'COMPLETED',
          completionTimestamp: { gte: today },
        },
      }),
      this.prisma.driverAssignment.count({
        where: {
          driverId: driver.id,
          status: 'COMPLETED',
          completionTimestamp: { gte: weekAgo },
        },
      }),
    ]);

    return {
      text: `Today's trips: ${todayCount}\nThis week's trips: ${weekCount}`,
    };
  }
}
