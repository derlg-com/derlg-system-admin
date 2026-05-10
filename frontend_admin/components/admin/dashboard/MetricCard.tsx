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
        <div className="skeleton" style={{ height: 14, width: 80, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 32, width: 120, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 12, width: 60 }} />
      </div>
    )
  }

  return (
    <div className="metric-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </span>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={17} color={color} />
        </div>
      </div>

      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>

      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          {trend.value >= 0
            ? <TrendingUp size={12} color="var(--success)" />
            : <TrendingDown size={12} color="var(--danger)" />}
          <span style={{ color: trend.value >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
          <span style={{ color: 'var(--text-muted)' }}>{trend.label || 'vs yesterday'}</span>
        </div>
      )}
    </div>
  )
}
