import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class AdminAIMonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private readonly SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

  private getDefaultDateRange(filters?: { startDate?: string; endDate?: string }) {
    const endDate = filters?.endDate ? new Date(filters.endDate) : new Date();
    const startDate = filters?.startDate
      ? new Date(filters.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { startDate, endDate };
  }

  private async getAISessionsInRange(startDate: Date, endDate: Date) {
    return this.prisma.ai_chat_sessions.findMany({
      where: { created_at: { gte: startDate, lte: endDate } },
      select: { user_id: true, created_at: true, id: true },
    });
  }

  private async getBookingsInRange(startDate: Date, endDate: Date) {
    return this.prisma.booking.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        totalUsd: true,
        status: true,
        reference: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private buildUserSessionMap(
    sessions: { user_id: string; created_at: Date }[],
  ) {
    const map = new Map<string, Date[]>();
    for (const session of sessions) {
      if (!map.has(session.user_id)) {
        map.set(session.user_id, []);
      }
      map.get(session.user_id)!.push(session.created_at);
    }
    return map;
  }

  private isAIAssisted(
    booking: { userId: string; createdAt: Date },
    userSessionMap: Map<string, Date[]>,
  ) {
    const sessions = userSessionMap.get(booking.userId);
    if (!sessions) return false;
    return sessions.some((s) => {
      const diff = booking.createdAt.getTime() - s.getTime();
      return diff >= 0 && diff <= 24 * 60 * 60 * 1000;
    });
  }

  async getAIAssistedBookings(filters?: { startDate?: string; endDate?: string }) {
    const { startDate, endDate } = this.getDefaultDateRange(filters);

    const [aiSessions, bookings] = await Promise.all([
      this.getAISessionsInRange(startDate, endDate),
      this.getBookingsInRange(startDate, endDate),
    ]);

    const userSessionMap = this.buildUserSessionMap(aiSessions);
    const aiAssisted = bookings.filter((b) =>
      this.isAIAssisted(b, userSessionMap),
    );

    return {
      total_bookings: bookings.length,
      ai_assisted_bookings: aiAssisted.length,
      ai_assisted_revenue_usd: Number(
        aiAssisted.reduce((sum, b) => sum + Number(b.totalUsd), 0),
      ),
      bookings: aiAssisted.map((b) => ({
        id: b.id,
        reference: b.reference,
        user_id: b.userId,
        status: b.status,
        total_usd: Number(b.totalUsd),
        created_at: b.createdAt,
      })),
      period: {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      },
    };
  }

  async getAISessionDetails(sessionId: string) {
    // Try Redis first (7-day TTL)
    const redisKey = `ai:session:${sessionId}`;
    const cached = await this.redis.getClient().get(redisKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Check if session exists in DB
    const session = await this.prisma.ai_chat_sessions.findUnique({
      where: { id: sessionId },
      include: {
        ai_chat_messages: {
          orderBy: { created_at: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            message_type: true,
            metadata: true,
            created_at: true,
          },
        },
        users: {
          select: { id: true, email: true, full_name: true },
        },
      },
    });

    if (!session) {
      return null;
    }

    // Session exists in DB but Redis TTL expired
    return { expired: true, session_id: sessionId };
  }

  async getAIBookingSuccessRate(filters?: { startDate?: string; endDate?: string }) {
    const { startDate, endDate } = this.getDefaultDateRange(filters);

    const [aiSessions, bookings] = await Promise.all([
      this.getAISessionsInRange(startDate, endDate),
      this.getBookingsInRange(startDate, endDate),
    ]);

    const userSessionMap = this.buildUserSessionMap(aiSessions);
    const aiAssisted = bookings.filter((b) =>
      this.isAIAssisted(b, userSessionMap),
    );

    const total = aiAssisted.length;
    const successful = aiAssisted.filter((b) =>
      ['confirmed', 'completed'].includes(b.status),
    ).length;

    return {
      total_ai_assisted_bookings: total,
      successful_bookings: successful,
      success_rate_percent:
        total > 0 ? Math.round((successful / total) * 10000) / 100 : 0,
      by_status: {
        reserved: aiAssisted.filter((b) => b.status === 'reserved').length,
        confirmed: aiAssisted.filter((b) => b.status === 'confirmed').length,
        completed: aiAssisted.filter((b) => b.status === 'completed').length,
        cancelled: aiAssisted.filter((b) => b.status === 'cancelled').length,
        payment_failed: aiAssisted.filter((b) => b.status === 'payment_failed').length,
        expired: aiAssisted.filter((b) => b.status === 'expired').length,
        no_show: aiAssisted.filter((b) => b.status === 'no_show').length,
      },
      period: {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      },
    };
  }

  async getAIPerformanceMetrics(filters?: { startDate?: string; endDate?: string }) {
    const { startDate, endDate } = this.getDefaultDateRange(filters);

    const totalSessions = await this.prisma.ai_chat_sessions.count({
      where: { created_at: { gte: startDate, lte: endDate } },
    });

    const avgMessagesPerSession = await this.prisma.$queryRaw<
      { avg_messages: number }[]
    >`
      SELECT AVG(msg_count)::float as avg_messages
      FROM (
        SELECT session_id, COUNT(*) as msg_count
        FROM ai_chat_messages
        WHERE created_at >= ${startDate} AND created_at <= ${endDate}
        GROUP BY session_id
      ) sub
    `;

    const [aiSessions, bookings] = await Promise.all([
      this.getAISessionsInRange(startDate, endDate),
      this.getBookingsInRange(startDate, endDate),
    ]);

    const userSessionMap = this.buildUserSessionMap(aiSessions);

    // Calculate average time from first AI session to booking creation
    let totalBookingTime = 0;
    let bookingsWithTime = 0;

    for (const booking of bookings) {
      if (this.isAIAssisted(booking, userSessionMap)) {
        const sessions = userSessionMap.get(booking.userId);
        if (sessions) {
          const firstSession = sessions
            .filter((s) => booking.createdAt.getTime() - s.getTime() >= 0)
            .sort((a, b) => a.getTime() - b.getTime())[0];
          if (firstSession) {
            totalBookingTime += booking.createdAt.getTime() - firstSession.getTime();
            bookingsWithTime++;
          }
        }
      }
    }

    const avgBookingTimeMinutes =
      bookingsWithTime > 0
        ? Math.round((totalBookingTime / bookingsWithTime / 1000 / 60) * 100) / 100
        : 0;

    // Conversion rate: AI-assisted bookings vs total bookings
    const aiAssistedCount = bookings.filter((b) =>
      this.isAIAssisted(b, userSessionMap),
    ).length;

    const conversionRate =
      bookings.length > 0
        ? Math.round((aiAssistedCount / bookings.length) * 10000) / 100
        : 0;

    return {
      total_sessions: totalSessions,
      avg_messages_per_session:
        Math.round(
          (Number(avgMessagesPerSession[0]?.avg_messages) || 0) * 100,
        ) / 100,
      avg_booking_time_minutes: avgBookingTimeMinutes,
      conversion_rate_percent: conversionRate,
      bookings_converted: aiAssistedCount,
      period: {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      },
    };
  }
}
