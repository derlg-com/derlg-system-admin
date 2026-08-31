'use client'

import { useEffect } from 'react'
import { setTokenRefreshCallback } from '@/lib/api'
import { useAuthStore, type AdminUser } from '@/store/adminStore'

/**
 * The refresh endpoint's user payload arrives as `unknown` — `lib/api.ts` is
 * deliberately store-agnostic, so it cannot type it. Validate the shape here
 * instead of asserting it: a malformed payload should leave the session alone
 * rather than push a half-built user into the store, where every consumer of
 * `user.name` would then read undefined.
 */
function toAdminUser(value: unknown): AdminUser | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.email !== 'string' ||
    typeof candidate.role !== 'string'
  ) {
    return null
  }
  return {
    id: candidate.id,
    email: candidate.email,
    role: candidate.role,
    // The backend returns `fullName`; the store models it as `name`. Fall back to
    // the email so the UI always has something to display.
    name:
      typeof candidate.name === 'string'
        ? candidate.name
        : typeof candidate.fullName === 'string'
          ? candidate.fullName
          : candidate.email,
    ...(typeof candidate.adminRole === 'string'
      ? { adminRole: candidate.adminRole }
      : {}),
    ...(typeof candidate.avatarUrl === 'string'
      ? { avatarUrl: candidate.avatarUrl }
      : {}),
    ...(typeof candidate.permissions === 'object' && candidate.permissions !== null
      ? { permissions: candidate.permissions as Record<string, boolean> }
      : {}),
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const updateUser = useAuthStore((s) => s.updateUser)

  useEffect(() => {
    setTokenRefreshCallback((token, user) => {
      if (!token) {
        clearAuth()
        return
      }
      const adminUser = toAdminUser(user)
      if (adminUser) {
        setAuth(adminUser, token)
      }
      // If no usable user came back, the interceptor has already stored the new
      // token; the existing user in the store stays valid.
    })
  }, [setAuth, clearAuth, updateUser])

  return <>{children}</>
}
