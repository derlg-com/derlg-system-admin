'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Wifi, WifiOff, Menu, X } from 'lucide-react'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { NotificationBell } from '@/components/admin/NotificationBell'
import { useAuthStore } from '@/store/adminStore'
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { authApi } from '@/lib/api'
import { cn } from '@/lib/utils'

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, isAuthenticated, _hasHydrated, clearAuth } = useAuthStore()
  const { connectionStatus } = useAdminWebSocket(isAuthenticated)
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile sidebar when switching to desktop
  useEffect(() => {
    if (!isMobile) setMobileOpen(false)
  }, [isMobile])

  // Close mobile sidebar on route change (handled by browser back/forward)
  useEffect(() => {
    const handleRouteChange = () => setMobileOpen(false)
    window.addEventListener('popstate', handleRouteChange)
    return () => window.removeEventListener('popstate', handleRouteChange)
  }, [])

  useEffect(() => {
    // Wait for Zustand to rehydrate from localStorage before redirecting
    if (_hasHydrated && !isAuthenticated) {
      router.replace('/login')
    }
  }, [_hasHydrated, isAuthenticated, router])

  // Role check: redirect users without adminRole to login
  useEffect(() => {
    if (_hasHydrated && isAuthenticated && user && !user.adminRole) {
      router.replace('/login')
    }
  }, [_hasHydrated, isAuthenticated, user, router])

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    clearAuth()
    router.replace('/login')
  }

  // Show loading spinner while Zustand is rehydrating
  if (!_hasHydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  if (!isAuthenticated) return null

  const wsConnected = connectionStatus === 'connected'

  return (
    <div className="flex min-h-screen">
      {/* Mobile sidebar overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 animate-fade-in"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:relative top-0 left-0 h-screen z-50 flex flex-col shrink-0 transition-transform duration-300 ease-in-out',
          isMobile && !mobileOpen && '-translate-x-full',
          isMobile && mobileOpen && 'translate-x-0'
        )}
        style={{
          width: isMobile ? 'var(--sidebar-width)' : undefined,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-default)',
        }}
      >
        <AdminSidebar onNavigate={() => isMobile && setMobileOpen(false)} />
      </aside>

      <div className="flex flex-col min-w-0 flex-1">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 shrink-0 border-b"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="btn btn-ghost btn-icon md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>

            {/* Page title on mobile */}
            <span className="md:hidden text-sm font-semibold text-foreground truncate">
              DerLg Admin
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* WS connection indicator */}
            <div
              title={`WebSocket: ${connectionStatus}`}
              className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              {wsConnected ? (
                <Wifi size={14} className="text-emerald-500" />
              ) : (
                <WifiOff size={14} className="text-destructive" />
              )}
              <span className={cn(wsConnected ? 'text-emerald-500' : 'text-destructive')}>
                {wsConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <NotificationBell />

            {/* User info */}
            {user && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))' }}
                >
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <div className="hidden lg:block">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.adminRole}</p>
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
        <main className="flex-1 p-4 md:p-6 overflow-y-auto bg-background"
          style={{ background: 'var(--bg-base)' }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
