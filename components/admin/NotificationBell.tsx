'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, Check, Trash2 } from 'lucide-react'
import { useNotificationStore, AdminNotification } from '@/store/adminStore'
import { formatDistanceToNow } from 'date-fns'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotificationStore()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const typeIcon: Record<AdminNotification['type'], string> = {
    EMERGENCY: '🚨',
    BOOKING: '📋',
    DRIVER_STATUS: '🚗',
    SYSTEM: '⚙️',
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        id="notification-bell"
        className="btn btn-ghost btn-icon"
        onClick={() => setOpen((o) => !o)}
        style={{ position: 'relative' }}
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            background: 'var(--danger)', color: 'white',
            borderRadius: '50%', width: 16, height: 16,
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          width: 360, maxHeight: 480,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-lg)',
          zIndex: 200,
          display: 'flex', flexDirection: 'column',
          animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-default)',
          }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Notifications</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {unreadCount > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={markAllRead} title="Mark all read">
                  <Check size={13} /> All read
                </button>
              )}
              {notifications.length > 0 && (
                <button className="btn btn-ghost btn-icon btn-sm" onClick={clearAll} title="Clear all">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No notifications
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    background: n.read ? 'transparent' : 'var(--brand-primary-muted)',
                    transition: 'background var(--transition-fast)',
                    display: 'flex', gap: 10,
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{typeIcon[n.type]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13, color: n.priority === 'urgent' ? 'var(--danger)' : 'var(--text-primary)' }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                    </div>
                  </div>
                  {!n.read && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-primary)', flexShrink: 0, marginTop: 4 }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
