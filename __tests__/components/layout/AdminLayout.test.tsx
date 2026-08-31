import React from 'react'
import { render, screen, waitFor } from '@/__tests__/test-utils'
import { AdminLayout } from '@/components/layout/AdminLayout'

// Mock next/navigation
const mockPush = jest.fn()
const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    refresh: jest.fn(),
  }),
  usePathname: () => '/admin/dashboard',
}))

// Mock the stores
jest.mock('@/store/adminStore', () => ({
  useAuthStore: jest.fn(),
  useUIStore: () => ({
    sidebarCollapsed: false,
    toggleSidebar: jest.fn(),
  }),
  useNotificationStore: () => ({
    addNotification: jest.fn(),
    notifications: [],
    unreadCount: 0,
  }),
}))

// Mock auth API
jest.mock('@/lib/api', () => ({
  authApi: {
    logout: jest.fn().mockResolvedValue({}),
  },
}))

// Mock useAdminWebSocket
jest.mock('@/hooks/useAdminWebSocket', () => ({
  useAdminWebSocket: () => ({
    connectionStatus: 'connected',
  }),
}))

// Mock NotificationBell
jest.mock('@/components/admin/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell">Bell</div>,
}))

// Mock AdminSidebar
jest.mock('@/components/admin/AdminSidebar', () => ({
  AdminSidebar: ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav data-testid="admin-sidebar">
      {/*
        Buttons, not anchors. These are a stub for the real sidebar and only need
        to fire onNavigate; using <a href="/admin/..."> tripped
        @next/next/no-html-link-for-pages, which exists because a raw anchor to a
        Next route triggers a full page reload instead of client-side navigation.
      */}
      <button type="button" onClick={() => onNavigate?.()}>Dashboard</button>
      <button type="button" onClick={() => onNavigate?.()}>Drivers</button>
      <button type="button" onClick={() => onNavigate?.()}>Bookings</button>
      <button type="button" onClick={() => onNavigate?.()}>Admin Users</button>
    </nav>
  ),
}))

import { useAuthStore } from '@/store/adminStore'

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>

/**
 * `AuthState` is not exported from the store, and each test only cares about a
 * handful of fields. One documented assertion here keeps `any` out of the seven
 * call sites below.
 */
type MockedAuthState = ReturnType<typeof useAuthStore>
const mockAuthState = (state: Record<string, unknown>) =>
  mockUseAuthStore.mockReturnValue(state as MockedAuthState)

describe('AdminLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuthState({
      user: {
        id: 'user-1',
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'ADMIN',
        adminRole: 'SUPER_ADMIN',
      },
      isAuthenticated: true,
      _hasHydrated: true,
      clearAuth: jest.fn(),
    })
  })

  it('renders loading spinner while rehydrating', () => {
    mockAuthState({
      user: null,
      isAuthenticated: false,
      _hasHydrated: false,
      clearAuth: jest.fn(),
    })

    render(
      <AdminLayout>
        <div data-testid="child-content">Content</div>
      </AdminLayout>
    )

    // Should show spinner instead of content
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument()
  })

  it('redirects unauthenticated users to login', async () => {
    mockAuthState({
      user: null,
      isAuthenticated: false,
      _hasHydrated: true,
      clearAuth: jest.fn(),
    })

    render(
      <AdminLayout>
        <div data-testid="child-content">Content</div>
      </AdminLayout>
    )

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login')
    })
  })

  it('redirects users without adminRole to login', async () => {
    mockAuthState({
      user: {
        id: 'user-1',
        name: 'Regular User',
        email: 'user@example.com',
        role: 'USER',
        adminRole: undefined,
      },
      isAuthenticated: true,
      _hasHydrated: true,
      clearAuth: jest.fn(),
    })

    render(
      <AdminLayout>
        <div data-testid="child-content">Content</div>
      </AdminLayout>
    )

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login')
    })
  })

  it('renders layout for authenticated admin users', () => {
    render(
      <AdminLayout>
        <div data-testid="child-content">Content</div>
      </AdminLayout>
    )

    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.getByTestId('admin-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument()
  })

  it('displays user info in top bar', () => {
    render(
      <AdminLayout>
        <div data-testid="child-content">Content</div>
      </AdminLayout>
    )

    expect(screen.getByText('Admin User')).toBeInTheDocument()
    expect(screen.getByText('SUPER_ADMIN')).toBeInTheDocument()
  })

  it('shows WebSocket connection status', () => {
    render(
      <AdminLayout>
        <div data-testid="child-content">Content</div>
      </AdminLayout>
    )

    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('renders sidebar navigation items', () => {
    render(
      <AdminLayout>
        <div data-testid="child-content">Content</div>
      </AdminLayout>
    )

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Drivers')).toBeInTheDocument()
    expect(screen.getByText('Bookings')).toBeInTheDocument()
    expect(screen.getByText('Admin Users')).toBeInTheDocument()
  })

  it('calls clearAuth and redirects on logout', async () => {
    const clearAuth = jest.fn()
    mockAuthState({
      user: {
        id: 'user-1',
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'ADMIN',
        adminRole: 'SUPER_ADMIN',
      },
      isAuthenticated: true,
      _hasHydrated: true,
      clearAuth,
    })

    render(
      <AdminLayout>
        <div data-testid="child-content">Content</div>
      </AdminLayout>
    )

    const logoutButton = screen.getByTitle('Log out')
    await logoutButton.click()

    await waitFor(() => {
      expect(clearAuth).toHaveBeenCalled()
      expect(mockReplace).toHaveBeenCalledWith('/login')
    })
  })

  it('renders with FLEET_MANAGER role', () => {
    mockAuthState({
      user: {
        id: 'user-2',
        name: 'Fleet Manager',
        email: 'fleet@example.com',
        role: 'ADMIN',
        adminRole: 'FLEET_MANAGER',
      },
      isAuthenticated: true,
      _hasHydrated: true,
      clearAuth: jest.fn(),
    })

    render(
      <AdminLayout>
        <div data-testid="child-content">Content</div>
      </AdminLayout>
    )

    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.getByText('Fleet Manager')).toBeInTheDocument()
  })

  it('renders with SUPPORT_AGENT role', () => {
    mockAuthState({
      user: {
        id: 'user-3',
        name: 'Support Agent',
        email: 'support@example.com',
        role: 'ADMIN',
        adminRole: 'SUPPORT_AGENT',
      },
      isAuthenticated: true,
      _hasHydrated: true,
      clearAuth: jest.fn(),
    })

    render(
      <AdminLayout>
        <div data-testid="child-content">Content</div>
      </AdminLayout>
    )

    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.getByText('Support Agent')).toBeInTheDocument()
  })
})
