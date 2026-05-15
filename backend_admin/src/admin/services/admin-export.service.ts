import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminExportService {
  private readonly logger = new Logger(AdminExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get encryptionKey(): Buffer {
    const key = this.config.get<string>('EXPORT_ENCRYPTION_KEY');
    if (!key) {
      throw new Error('EXPORT_ENCRYPTION_KEY is not configured');
    }
    return scryptSync(key, 'salt', 32);
  }

  async exportBookings(params: {
    startDate?: string;
    endDate?: string;
    format?: string;
  }) {
    const where: any = {};
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(params.startDate);
      if (params.endDate) where.createdAt.lte = new Date(params.endDate);
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        users: { select: { email: true, full_name: true } },
        payments: { select: { amount_usd: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const mapped = bookings.map((b) => ({
      id: b.id,
      reference: b.reference,
      customer_email: b.users?.email || '',
      customer_name: b.users?.full_name || '',
      start_date: b.start_date?.toISOString() || '',
      end_date: b.end_date?.toISOString() || '',
      status: b.status,
      total_usd: Number(b.totalUsd),
      payment_status: b.payments[0]?.status || '',
      passenger_count: b.passenger_count,
      created_at: b.createdAt.toISOString(),
    }));

    if (params.format === 'json') {
      return { format: 'json', content: JSON.stringify(mapped, null, 2) };
    }

    return { format: 'csv', content: this.toCsv(mapped) };
  }

  async exportDrivers() {
    const drivers = await this.prisma.driver.findMany({
      include: {
        assignments: {
          where: { status: 'COMPLETED' },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mapped = drivers.map((d) => ({
      id: d.id,
      driver_id: d.driverId,
      driver_name: d.driverName,
      phone: d.phone,
      status: d.status,
      telegram_id: d.telegramId ? String(d.telegramId) : '',
      total_assignments: d.assignments.length,
      created_at: d.createdAt.toISOString(),
    }));

    return { format: 'csv', content: this.toCsv(mapped) };
  }

  async exportPayments() {
    const payments = await this.prisma.payments.findMany({
      include: {
        users: { select: { email: true, full_name: true } },
        bookings: { select: { reference: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 5000,
    });

    const mapped = payments.map((p) => ({
      id: p.id,
      booking_reference: p.bookings?.reference || '',
      customer_email: p.users?.email || '',
      provider: p.provider,
      amount_usd: Number(p.amount_usd),
      currency: p.currency,
      status: p.status,
      paid_at: p.paid_at?.toISOString() || '',
      created_at: p.created_at.toISOString(),
    }));

    const csv = this.toCsv(mapped);
    const encrypted = this.encrypt(csv);

    return {
      format: 'csv.encrypted',
      content: encrypted.encryptedData,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
    };
  }

  async triggerBackup(userId: string) {
    const backupId = crypto.randomUUID();
    const backupUrl = `https://storage.supabase.co/backups/${backupId}.sql`;

    const backup = await this.prisma.backup.create({
      data: {
        backupFileUrl: backupUrl,
        backupSizeBytes: BigInt(0),
        createdByAdminId: userId,
      },
    });

    return {
      id: backup.id,
      backup_file_url: backup.backupFileUrl,
      created_by_admin_id: backup.createdByAdminId,
      created_at: backup.createdAt,
    };
  }

  async getBackups() {
    return this.prisma.backup.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  private toCsv(data: any[]): string {
    if (!data.length) return '';
    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          if (typeof val === 'string' && val.includes(','))
            return `"${val.replace(/"/g, '""')}"`;
          return String(val);
        })
        .join(','),
    );
    return [headers.join(','), ...rows].join('\n');
  }

  private encrypt(plaintext: string): {
    encryptedData: string;
    iv: string;
    authTag: string;
  } {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  decrypt(encryptedData: string, iv: string, authTag: string): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
