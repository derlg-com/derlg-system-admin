'use client'

import { useQuery } from '@tanstack/react-query'
import { bookingsApi, analyticsApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge, PageHeader } from '@/components/shared'
import { format } from 'date-fns'
import { Bot, TrendingUp } from 'lucide-react'

export default function AIMonitoringPage() {
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['admin-ai-bookings'],
    queryFn: () => bookingsApi.list({ ai_assisted: 'true' }).then((r) => r.data),
  })

  const { data: aiStats } = useQuery({
    queryKey: ['admin-ai-stats'],
    queryFn: () => analyticsApi.getBookings({ ai_assisted: 'true' }).then((r) => r.data),
  })

  const successRate = aiStats ? ((((aiStats.confirmed || 0) + (aiStats.completed || 0)) / (aiStats.total || 1)) * 100).toFixed(1) : '—'

  return (
    <div>
      <PageHeader
        title="AI Agent Monitoring"
        subtitle="Bookings created via the AI assistant"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div className="metric-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Bot size={16} color="var(--brand-secondary)" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Bookings</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{aiStats?.total ?? bookings.length}</div>
        </div>
        <div className="metric-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <TrendingUp size={16} color="var(--success)" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Success Rate</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)' }}>{successRate}%</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable<Record<string, any>> data={bookings} loading={isLoading} rowKey="id" emptyMessage="No AI-assisted bookings"
          columns={[
            { key: 'booking_ref', label: 'Ref', render: (r) => <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--brand-primary)', background: 'var(--brand-primary-muted)', padding: '2px 8px', borderRadius: 4 }}>{r.booking_ref}</span> },
            { key: 'user', label: 'Customer', render: (r) => r.user?.name || '—' },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'booking_type', label: 'Type', render: (r) => <StatusBadge status={r.booking_type} /> },
            { key: 'total_usd', label: 'Total', render: (r) => `$${Number(r.total_usd).toFixed(2)}` },
            { key: 'session_id', label: 'AI Session', render: (r) => <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{(r.metadata as any)?.session_id?.slice(0, 12) || '—'}…</span> },
            { key: 'created_at', label: 'Created', render: (r) => format(new Date(r.created_at), 'MMM d, HH:mm') },
          ]}
        />
      </div>
    </div>
  )
}
