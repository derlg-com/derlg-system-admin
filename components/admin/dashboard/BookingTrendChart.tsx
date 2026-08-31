'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { format } from 'date-fns'

interface BookingTrendChartProps {
  data: Array<{ date: string; count: number }>
  loading?: boolean
}

export function BookingTrendChart({ data, loading }: BookingTrendChartProps) {
  if (loading) {
    return <div className="skeleton" style={{ height: 220 }} />
  }

  const formatted = data.map((d) => ({
    ...d,
    label: format(new Date(d.date), 'MMM d'),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
        <XAxis
          dataKey="label"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--bg-overlay)',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: 'var(--text-secondary)' }}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke="var(--brand-primary)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: 'var(--brand-primary)' }}
          name="Bookings"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
