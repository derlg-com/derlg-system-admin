'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/lib/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Download } from 'lucide-react'

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b']

export function AnalyticsDashboard() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  const { data: revenue, isLoading: revLoading } = useQuery({
    queryKey: ['analytics-revenue', startDate, endDate],
    queryFn: () => analyticsApi.getRevenue({ start_date: startDate, end_date: endDate }).then((r) => r.data),
  })

  const { data: bookingStats, isLoading: statLoading } = useQuery({
    queryKey: ['analytics-bookings', startDate, endDate],
    queryFn: () => analyticsApi.getBookings({ start_date: startDate, end_date: endDate }).then((r) => r.data),
  })

  const { data: driverStats } = useQuery({
    queryKey: ['analytics-drivers'],
    queryFn: () => analyticsApi.getDrivers().then((r) => r.data),
  })

  const handleExport = async () => {
    try {
      const res = await analyticsApi.export({ start_date: startDate, end_date: endDate, format: 'csv' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = `analytics-${startDate}-${endDate}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch { /* ignore */ }
  }

  // Mock fallback data
  const revenueData = revenue?.by_type || [
    { type: 'PACKAGE', total: 12400 }, { type: 'HOTEL_ONLY', total: 4800 },
    { type: 'TRANSPORT_ONLY', total: 2200 }, { type: 'GUIDE_ONLY', total: 1100 },
  ]
  const statsData = bookingStats || { total: 147, confirmed: 89, completed: 31, cancelled: 18, refunded: 9 }
  const driversData = driverStats || []

  const statusPieData = [
    { name: 'Confirmed', value: statsData.confirmed || 0 },
    { name: 'Completed', value: statsData.completed || 0 },
    { name: 'Cancelled', value: statsData.cancelled || 0 },
    { name: 'Refunded', value: statsData.refunded || 0 },
  ]

  return (
    <div>
      {/* Date range + export */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="form-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: 'auto' }} />
          <span style={{ color: 'var(--text-muted)' }}>—</span>
          <input className="form-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: 'auto' }} />
        </div>
        <button className="btn btn-secondary" onClick={handleExport}><Download size={14} /> Export CSV</button>
      </div>

      {/* Summary metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Bookings', value: statsData.total, color: 'var(--brand-primary)' },
          { label: 'Confirmed', value: statsData.confirmed, color: 'var(--success)' },
          { label: 'Completed', value: statsData.completed, color: 'var(--brand-accent)' },
          { label: 'Cancelled', value: statsData.cancelled, color: 'var(--danger)' },
          { label: 'Cancel Rate', value: statsData.total ? `${((statsData.cancelled / statsData.total) * 100).toFixed(1)}%` : '—', color: 'var(--warning)' },
        ].map((m) => (
          <div key={m.label} className="metric-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{m.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, marginBottom: 16 }}>
        {/* Revenue by type */}
        <div className="card">
          <div className="card-header"><span className="card-title">Revenue by Booking Type</span></div>
          {revLoading ? <div className="skeleton" style={{ height: 220 }} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueData} margin={{ left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="type" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Revenue']} contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="total" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Booking status pie */}
        <div className="card">
          <div className="card-header"><span className="card-title">Booking Status Distribution</span></div>
          {statLoading ? <div className="skeleton" style={{ height: 220 }} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {statusPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Driver performance */}
      {driversData.length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Driver Performance</span></div>
          <table className="admin-table">
            <thead><tr><th>Driver</th><th>Total Trips</th><th>Avg Rating</th></tr></thead>
            <tbody>
              {driversData.slice(0, 10).map((d: any) => (
                <tr key={d.driver_id}>
                  <td>{d.driver_name}</td>
                  <td><span style={{ fontWeight: 600 }}>{d.total_trips}</span></td>
                  <td>{d.avg_rating ? `★ ${Number(d.avg_rating).toFixed(1)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
