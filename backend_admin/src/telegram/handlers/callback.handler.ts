import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AssignmentStatus } from '@prisma/client';

@Injectable()
export class CallbackHandler {
  private readonly logger = new Logger(CallbackHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async handleCallback(telegramId: string, data: string) {
    const [action, assignmentId] = data.split(':');

    if (!action || !assignmentId) {
      return { text: 'Invalid callback data.' };
    }

    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'Driver not registered.' };
    }

    switch (action) {
      case 'accept':
        return this.handleAccept(driver.id, assignmentId);
      case 'reject':
        return this.handleReject(driver.id, assignmentId);
      case 'start':
        return this.handleStart(driver.id, assignmentId);
      case 'complete':
        return this.handleComplete(driver.id, assignmentId);
      default:
        return { text: 'Unknown action.' };
    }
  }

  private async handleAccept(driverId: string, assignmentId: string) {
    const assignment = await this.prisma.driverAssignment.update({
      where: { id: assignmentId, driverId },
      data: {
        status: AssignmentStatus.ACCEPTED,
        responseTimestamp: new Date(),
      },
    });

    await this.publishAssignmentEvent(assignment);

    return { text: 'Assignment accepted.' };
  }

  private async handleReject(driverId: string, assignmentId: string) {
    const assignment = await this.prisma.driverAssignment.update({
      where: { id: assignmentId, driverId },
      data: {
        status: AssignmentStatus.REJECTED,
        responseTimestamp: new Date(),
      },
    });

    await this.publishAssignmentEvent(assignment);

    return { text: 'Assignment rejected.' };
  }

  private async handleStart(driverId: string, assignmentId: string) {
    const assignment = await this.prisma.driverAssignment.update({
      where: { id: assignmentId, driverId },
      data: {
        status: AssignmentStatus.ACCEPTED,
        tripStartTime: new Date(),
      },
    });

    return { text: 'Trip started. Safe travels!' };
  }

  private async handleComplete(driverId: string, assignmentId: string) {
    const assignment = await this.prisma.driverAssignment.update({
      where: { id: assignmentId, driverId },
      data: {
        status: AssignmentStatus.COMPLETED,
        completionTimestamp: new Date(),
      },
    });

    return { text: 'Trip completed. Thank you!' };
  }

  private async publishAssignmentEvent(assignment: any) {
    try {
      await this.redis.getClient().publish(
        'driver_assignments',
        JSON.stringify({
          assignmentId: assignment.id,
          driverId: assignment.driverId,
          status: assignment.status,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (err) {
      this.logger.warn(`Failed to publish assignment event: ${err.message}`);
    }
  }
}
