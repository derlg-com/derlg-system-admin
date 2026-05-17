'use client'

import { useEffect } from 'react'
import { setTokenRefreshCallback } from '@/lib/api'
import { useAuthStore } from '@/store/adminStore'

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
      if (user) {
        setAuth(user, token)
      }
      // If no user in refresh response, at least update the token in localStorage
      // (already done by interceptor)
    })
  }, [setAuth, clearAuth, updateUser])

  return <>{children}</>
}
