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
  Wrench,
  Bot,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAuthStore, useUIStore } from '@/store/adminStore'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ size?: number; color?: string }>
  roles?: string[]
  badge?: number
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
  { label: 'Admin Users', href: '/admin/users', icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: ScrollText, roles: ['SUPER_ADMIN'] },
  { label: 'AI Monitoring', href: '/admin/ai-monitoring', icon: Bot, roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER'] },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { user } = useAuthStore()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  const filteredNav = navItems.filter(
    (item) => !item.roles || !user?.adminRole || item.roles.includes(user.adminRole),
  )

  return (
    <aside
      style={{
        width: sidebarCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
        minHeight: '100vh',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width var(--transition-normal)',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: sidebarCollapsed ? 'center' : 'space-between',
        padding: sidebarCollapsed ? '20px 0' : '20px 20px',
        borderBottom: '1px solid var(--border-default)',
        height: 64,
        flexShrink: 0,
      }}>
        {!sidebarCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: 'white',
            }}>D</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>DerLg</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>ADMIN PANEL</div>
            </div>
          </div>
        )}
        {sidebarCollapsed && (
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: 'white',
          }}>D</div>
        )}
        {!sidebarCollapsed && (
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={toggleSidebar}
            title="Collapse sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
        {filteredNav.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: sidebarCollapsed ? '10px 0' : '10px 12px',
                borderRadius: 8,
                marginBottom: 2,
                textDecoration: 'none',
                color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                background: isActive ? 'var(--brand-primary-muted)' : 'transparent',
                fontWeight: isActive ? 600 : 400,
                fontSize: 13,
                transition: 'all var(--transition-fast)',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <Icon size={17} />
              {!sidebarCollapsed && <span>{item.label}</span>}
              {isActive && !sidebarCollapsed && (
                <div style={{
                  width: 3, height: '60%', borderRadius: 2,
                  background: 'var(--brand-primary)',
                  position: 'absolute', right: 8,
                }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Expand button when collapsed */}
      {sidebarCollapsed && (
        <div style={{ padding: '12px 0', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'center' }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={toggleSidebar} title="Expand sidebar">
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* User section */}
      {!sidebarCollapsed && user && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 600, color: 'white', flexShrink: 0,
          }}>
            {user.name?.[0]?.toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user.adminRole || user.role}</div>
          </div>
        </div>
      )}
    </aside>
  )
}
