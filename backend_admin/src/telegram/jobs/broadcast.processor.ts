import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

@Processor('broadcast')
export class BroadcastProcessor extends WorkerHost {
  private readonly logger = new Logger(BroadcastProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { broadcastId, targets } = job.data;

    this.logger.log(
      `Processing broadcast ${broadcastId} with ${targets.length} targets`,
    );

    let sentCount = 0;
    let failedCount = 0;
    const rateLimitMs = 1000 / 30; // 30 msg/sec

    for (const target of targets) {
      try {
        // Simulate sending message (integrate with actual Telegram Bot API)
        await this.sendMessage(target.chatId, target.message);
        sentCount++;
      } catch (err) {
        this.logger.warn(
          `Failed to send broadcast to ${target.chatId}: ${err.message}`,
        );
        failedCount++;
      }

      // Rate limiting: 30 msg/sec
      await this.sleep(rateLimitMs);
    }

    // Update broadcast record
    await this.prisma.broadcastMessage.update({
      where: { id: broadcastId },
      data: {
        sentCount: { increment: sentCount },
        failedCount: { increment: failedCount },
        status: sentCount + failedCount >= targets.length ? 'COMPLETED' : undefined,
        completedAt: sentCount + failedCount >= targets.length ? new Date() : undefined,
      },
    });

    return { sentCount, failedCount };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `Broadcast job ${job.id} failed: ${err.message}`,
    );
  }

  private async sendMessage(chatId: string, message: string): Promise<void> {
    // Placeholder for actual Telegram Bot API integration
    this.logger.debug(`Sending message to ${chatId}: ${message}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
