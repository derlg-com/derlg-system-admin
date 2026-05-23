'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  icon: React.ComponentType<{ size?: number; color?: string }>
  trend?: { value: number; label?: string }
  color?: string
  loading?: boolean
}

export function MetricCard({ title, value, icon: Icon, trend, color = 'var(--brand-primary)', loading }: MetricCardProps) {
  if (loading) {
    return (
      <div className="metric-card">
        <div className="skeleton" style={{ height: 14, width: 100, marginBottom: 20, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 36, width: 140, marginBottom: 16, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 14, width: 80, borderRadius: 6 }} />
      </div>
    )
  }

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
        >
          {title}
        </span>
        <div
          className="flex items-center justify-center rounded-xl"
          style={{
            width: 44,
            height: 44,
            background: `${color}18`,
          }}
        >
          <Icon size={20} color={color} />
        </div>
      </div>

      <div
        className="text-[32px] font-bold tracking-tight"
        style={{ color: 'var(--text-primary)', lineHeight: 1.1, marginTop: 16 }}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>

      {trend ? (
        <div className="flex items-center gap-1.5 mt-3">
          {trend.value >= 0
            ? <TrendingUp size={14} color="var(--success)" />
            : <TrendingDown size={14} color="var(--danger)" />}
          <span
            className="text-sm font-semibold tabular-nums"
            style={{ color: trend.value >= 0 ? 'var(--success)' : 'var(--danger)' }}
          >
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{trend.label || 'vs yesterday'}</span>
        </div>
      ) : (
        <div className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
          Updated just now
        </div>
      )}
    </div>
  )
}
