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
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    dotColor: 'bg-emerald-400',
  },
  BUSY: {
    label: 'Busy',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    dotColor: 'bg-amber-400',
  },
  OFFLINE: {
    label: 'Offline',
    color: 'text-slate-400',
    bg: 'bg-slate-400/10',
    dotColor: 'bg-slate-400',
  },
}

export function DriverStatusBadge({ status, pulsing = false, className }: DriverStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    color: 'text-slate-400',
    bg: 'bg-slate-400/10',
    dotColor: 'bg-slate-400',
  }

  const shouldPulse = pulsing && status === 'AVAILABLE'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.bg,
        config.color,
        className
      )}
    >
      <span
        className={cn(
          'inline-block size-1.5 rounded-full',
          config.dotColor,
          shouldPulse && 'animate-pulse-dot'
        )}
      />
      {config.label}
    </span>
  )
}
