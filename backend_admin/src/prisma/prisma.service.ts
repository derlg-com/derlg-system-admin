import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Use DIRECT_URL (port 5432) for raw pg driver — pooler (port 6543) only works with Prisma's built-in manager
    const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL || '' });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma connected to PostgreSQL (Supabase) successfully');
    } catch (error) {
      this.logger.error('Prisma connection failed:', error.message);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }

  async healthCheck(): Promise<{ status: string; result?: any; error?: string }> {
    try {
      const result = await this.$queryRaw`SELECT version()`;
      return { status: 'ok', result };
    } catch (error) {
      this.logger.error('Database health check failed:', error.message);
      return { status: 'error', error: error.message };
    }
  }
}
