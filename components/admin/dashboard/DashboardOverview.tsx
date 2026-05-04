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

  return (
    <div>
      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
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
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(['AVAILABLE', 'BUSY', 'OFFLINE'] as const).map((status) => {
              const count = data.driver_availability?.[status] ?? 0
              const total = Object.values(data.driver_availability ?? {}).reduce((a: number, b) => a + (b as number), 0) || 1
              const pct = Math.round((count / total) * 100)
              const colors = { AVAILABLE: 'var(--success)', BUSY: 'var(--warning)', OFFLINE: 'var(--text-muted)' }
              return (
                <div key={status}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{status}</span>
                    <span style={{ fontWeight: 600, color: colors[status] }}>{count}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: colors[status], borderRadius: 3, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Pending actions */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Pending Actions</span>
            <Link href="/admin/bookings" style={{ fontSize: 12, color: 'var(--brand-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(data.pending_actions?.unassigned_bookings ?? 0) > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--warning-muted)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)' }}>
                <Clock size={16} color="var(--warning)" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{data.pending_actions.unassigned_bookings} Unassigned Bookings</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Need driver assignment</div>
                </div>
              </div>
            )}
            {(data.pending_actions?.pending_maintenance ?? 0) > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--info-muted)', borderRadius: 8, border: '1px solid rgba(6,182,212,0.2)' }}>
                <Wrench size={16} color="var(--info)" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{data.pending_actions.pending_maintenance} Upcoming Maintenance</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Within the next 7 days</div>
                </div>
              </div>
            )}
            {!data.pending_actions?.unassigned_bookings && !data.pending_actions?.pending_maintenance && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: 13 }}>✓ All caught up!</div>
            )}
          </div>
        </div>

        {/* Recent emergencies */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Emergencies</span>
            <Link href="/admin/emergency" style={{ fontSize: 12, color: 'var(--brand-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {!data.recent_emergency_alerts?.length ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No active emergencies</div>
          ) : (
            data.recent_emergency_alerts.slice(0, 4).map((alert: any) => (
              <div key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <AlertTriangle size={14} color="var(--danger)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{alert.alert_type} — {alert.user_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                  </div>
                </div>
                <StatusBadge status={alert.status} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Upcoming bookings */}
      {(data.upcoming_bookings?.length ?? 0) > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span className="card-title">Upcoming Bookings (Next 24h)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.upcoming_bookings.map((b: any) => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--brand-primary)', background: 'var(--brand-primary-muted)', padding: '2px 8px', borderRadius: 4 }}>
                  {b.booking_ref}
                </div>
                <div style={{ flex: 1, fontSize: 13 }}>{b.customer_name}</div>
                <StatusBadge status={b.booking_type} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{format(new Date(b.travel_date), 'MMM d, HH:mm')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
