'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/lib/api'
import { RevenueChart } from './RevenueChart'
import { PerformanceMetrics } from './PerformanceMetrics'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { Download, TrendingUp, Users, BedDouble, MapPin } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444']

interface MetricCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  color: string
}

function MetricCard({ label, value, icon, color }: MetricCardProps) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
      <div
        className="inline-flex items-center justify-center rounded-full"
        style={{
          width: 40,
          height: 40,
          backgroundColor: `${color}20`,
          color,
          marginBottom: 8,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

export function AnalyticsDashboard() {
  const today = new Date()
  const lastMonth = new Date()
  lastMonth.setMonth(lastMonth.getMonth() - 1)

  const [startDate, setStartDate] = useState(format(lastMonth, 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(today, 'yyyy-MM-dd'))

  const { data: revenue, isLoading: revLoading } = useQuery({
    queryKey: ['analytics-revenue', startDate, endDate],
    queryFn: () =>
      analyticsApi.getRevenue({ start_date: startDate, end_date: endDate }).then((r) => r.data),
    staleTime: 60000,
  })

  const { data: bookingStats, isLoading: statLoading } = useQuery({
    queryKey: ['analytics-bookings', startDate, endDate],
    queryFn: () =>
      analyticsApi.getBookings({ start_date: startDate, end_date: endDate }).then((r) => r.data),
    staleTime: 60000,
  })

  const { data: driverStats, isLoading: driverLoading } = useQuery({
    queryKey: ['analytics-drivers'],
    queryFn: () => analyticsApi.getDrivers().then((r) => r.data),
    staleTime: 300000,
  })

  const { data: destinations, isLoading: destLoading } = useQuery({
    queryKey: ['analytics-destinations'],
    queryFn: () => analyticsApi.getPopularDestinations().then((r) => r.data),
    staleTime: 300000,
  })

  const { data: hotelOccupancy, isLoading: hotelLoading } = useQuery({
    queryKey: ['analytics-hotels', startDate, endDate],
    queryFn: () =>
      analyticsApi.getHotelOccupancy({ start_date: startDate, end_date: endDate }).then((r) => r.data),
    staleTime: 60000,
  })

  const { data: guideUtil, isLoading: guideLoading } = useQuery({
    queryKey: ['analytics-guides', startDate, endDate],
    queryFn: () =>
      analyticsApi.getGuideUtilization({ start_date: startDate, end_date: endDate }).then((r) => r.data),
    staleTime: 60000,
  })

  const handleExport = async () => {
    try {
      const res = await analyticsApi.export({
        start_date: startDate,
        end_date: endDate,
        format: 'csv',
      })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `analytics-${startDate}-${endDate}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Analytics exported')
    } catch {
      toast.error('Failed to export analytics')
    }
  }

  // Fallback mock data
  const revenueData = revenue?.by_type || [
    { type: 'PACKAGE', total: 12400 },
    { type: 'HOTEL_ONLY', total: 4800 },
    { type: 'TRANSPORT_ONLY', total: 2200 },
    { type: 'GUIDE_ONLY', total: 1100 },
  ]

  const statsData = bookingStats || {
    total: 147,
    confirmed: 89,
    completed: 31,
    cancelled: 18,
    refunded: 9,
  }

  const driversData = driverStats || []

  const destinationsData = destinations?.destinations || [
    { name: 'Siem Reap', bookings: 45, revenue: 18200 },
    { name: 'Phnom Penh', bookings: 38, revenue: 12400 },
    { name: 'Sihanoukville', bookings: 22, revenue: 8600 },
    { name: 'Battambang', bookings: 18, revenue: 5200 },
    { name: 'Kampot', bookings: 12, revenue: 3800 },
  ]

  const hotelData = hotelOccupancy || {
    occupancy_rate: 72.5,
    total_hotels: 24,
    occupied_rooms: 186,
    total_rooms: 256,
  }

  const guideData = guideUtil || {
    utilization_rate: 64.3,
    total_guides: 18,
    active_guides: 12,
  }

  const cancelRate = statsData.total
    ? ((statsData.cancelled / statsData.total) * 100).toFixed(1)
    : '0'

  const statusPieData = [
    { name: 'Confirmed', value: statsData.confirmed || 0 },
    { name: 'Completed', value: statsData.completed || 0 },
    { name: 'Cancelled', value: statsData.cancelled || 0 },
    { name: 'Refunded', value: statsData.refunded || 0 },
  ].filter((d) => d.value > 0)

  return (
    <div className="space-y-6">
      {/* Date range + export */}
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <div className="flex items-center gap-2">
          <input
            className="form-input"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ width: 'auto' }}
          />
          <span className="text-muted-foreground">—</span>
          <input
            className="form-input"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ width: 'auto' }}
          />
        </div>
        <button className="btn btn-secondary" onClick={handleExport}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Summary metrics */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
      >
        <MetricCard
          label="Total Bookings"
          value={statsData.total}
          icon={<TrendingUp size={18} />}
          color="var(--brand-primary)"
        />
        <MetricCard
          label="Confirmed"
          value={statsData.confirmed}
          icon={<TrendingUp size={18} />}
          color="var(--success)"
        />
        <MetricCard
          label="Completed"
          value={statsData.completed}
          icon={<TrendingUp size={18} />}
          color="var(--brand-accent)"
        />
        <MetricCard
          label="Cancelled"
          value={statsData.cancelled}
          icon={<TrendingUp size={18} />}
          color="var(--danger)"
        />
        <MetricCard
          label="Cancel Rate"
          value={`${cancelRate}%`}
          icon={<TrendingUp size={18} />}
          color="var(--warning)"
        />
      </div>

      {/* Revenue + Booking Status */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
      >
        <RevenueChart data={revenueData} loading={revLoading} />

        {/* Booking status pie */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Booking Status Distribution</span>
          </div>
          {statLoading ? (
            <div className="skeleton" style={{ height: 260 }} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  paddingAngle={3}
                >
                  {statusPieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-overlay)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Popular Destinations */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Popular Destinations</span>
        </div>
        {destLoading ? (
          <div className="skeleton" style={{ height: 220 }} />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={destinationsData}
              margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                width={100}
              />
              <Tooltip
                formatter={(v: any, name: any) => {
                  if (name === 'Revenue') return [`$${Number(v).toLocaleString()}`, name]
                  return [v, name]
                }}
                contentStyle={{
                  background: 'var(--bg-overlay)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="bookings" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Bookings" />
              <Bar
                dataKey="revenue"
                fill="#3b82f6"
                radius={[0, 4, 4, 0]}
                name="Revenue"
                hide
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Hotel Occupancy + Guide Utilization */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
      >
        <div className="card">
          <div className="card-header">
            <span className="card-title">Hotel Occupancy</span>
          </div>
          {hotelLoading ? (
            <div className="skeleton" style={{ height: 160 }} />
          ) : (
            <div className="space-y-4" style={{ padding: '0 16px 16px' }}>
              <div className="flex items-center gap-3">
                <div
                  className="inline-flex items-center justify-center rounded-full"
                  style={{
                    width: 48,
                    height: 48,
                    backgroundColor: 'var(--brand-primary)20',
                    color: 'var(--brand-primary)',
                  }}
                >
                  <BedDouble size={22} />
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>
                    {hotelData.occupancy_rate}%
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Overall occupancy rate
                  </div>
                </div>
              </div>
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: '1fr 1fr',
                  padding: 12,
                  background: 'var(--bg-muted)',
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Hotels</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{hotelData.total_hotels}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Occupied / Total</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>
                    {hotelData.occupied_rooms} / {hotelData.total_rooms}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Guide Utilization</span>
          </div>
          {guideLoading ? (
            <div className="skeleton" style={{ height: 160 }} />
          ) : (
            <div className="space-y-4" style={{ padding: '0 16px 16px' }}>
              <div className="flex items-center gap-3">
                <div
                  className="inline-flex items-center justify-center rounded-full"
                  style={{
                    width: 48,
                    height: 48,
                    backgroundColor: 'var(--brand-accent)20',
                    color: 'var(--brand-accent)',
                  }}
                >
                  <Users size={22} />
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>
                    {guideData.utilization_rate}%
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Overall utilization rate
                  </div>
                </div>
              </div>
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: '1fr 1fr',
                  padding: 12,
                  background: 'var(--bg-muted)',
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Guides</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{guideData.total_guides}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Active Guides</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{guideData.active_guides}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Driver Performance */}
      <PerformanceMetrics
        data={driversData}
        loading={driverLoading}
        title="Driver Performance"
      />
    </div>
  )
}
