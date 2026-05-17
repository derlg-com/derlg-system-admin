'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Car,
  Truck,
  CalendarCheck,
  Hotel,
  Users,
  AlertTriangle,
  UserCheck,
  Tag,
  BarChart3,
  ShieldCheck,
  ScrollText,
  Bot,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAuthStore, useUIStore } from '@/store/adminStore'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  roles?: string[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Bookings', href: '/admin/bookings', icon: CalendarCheck, roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT'] },
  { label: 'Drivers', href: '/admin/drivers', icon: Car, roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'FLEET_MANAGER'] },
  { label: 'Vehicles', href: '/admin/vehicles', icon: Truck, roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'FLEET_MANAGER'] },
  { label: 'Hotels', href: '/admin/hotels', icon: Hotel, roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER'] },
  { label: 'Tour Guides', href: '/admin/guides', icon: UserCheck, roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER'] },
  { label: 'Customers', href: '/admin/customers', icon: Users, roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT'] },
  { label: 'Emergency', href: '/admin/emergency', icon: AlertTriangle, roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER'] },
  { label: 'Discounts', href: '/admin/discounts', icon: Tag, roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER'] },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3, roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER'] },
  { label: 'Telegram', href: '/admin/telegram/broadcast', icon: MessageSquare, roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'FLEET_MANAGER'] },
  { label: 'Admin Users', href: '/admin/users', icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: ScrollText, roles: ['SUPER_ADMIN'] },
  { label: 'AI Monitoring', href: '/admin/ai-monitoring', icon: Bot, roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER'] },
]

interface AdminSidebarProps {
  onNavigate?: () => void
}

export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  const pathname = usePathname()
  const { user } = useAuthStore()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  const filteredNav = navItems.filter(
    (item) => !item.roles || !user?.adminRole || item.roles.includes(user.adminRole),
  )

  return (
    <div
      className="flex flex-col h-full"
      style={{
        width: sidebarCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
        transition: 'width var(--transition-normal)',
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-between shrink-0 border-b"
        style={{
          height: 80,
          padding: sidebarCollapsed ? '0 12px' : '0 20px 0 36px',
          borderColor: 'var(--border-default)',
        }}
      >
        <div className={cn('flex items-center gap-3', sidebarCollapsed && 'hidden')}>
          <div
            className="flex size-9 items-center justify-center rounded-xl text-sm font-bold text-white transition-all hover:scale-105 hover:shadow-lg cursor-default"
            style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))', boxShadow: 'var(--shadow-glow-blue)' }}
            aria-hidden="true"
          >
            D
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>DerLg</div>
            <div className="text-[10px] tracking-widest uppercase font-medium" style={{ color: 'var(--text-muted)' }}>Admin Panel</div>
          </div>
        </div>

        {sidebarCollapsed && (
          <div
            className="flex size-9 items-center justify-center rounded-xl text-sm font-bold text-white mx-auto"
            style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))' }}
            aria-hidden="true"
          >
            D
          </div>
        )}

        {!sidebarCollapsed && (
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: '12px 10px' }} aria-label="Sidebar navigation">
        {filteredNav.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href ||
            pathname.startsWith(item.href + '/') ||
            (item.href === '/admin/telegram/broadcast' && pathname.startsWith('/admin/telegram'))

          return (
            <Link
              key={item.href}
              href={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-xl mb-1 transition-all w-full',
                sidebarCollapsed ? 'justify-center py-3 px-0' : 'px-5 py-2.5',
                isActive
                  ? 'font-semibold'
                  : 'font-normal hover:text-foreground'
              )}
              style={{
                color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                background: isActive ? 'var(--brand-primary-muted)' : 'transparent',
                minHeight: 44,
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                size={19}
                className="shrink-0"
              />
              {!sidebarCollapsed && (
                <span className="text-sm truncate">{item.label}</span>
              )}
              {isActive && !sidebarCollapsed && (
                <div
                  className="ml-auto shrink-0 rounded-full"
                  style={{
                    width: 6,
                    height: 6,
                    background: 'var(--brand-primary)',
                  }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Expand button when collapsed */}
      {sidebarCollapsed && (
        <div
          className="flex justify-center py-3 border-t"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* User section */}
      {!sidebarCollapsed && user && (
        <div
          className="flex items-center gap-3 shrink-0 border-t"
          style={{
            padding: '14px 16px',
            borderColor: 'var(--border-default)',
          }}
        >
          <div
            className="flex size-9 items-center justify-center rounded-full text-sm font-semibold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))' }}
            aria-hidden="true"
          >
            {user.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 overflow-hidden">
            <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {user.name}
            </div>
            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {user.adminRole || user.role}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
