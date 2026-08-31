'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Radio, BarChart3, Headphones } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { label: 'Broadcast', href: '/admin/telegram/broadcast', icon: Radio },
  { label: 'Analytics', href: '/admin/telegram/analytics', icon: BarChart3 },
  { label: 'Support', href: '/admin/telegram/support', icon: Headphones },
]

export function TelegramSubNav() {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-1 border-b pb-1 mb-4"
      style={{ borderColor: 'var(--border-default)' }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            <Icon size={15} />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
