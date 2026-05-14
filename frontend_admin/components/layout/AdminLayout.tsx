'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Wifi, WifiOff } from 'lucide-react'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { NotificationBell } from '@/components/admin/NotificationBell'
import { useAuthStore } from '@/store/adminStore'
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket'
import { authApi } from '@/lib/api'

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, isAuthenticated, _hasHydrated, clearAuth } = useAuthStore()
  const { connectionStatus } = useAdminWebSocket(isAuthenticated)

  useEffect(() => {
    // Wait for Zustand to rehydrate from localStorage before redirecting
    if (_hasHydrated && !isAuthenticated) {
      router.replace('/login')
    }
  }, [_hasHydrated, isAuthenticated, router])

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    clearAuth()
    router.replace('/login')
  }

  // Show loading spinner while Zustand is rehydrating
  if (!_hasHydrated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-base)' }}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AdminSidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{
          height: 64,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          flexShrink: 0,
        }}>
          <div />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* WS connection indicator */}
            <div
              title={`WebSocket: ${connectionStatus}`}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}
            >
              {connectionStatus === 'connected'
                ? <Wifi size={14} color="var(--success)" />
                : <WifiOff size={14} color="var(--danger)" />}
              <span style={{ color: connectionStatus === 'connected' ? 'var(--success)' : 'var(--danger)' }}>
                {connectionStatus}
              </span>
            </div>

            <NotificationBell />

            {/* User menu */}
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 600, color: 'white',
                }}>
                  {user.name?.[0]?.toUpperCase()}
                </div>
              </div>
            )}

            <button
              id="logout-btn"
              className="btn btn-ghost btn-icon"
              onClick={handleLogout}
              title="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Main content */}
        <main style={{ flex: 1, padding: '24px', overflowY: 'auto', background: 'var(--bg-base)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
