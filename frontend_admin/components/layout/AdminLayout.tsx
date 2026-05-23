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

  // Close mobile sidebar on route change
  useEffect(() => {
    const handleRouteChange = () => setMobileOpen(false)
    window.addEventListener('popstate', handleRouteChange)
    return () => window.removeEventListener('popstate', handleRouteChange)
  }, [])

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) {
      router.replace('/login')
    }
  }, [_hasHydrated, isAuthenticated, router])

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

  if (!_hasHydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="flex min-h-screen">
      {/* Mobile sidebar overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:relative top-0 left-0 h-screen z-50 flex flex-col shrink-0',
          isMobile && !mobileOpen && '-translate-x-full',
          isMobile && mobileOpen && 'translate-x-0'
        )}
        style={{
          width: isMobile ? 'var(--sidebar-width)' : undefined,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-default)',
          transition: 'transform var(--transition-normal)',
        }}
        aria-label="Main navigation"
      >
        <AdminSidebar onNavigate={() => isMobile && setMobileOpen(false)} />
      </aside>

      <div className="flex flex-col min-w-0 flex-1">
        {/* Top bar */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between shrink-0 border-b"
          style={{
            height: 64,
            padding: '0 20px',
            background: 'var(--bg-surface)',
            borderColor: 'var(--border-default)',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="btn btn-ghost btn-icon md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              aria-controls="sidebar"
            >
              <Menu size={20} />
            </button>

            {/* Page title on mobile */}
            <span className="md:hidden text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              DerLg Admin
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* WS connection indicator */}
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{
                fontSize: 12,
                fontWeight: 500,
                background:
                  connectionStatus === 'connected'
                    ? 'var(--success-muted)'
                    : connectionStatus === 'connecting'
                      ? 'var(--warning-muted)'
                      : 'var(--danger-muted)',
              }}
              aria-live="polite"
            >
              {connectionStatus === 'connected' ? (
                <>
                  <span className="relative flex size-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--success)' }} />
                    <span className="relative inline-flex rounded-full size-2" style={{ background: 'var(--success)' }} />
                  </span>
                  <span style={{ color: 'var(--success)' }}>Live</span>
                </>
              ) : connectionStatus === 'connecting' ? (
                <>
                  <Wifi size={13} style={{ color: 'var(--warning)' }} />
                  <span style={{ color: 'var(--warning)' }}>Connecting</span>
                </>
              ) : (
                <>
                  <WifiOff size={13} style={{ color: 'var(--danger)' }} />
                  <span style={{ color: 'var(--danger)' }}>Offline</span>
                </>
              )}
            </div>

            <div className="h-6 w-px hidden sm:block" style={{ background: 'var(--border-default)' }} />

            <NotificationBell />

            {/* User info */}
            {user && (
              <div className="hidden sm:flex items-center gap-3 pl-1">
                <div
                  className="flex size-9 items-center justify-center rounded-full text-sm font-semibold text-white shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
                  }}
                  aria-hidden="true"
                >
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <div className="hidden lg:block">
                  <p className="text-sm font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>
                    {user.name}
                  </p>
                  <p className="text-xs leading-tight mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {user.adminRole}
                  </p>
                </div>
              </div>
            )}

            <div className="h-6 w-px hidden sm:block" style={{ background: 'var(--border-default)' }} />

            <button
              className="btn btn-ghost btn-icon"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Main content */}
        <main
          className="flex-1 overflow-y-auto"
          style={{
            background: 'var(--bg-base)',
            padding: 'var(--space-5) var(--space-4)',
          }}
          id="main-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
