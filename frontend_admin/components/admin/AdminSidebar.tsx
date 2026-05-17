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
    <div className="flex flex-col h-full w-full"
      style={{
        width: sidebarCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
        transition: 'width var(--transition-normal)',
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 shrink-0 border-b px-5"
        style={{ borderColor: 'var(--border-default)' }}
      >
        <div className={cn('flex items-center gap-2.5', sidebarCollapsed && 'hidden')}>
          <div className="flex size-8 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))' }}
          >
            D
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-bold text-foreground">DerLg</div>
            <div className="text-[10px] tracking-wider text-muted-foreground uppercase">Admin Panel</div>
          </div>
        </div>

        {sidebarCollapsed && (
          <div className="flex size-8 items-center justify-center rounded-lg text-sm font-bold text-white mx-auto"
            style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))' }}
          >
            D
          </div>
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
      <nav className="flex-1 overflow-y-auto py-3 px-2">
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
                'flex items-center gap-2.5 rounded-lg mb-0.5 text-sm transition-colors',
                sidebarCollapsed ? 'justify-center py-2.5 px-0' : 'px-3 py-2.5',
                isActive
                  ? 'font-semibold text-primary bg-primary/10'
                  : 'font-normal text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <Icon size={17} />
              {!sidebarCollapsed && <span>{item.label}</span>}
              {isActive && !sidebarCollapsed && (
                <div className="ml-auto w-0.5 h-5 rounded-full bg-primary" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Expand button when collapsed */}
      {sidebarCollapsed && (
        <div className="flex justify-center py-3 border-t"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <button className="btn btn-ghost btn-icon btn-sm" onClick={toggleSidebar} title="Expand sidebar">
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* User section */}
      {!sidebarCollapsed && user && (
        <div className="flex items-center gap-2.5 px-4 py-3 border-t shrink-0"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <div className="flex size-8 items-center justify-center rounded-full text-sm font-semibold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))' }}
          >
            {user.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate text-foreground">{user.name}</div>
            <div className="text-xs text-muted-foreground">{user.adminRole || user.role}</div>
          </div>
        </div>
      )}
    </div>
  )
}
