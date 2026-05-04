import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ---- Auth Store ----
interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  adminRole?: string
  preferredLanguage: string
  avatarUrl?: string
}

interface AuthState {
  user: AdminUser | null
  accessToken: string | null
  isAuthenticated: boolean
  _hasHydrated: boolean
  setAuth: (user: AdminUser, token: string) => void
  clearAuth: () => void
  updateUser: (updates: Partial<AdminUser>) => void
  setHasHydrated: (v: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      setAuth: (user, token) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('admin_access_token', token)
        }
        set({ user, accessToken: token, isAuthenticated: true })
      },
      clearAuth: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('admin_access_token')
        }
        set({ user: null, accessToken: null, isAuthenticated: false })
      },
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'derlg-admin-auth',
      // Persist all three so the token survives page refresh
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Sync token into localStorage after rehydration
        if (state?.accessToken && typeof window !== 'undefined') {
          localStorage.setItem('admin_access_token', state.accessToken)
        }
        state?.setHasHydrated(true)
      },
    },
  ),
)

// ---- Notification Store ----
export interface AdminNotification {
  id: string
  type: 'BOOKING' | 'DRIVER_STATUS' | 'EMERGENCY' | 'SYSTEM'
  title: string
  message: string
  timestamp: Date
  read: boolean
  priority?: 'normal' | 'urgent'
  data?: Record<string, any>
}

interface NotificationState {
  notifications: AdminNotification[]
  unreadCount: number
  addNotification: (n: Omit<AdminNotification, 'id' | 'timestamp' | 'read'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
  clearAll: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (notification) =>
    set((state) => {
      const newN: AdminNotification = {
        ...notification,
        id: crypto.randomUUID(),
        timestamp: new Date(),
        read: false,
      }
      const updated = [newN, ...state.notifications].slice(0, 100)
      return { notifications: updated, unreadCount: state.unreadCount + 1 }
    }),
  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}))

// ---- UI Store ----
interface UIState {
  sidebarCollapsed: boolean
  language: 'EN' | 'KH' | 'ZH'
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  setLanguage: (lang: 'EN' | 'KH' | 'ZH') => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      language: 'EN',
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setLanguage: (lang) => set({ language: lang }),
    }),
    { name: 'derlg-admin-ui' },
  ),
)
