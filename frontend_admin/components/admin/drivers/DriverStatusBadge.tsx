'use client'

import { cn } from '@/lib/utils'

interface DriverStatusBadgeProps {
  status: string
  pulsing?: boolean
  className?: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dotColor: string }> = {
  AVAILABLE: {
    label: 'Available',
    color: 'var(--success)',
    bg: 'var(--success-muted)',
    dotColor: 'var(--success)',
  },
  BUSY: {
    label: 'Busy',
    color: 'var(--warning)',
    bg: 'var(--warning-muted)',
    dotColor: 'var(--warning)',
  },
  OFFLINE: {
    label: 'Offline',
    color: 'var(--text-muted)',
    bg: 'var(--bg-elevated)',
    dotColor: 'var(--text-muted)',
  },
}

export function DriverStatusBadge({ status, pulsing = false, className }: DriverStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    color: 'var(--text-muted)',
    bg: 'var(--bg-elevated)',
    dotColor: 'var(--text-muted)',
  }

  const shouldPulse = pulsing && status === 'AVAILABLE'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        className
      )}
      style={{
        background: config.bg,
        color: config.color,
      }}
    >
      <span
        className={cn('inline-block size-1.5 rounded-full', shouldPulse && 'animate-pulse-dot')}
        style={{ background: config.dotColor }}
      />
      {config.label}
    </span>
  )
}
