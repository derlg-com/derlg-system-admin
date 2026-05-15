import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRevenueAnalytics(filters: { startDate?: string; endDate?: string }) {
    const where: any = {};
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    const byType = await this.prisma.booking_items.groupBy({
      by: ['booking_type'],
      where,
      _sum: { subtotal_usd: true },
      _count: { _all: true },
    });

    const total = await this.prisma.booking_items.aggregate({
      where,
      _sum: { subtotal_usd: true },
      _count: { _all: true },
    });

    return {
      by_type: byType.map((item) => ({
        booking_type: item.booking_type,
        revenue_usd: Number(item._sum.subtotal_usd || 0),
        count: item._count._all,
      })),
      total_revenue_usd: Number(total._sum.subtotal_usd || 0),
      total_bookings: total._count._all,
      period: {
        start_date: filters.startDate || null,
        end_date: filters.endDate || null,
      },
    };
  }

  async getBookingStatistics() {
    const byStatus = await this.prisma.booking.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const total = await this.prisma.booking.count();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [bookingsToday, bookingsThisWeek, bookingsThisMonth] =
      await Promise.all([
        this.prisma.booking.count({ where: { createdAt: { gte: today } } }),
        this.prisma.booking.count({
          where: { createdAt: { gte: weekAgo } },
        }),
        this.prisma.booking.count({
          where: { createdAt: { gte: monthAgo } },
        }),
      ]);

    return {
      by_status: byStatus.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
      total,
      today: bookingsToday,
      this_week: bookingsThisWeek,
      this_month: bookingsThisMonth,
    };
  }

  async getDriverPerformance() {
    const drivers = await this.prisma.driver.findMany({
      select: {
        id: true,
        driverName: true,
        driverId: true,
        status: true,
        _count: {
          select: { assignments: true },
        },
      },
    });

    const completedAssignments = await this.prisma.driverAssignment.groupBy({
      by: ['driverId'],
      where: { status: 'COMPLETED' },
      _count: { _all: true },
    });

    const completionMap = new Map(
      completedAssignments.map((a) => [a.driverId, a._count._all]),
    );

    return drivers.map((d) => ({
      driver_id: d.id,
      driver_name: d.driverName,
      driver_code: d.driverId,
      status: d.status,
      total_assignments: d._count.assignments,
      completed_trips: completionMap.get(d.id) || 0,
    }));
  }

  async getPopularDestinations() {
    const tripBookings = await this.prisma.booking_items.groupBy({
      by: ['trip_id'],
      where: { booking_type: 'trip_package', trip_id: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { trip_id: 'desc' } },
      take: 10,
    });

    const tripIds = tripBookings
      .map((t) => t.trip_id)
      .filter((id): id is string => id !== null);

    const trips = await this.prisma.trips.findMany({
      where: { id: { in: tripIds } },
      include: {
        trip_translations: { where: { language: 'en' } },
      },
    });

    const tripMap = new Map(trips.map((t) => [t.id, t]));

    return tripBookings.map((tb) => {
      const trip = tb.trip_id ? tripMap.get(tb.trip_id) : undefined;
      return {
        trip_id: tb.trip_id,
        title: trip?.trip_translations[0]?.title || 'Unknown',
        booking_count: tb._count._all,
      };
    });
  }

  async getHotelOccupancy() {
    const totalRooms = await this.prisma.hotel_rooms.count();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const occupied = await this.prisma.booking_items.count({
      where: {
        booking_type: 'hotel_room',
        date: { gte: thirtyDaysAgo, lte: today },
      },
    });

    const occupancyRate =
      totalRooms > 0 ? (occupied / (totalRooms * 30)) * 100 : 0;

    return {
      total_rooms: totalRooms,
      occupied_room_nights_30d: occupied,
      occupancy_rate_percent: Math.round(occupancyRate * 100) / 100,
      period_days: 30,
    };
  }

  async getGuideUtilization() {
    const totalGuides = await this.prisma.guides.count();

    const guidesWithBookings = await this.prisma.booking_items.groupBy({
      by: ['guide_id'],
      where: { guide_id: { not: null } },
      _count: { _all: true },
    });

    const utilizationRate =
      totalGuides > 0 ? (guidesWithBookings.length / totalGuides) * 100 : 0;

    return {
      total_guides: totalGuides,
      active_guides: guidesWithBookings.length,
      utilization_rate_percent: Math.round(utilizationRate * 100) / 100,
    };
  }

  async getAIAssistedBookings() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [aiSessions, bookings] = await Promise.all([
      this.prisma.ai_chat_sessions.findMany({
        where: { created_at: { gte: thirtyDaysAgo } },
        select: { user_id: true, created_at: true },
      }),
      this.prisma.booking.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { id: true, userId: true, createdAt: true, totalUsd: true },
      }),
    ]);

    const userSessionMap = new Map<string, Date[]>();
    for (const session of aiSessions) {
      if (!userSessionMap.has(session.user_id)) {
        userSessionMap.set(session.user_id, []);
      }
      userSessionMap.get(session.user_id)!.push(session.created_at);
    }

    const aiAssisted = bookings.filter((b) => {
      const sessions = userSessionMap.get(b.userId);
      if (!sessions) return false;
      return sessions.some((s) => {
        const diff = b.createdAt.getTime() - s.getTime();
        return diff >= 0 && diff <= 24 * 60 * 60 * 1000;
      });
    });

    return {
      total_bookings_30d: bookings.length,
      ai_assisted_bookings: aiAssisted.length,
      ai_assisted_revenue_usd: Number(
        aiAssisted.reduce((sum, b) => sum + Number(b.totalUsd), 0),
      ),
      conversion_rate_percent:
        bookings.length > 0
          ? Math.round((aiAssisted.length / bookings.length) * 10000) / 100
          : 0,
    };
  }

  async getAIPerformanceMetrics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const totalSessions = await this.prisma.ai_chat_sessions.count({
      where: { created_at: { gte: thirtyDaysAgo } },
    });

    const avgMessagesPerSession = await this.prisma.$queryRaw<
      { avg_messages: number }[]
    >`
      SELECT AVG(msg_count)::float as avg_messages
      FROM (
        SELECT session_id, COUNT(*) as msg_count
        FROM ai_chat_messages
        WHERE created_at >= ${thirtyDaysAgo}
        GROUP BY session_id
      ) sub
    `;

    const aiAssisted = await this.getAIAssistedBookings();

    return {
      total_sessions_30d: totalSessions,
      avg_messages_per_session:
        Math.round(
          (Number(avgMessagesPerSession[0]?.avg_messages) || 0) * 100,
        ) / 100,
      bookings_converted: aiAssisted.ai_assisted_bookings,
      conversion_rate_percent: aiAssisted.conversion_rate_percent,
    };
  }

  async exportData(params: {
    format: string;
    metric?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { format, metric, startDate, endDate } = params;

    let data: any[] = [];

    switch (metric) {
      case 'revenue':
        data = (await this.getRevenueAnalytics({ startDate, endDate })).by_type;
        break;
      case 'bookings':
        data = (await this.getBookingStatistics()).by_status;
        break;
      case 'drivers':
        data = await this.getDriverPerformance();
        break;
      case 'destinations':
        data = await this.getPopularDestinations();
        break;
      case 'hotels':
        data = [await this.getHotelOccupancy()];
        break;
      case 'guides':
        data = [await this.getGuideUtilization()];
        break;
      case 'ai':
        data = [await this.getAIPerformanceMetrics()];
        break;
      default:
        data = [
          {
            metric: 'revenue',
            data: (await this.getRevenueAnalytics({ startDate, endDate }))
              .by_type,
          },
          {
            metric: 'bookings',
            data: (await this.getBookingStatistics()).by_status,
          },
        ];
    }

    if (format === 'csv') {
      return { format: 'csv', content: this.toCsv(data) };
    }

    return { format: 'json', content: JSON.stringify(data, null, 2) };
  }

  private toCsv(data: any[]): string {
    if (!data.length) return '';
    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          if (typeof val === 'object') return JSON.stringify(val);
          return String(val);
        })
        .join(','),
    );
    return [headers.join(','), ...rows].join('\n');
  }

  async createAuditLog(params: {
    userId?: string;
    eventType: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          user_id: params.userId || null,
          event_type: params.eventType as any,
          entity_type: params.entityType,
          entity_id: params.entityId || null,
          metadata: params.metadata || {},
        },
      });
    } catch {
      // Silently fail audit logging
    }
  }
}
