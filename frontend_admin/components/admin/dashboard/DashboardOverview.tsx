'use client'

import { useQuery } from '@tanstack/react-query'
import {
  CalendarCheck, DollarSign, Car, AlertTriangle,
  Clock, Wrench, ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { MetricCard } from './MetricCard'
import { BookingTrendChart } from './BookingTrendChart'
import { StatusBadge } from '@/components/shared'
import { dashboardApi } from '@/lib/api'
import { formatDistanceToNow, format } from 'date-fns'

// ---- Mock fallback for when API isn't ready ----
const MOCK_DATA = {
  total_bookings_today: 12,
  total_revenue_today: 3480,
  active_drivers_count: 8,
  pending_actions: { unassigned_bookings: 3, pending_maintenance: 2 },
  driver_availability: { AVAILABLE: 5, BUSY: 3, OFFLINE: 4 },
  recent_emergency_alerts: [],
  upcoming_bookings: [],
  booking_trends: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
    count: Math.floor(Math.random() * 15) + 3,
  })),
}

export function DashboardOverview() {
  const { data: raw, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => dashboardApi.getOverview().then((r) => r.data),
    refetchInterval: 60_000,
    placeholderData: MOCK_DATA,
  })

  const data = raw || MOCK_DATA

  const statusConfig = {
    AVAILABLE: { color: 'var(--success)', label: 'Available' },
    BUSY: { color: 'var(--warning)', label: 'Busy' },
    OFFLINE: { color: 'var(--text-muted)', label: 'Offline' },
  }

  const totalDrivers = Object.values(data.driver_availability ?? {}).reduce((a: number, b) => a + (b as number), 0) || 1

  return (
    <div>
      {/* Metric cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <MetricCard
          title="Bookings Today"
          value={data.total_bookings_today ?? 0}
          icon={CalendarCheck}
          color="var(--brand-primary)"
          loading={isLoading}
        />
        <MetricCard
          title="Revenue Today"
          value={`$${(data.total_revenue_today ?? 0).toLocaleString()}`}
          icon={DollarSign}
          color="var(--success)"
          loading={isLoading}
        />
        <MetricCard
          title="Active Drivers"
          value={data.active_drivers_count ?? 0}
          icon={Car}
          color="var(--brand-accent)"
          loading={isLoading}
        />
        {data.recent_emergency_alerts?.length > 0 && (
          <MetricCard
            title="Open Emergencies"
            value={data.recent_emergency_alerts.length}
            icon={AlertTriangle}
            color="var(--danger)"
          />
        )}
      </div>

      {/* Main content grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {/* Booking trend */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Booking Trends (30 days)</span>
          </div>
          <BookingTrendChart data={data.booking_trends ?? []} loading={isLoading} />
        </div>

        {/* Driver availability */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Driver Status</span>
            <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {totalDrivers} total
            </span>
          </div>
          <div className="flex flex-col" style={{ gap: 'var(--space-4)' }}>
            {(['AVAILABLE', 'BUSY', 'OFFLINE'] as const).map((status) => {
              const count = data.driver_availability?.[status] ?? 0
              const pct = Math.round((count / totalDrivers) * 100)
              const config = statusConfig[status]
              return (
                <div key={status}>
                  <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-2)' }}>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {config.label}
                    </span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: config.color }}>
                      {count}
                    </span>
                  </div>
                  <div
                    className="w-full overflow-hidden"
                    style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4 }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: config.color,
                        transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Bottom grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-4)',
        }}
      >
        {/* Pending actions */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Pending Actions</span>
            <Link
              href="/admin/bookings"
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: 'var(--brand-primary)' }}
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="flex flex-col" style={{ gap: 'var(--space-3)' }}>
            {(data.pending_actions?.unassigned_bookings ?? 0) > 0 && (
              <div
                className="flex items-center gap-3 rounded-xl"
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--warning-muted)',
                  border: '1px solid rgba(245,158,11,0.2)',
                }}
              >
                <div
                  className="flex items-center justify-center rounded-lg shrink-0"
                  style={{
                    width: 40,
                    height: 40,
                    background: 'rgba(245,158,11,0.2)',
                  }}
                >
                  <Clock size={18} color="var(--warning)" />
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {data.pending_actions.unassigned_bookings} Unassigned Bookings
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                    Need driver assignment
                  </div>
                </div>
              </div>
            )}
            {(data.pending_actions?.pending_maintenance ?? 0) > 0 && (
              <div
                className="flex items-center gap-3 rounded-xl"
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--info-muted)',
                  border: '1px solid rgba(6,182,212,0.2)',
                }}
              >
                <div
                  className="flex items-center justify-center rounded-lg shrink-0"
                  style={{
                    width: 40,
                    height: 40,
                    background: 'rgba(6,182,212,0.2)',
                  }}
                >
                  <Wrench size={18} color="var(--info)" />
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {data.pending_actions.pending_maintenance} Upcoming Maintenance
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                    Within the next 7 days
                  </div>
                </div>
              </div>
            )}
            {!data.pending_actions?.unassigned_bookings && !data.pending_actions?.pending_maintenance && (
              <div
                className="flex flex-col items-center justify-center text-center"
                style={{ padding: 'var(--space-8) var(--space-4)', gap: 'var(--space-2)' }}
              >
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 48,
                    height: 48,
                    background: 'var(--success-muted)',
                  }}
                >
                  <CalendarCheck size={24} color="var(--success)" />
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  All caught up
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  No pending actions require your attention
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Recent emergencies */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Emergencies</span>
            <Link
              href="/admin/emergency"
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: 'var(--brand-primary)' }}
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {!data.recent_emergency_alerts?.length ? (
            <div
              className="flex flex-col items-center justify-center text-center"
              style={{ padding: 'var(--space-8) var(--space-4)', gap: 'var(--space-2)' }}
            >
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 48,
                  height: 48,
                  background: 'var(--success-muted)',
                }}
              >
                <AlertTriangle size={24} color="var(--success)" />
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                No active emergencies
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Everything is running smoothly
              </span>
            </div>
          ) : (
            <div className="flex flex-col">
              {data.recent_emergency_alerts.slice(0, 4).map((alert: any) => (
                <div
                  key={alert.id}
                  className="flex items-center gap-3"
                  style={{
                    padding: 'var(--space-3) 0',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    className="flex items-center justify-center rounded-lg shrink-0"
                    style={{
                      width: 36,
                      height: 36,
                      background: 'var(--danger-muted)',
                    }}
                  >
                    <AlertTriangle size={16} color="var(--danger)" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {alert.alert_type} — {alert.user_name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <StatusBadge status={alert.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming bookings */}
      {(data.upcoming_bookings?.length ?? 0) > 0 && (
        <div className="card" style={{ marginTop: 'var(--space-4)' }}>
          <div className="card-header">
            <span className="card-title">Upcoming Bookings (Next 24h)</span>
          </div>
          <div className="flex flex-col">
            {data.upcoming_bookings.map((b: any) => (
              <div
                key={b.id}
                className="flex items-center gap-3"
                style={{
                  padding: 'var(--space-3) 0',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  className="shrink-0 font-mono text-xs font-semibold rounded-lg"
                  style={{
                    color: 'var(--brand-primary)',
                    background: 'var(--brand-primary-muted)',
                    padding: '4px 10px',
                  }}
                >
                  {b.booking_ref}
                </div>
                <div className="flex-1 min-w-0 text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                  {b.customer_name}
                </div>
                <StatusBadge status={b.booking_type} />
                <div className="text-xs tabular-nums shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {format(new Date(b.travel_date), 'MMM d, HH:mm')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
