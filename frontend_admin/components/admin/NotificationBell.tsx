'use client'

import { Bell, Check, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNotificationStore, type AdminNotification } from '@/store/adminStore'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

const typeIcon: Record<AdminNotification['type'], string> = {
  EMERGENCY: '🚨',
  BOOKING: '📋',
  DRIVER_STATUS: '🚗',
  SYSTEM: '⚙️',
}

const typeColor: Record<AdminNotification['type'], string> = {
  EMERGENCY: 'text-destructive',
  BOOKING: 'text-primary',
  DRIVER_STATUS: 'text-emerald-500',
  SYSTEM: 'text-muted-foreground',
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotificationStore()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell size={18} />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] font-bold flex items-center justify-center"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <DropdownMenuLabel className="px-0 py-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={markAllRead}>
                <Check size={12} /> All read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="icon-xs" className="h-7 w-7" onClick={clearAll} title="Clear all">
                <Trash2 size={12} />
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => markRead(n.id)}
                className={cn(
                  'flex gap-3 px-3 py-3 cursor-pointer rounded-none border-b last:border-0',
                  !n.read && 'bg-primary/5'
                )}
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <span className="text-lg shrink-0">{typeIcon[n.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium truncate', n.priority === 'urgent' ? 'text-destructive' : 'text-foreground')}>
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{n.message}</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                    {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                  </p>
                </div>
                {!n.read && (
                  <div className="shrink-0 w-2 h-2 rounded-full bg-primary mt-1" />
                )}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
