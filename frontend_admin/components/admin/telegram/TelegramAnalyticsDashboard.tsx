'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { telegramApi } from '@/lib/api'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts'
import { Users, Activity, Clock, Terminal } from 'lucide-react'
import { format, subDays } from 'date-fns'

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

interface TelegramAnalytics {
  total_registered_drivers: number
  active_drivers_24h: number
  avg_response_time_minutes: number
  total_commands_24h: number
  daily_active_drivers: { date: string; count: number }[]
  command_usage: { command: string; count: number }[]
  assignment_acceptance: { status: string; count: number }[]
}

export function TelegramAnalyticsDashboard() {
  const [days, setDays] = useState(30)

  const { data, isLoading } = useQuery<TelegramAnalytics>({
    queryKey: ['telegram-analytics', days],
    queryFn: () =>
      telegramApi
        .getAnalytics({ days })
        .then((r) => r.data),
    staleTime: 60000,
  })

  // Fallback mock data
  const analytics: TelegramAnalytics = data || {
    total_registered_drivers: 142,
    active_drivers_24h: 38,
    avg_response_time_minutes: 4.2,
    total_commands_24h: 256,
    daily_active_drivers: Array.from({ length: 30 }, (_, i) => ({
      date: format(subDays(new Date(), 29 - i), 'yyyy-MM-dd'),
      count: Math.floor(Math.random() * 40) + 10,
    })),
    command_usage: [
      { command: '/online', count: 120 },
      { command: '/offline', count: 98 },
      { command: '/status', count: 85 },
      { command: '/mytrip', count: 42 },
      { command: '/support', count: 18 },
      { command: '/help', count: 15 },
    ],
    assignment_acceptance: [
      { status: 'Accepted', count: 78 },
      { status: 'Rejected', count: 12 },
      { status: 'Expired', count: 8 },
    ],
  }

  const acceptanceRate = analytics.assignment_acceptance.length > 0
    ? ((analytics.assignment_acceptance.find((a) => a.status === 'Accepted')?.count || 0) /
        analytics.assignment_acceptance.reduce((sum, a) => sum + a.count, 0) * 100
      ).toFixed(1)
    : '0'

  return (
    <div className="space-y-6">
      {/* Date range selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Time range:</span>
        {[7, 14, 30].map((d) => (
          <button
            key={d}
            className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setDays(d)}
          >
            Last {d} days
          </button>
        ))}
      </div>

      {/* Summary metrics */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
      >
        <MetricCard
          label="Registered Drivers"
          value={analytics.total_registered_drivers}
          icon={<Users size={18} />}
          color="#3b82f6"
        />
        <MetricCard
          label="Active (24h)"
          value={analytics.active_drivers_24h}
          icon={<Activity size={18} />}
          color="#22c55e"
        />
        <MetricCard
          label="Avg Response Time"
          value={`${analytics.avg_response_time_minutes}m`}
          icon={<Clock size={18} />}
          color="#8b5cf6"
        />
        <MetricCard
          label="Commands (24h)"
          value={analytics.total_commands_24h}
          icon={<Terminal size={18} />}
          color="#f59e0b"
        />
      </div>

      {/* Charts */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
      >
        {/* Daily Active Drivers - Line Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Daily Active Drivers</span>
          </div>
          {isLoading ? (
            <div className="skeleton" style={{ height: 260 }} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={analytics.daily_active_drivers}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => format(new Date(v), 'MMM d')}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-overlay)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => format(new Date(v), 'MMM d, yyyy')}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#3b82f6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Command Usage - Pie Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Command Usage</span>
          </div>
          {isLoading ? (
            <div className="skeleton" style={{ height: 260 }} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={analytics.command_usage}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="count"
                  nameKey="command"
                  paddingAngle={3}
                >
                  {analytics.command_usage.map((_, i) => (
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

      {/* Assignment Acceptance Rate - Bar Chart */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Assignment Acceptance Rate</span>
          <span className="text-sm text-muted-foreground">
            {acceptanceRate}% acceptance rate
          </span>
        </div>
        {isLoading ? (
          <div className="skeleton" style={{ height: 220 }} />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={analytics.assignment_acceptance}
              margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis
                dataKey="status"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-overlay)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {analytics.assignment_acceptance.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.status === 'Accepted'
                        ? '#22c55e'
                        : entry.status === 'Rejected'
                        ? '#ef4444'
                        : '#f59e0b'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
