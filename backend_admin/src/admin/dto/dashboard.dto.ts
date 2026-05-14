export class BookingTrendDto {
  date: string;
  count: number;
}

export class PendingActionDto {
  unassigned_bookings: number;
  upcoming_maintenance: number;
}

export class DashboardOverviewDto {
  total_bookings_today: number;
  total_revenue_today: number;
  active_drivers_count: number;
  booking_trends: BookingTrendDto[];
  pending_actions: PendingActionDto;
  recent_emergencies: any[];
  driver_summary: Record<string, number>;
  upcoming_bookings: any[];
}
