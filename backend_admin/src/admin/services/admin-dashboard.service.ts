import { Injectable } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardOverview(role?: AdminRole) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const twentyFourHoursLater = new Date();
    twentyFourHoursLater.setHours(twentyFourHoursLater.getHours() + 24);

    const [
      totalBookingsToday,
      totalRevenueToday,
      activeDrivers,
      bookingTrendsRaw,
      unassignedBookings,
      upcomingMaintenance,
      recentEmergencies,
      driverSummary,
      upcomingBookings,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: { createdAt: { gte: today, lt: tomorrow } },
      }),
      this.prisma.booking.aggregate({
        where: { createdAt: { gte: today, lt: tomorrow } },
        _sum: { totalUsd: true },
      }),
      this.prisma.driver.count({
        where: { status: { in: ['AVAILABLE', 'BUSY'] } },
      }),
      this.prisma.$queryRaw<
        { date: Date; count: bigint }[]
      >`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM bookings
        WHERE created_at >= ${thirtyDaysAgo}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
      this.getUnassignedBookingsCount(),
      this.prisma.vehicleMaintenance.count({
        where: {
          scheduledDate: { gte: today, lte: nextWeek },
          status: 'SCHEDULED',
        },
      }),
      this.prisma.emergencyAlert.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          users: { select: { email: true, full_name: true } },
        },
      }),
      this.prisma.driver.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.booking.findMany({
        where: {
          start_date: { gte: new Date(), lte: twentyFourHoursLater },
          status: { not: 'cancelled' },
        },
        include: {
          users: { select: { email: true, full_name: true } },
        },
        orderBy: { start_date: 'asc' },
        take: 10,
      }),
    ]);

    const bookingTrends = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const row = bookingTrendsRaw.find(
        (r) => r.date.toISOString().split('T')[0] === dateStr,
      );
      return { date: dateStr, count: Number(row?.count || 0) };
    });

    const driverAvailabilitySummary = {
      AVAILABLE: 0,
      BUSY: 0,
      OFFLINE: 0,
    };
    for (const s of driverSummary) {
      driverAvailabilitySummary[s.status] = s._count._all;
    }

    const overview = {
      total_bookings_today: totalBookingsToday,
      total_revenue_today: Number(totalRevenueToday._sum.totalUsd || 0),
      active_drivers_count: activeDrivers,
      booking_trends: bookingTrends,
      pending_actions: {
        unassigned_bookings: unassignedBookings,
        upcoming_maintenance: upcomingMaintenance,
      },
      recent_emergencies: recentEmergencies.map((e) => ({
        id: e.id,
        alert_type: e.alertType,
        status: e.status,
        latitude: Number(e.latitude),
        longitude: Number(e.longitude),
        user: e.users,
        created_at: e.createdAt,
      })),
      driver_summary: driverAvailabilitySummary,
      upcoming_bookings: upcomingBookings.map((b) => ({
        id: b.id,
        reference: b.reference,
        start_date: b.start_date,
        end_date: b.end_date,
        status: b.status,
        total_usd: Number(b.totalUsd),
        user: b.users,
        passenger_count: b.passenger_count,
      })),
    };

    return this.filterByRole(overview, role);
  }

  private async getUnassignedBookingsCount(): Promise<number> {
    const assigned = await this.prisma.driverAssignment.findMany({
      where: { status: { in: ['PENDING', 'ACCEPTED'] } },
      select: { bookingId: true },
    });
    const assignedIds = assigned.map((a) => a.bookingId);

    if (assignedIds.length === 0) {
      return this.prisma.booking.count({
        where: { status: { not: 'cancelled' } },
      });
    }

    return this.prisma.booking.count({
      where: {
        id: { notIn: assignedIds },
        status: { not: 'cancelled' },
      },
    });
  }

  private filterByRole(overview: any, role?: AdminRole) {
    if (!role || role === AdminRole.SUPER_ADMIN) {
      return overview;
    }

    if (role === AdminRole.FLEET_MANAGER) {
      return {
        active_drivers_count: overview.active_drivers_count,
        driver_summary: overview.driver_summary,
        pending_actions: {
          upcoming_maintenance: overview.pending_actions.upcoming_maintenance,
        },
        recent_emergencies: overview.recent_emergencies,
      };
    }

    if (role === AdminRole.SUPPORT_AGENT) {
      return {
        total_bookings_today: overview.total_bookings_today,
        total_revenue_today: overview.total_revenue_today,
        booking_trends: overview.booking_trends,
        pending_actions: {
          unassigned_bookings: overview.pending_actions.unassigned_bookings,
        },
        upcoming_bookings: overview.upcoming_bookings,
      };
    }

    // OPERATIONS_MANAGER gets everything
    return overview;
  }
}
