'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface RevenueItem {
  type: string
  total: number
}

interface RevenueChartProps {
  data: RevenueItem[]
  loading?: boolean
}

const LABEL_MAP: Record<string, string> = {
  PACKAGE: 'Package',
  HOTEL_ONLY: 'Hotel',
  TRANSPORT_ONLY: 'Transport',
  GUIDE_ONLY: 'Guide',
  CUSTOM: 'Custom',
}

export function RevenueChart({ data, loading }: RevenueChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: LABEL_MAP[d.type] || d.type,
  }))

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Revenue by Booking Type</span>
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: 260 }} />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Revenue']}
              contentStyle={{
                background: 'var(--bg-overlay)',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="total" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} name="Revenue" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
