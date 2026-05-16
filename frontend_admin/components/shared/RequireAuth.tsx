'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/adminStore'
import { AccessDenied } from './AccessDenied'

interface RequireAuthProps {
  children: React.ReactNode
  requiredRoles?: string[]
  requiredPermission?: string
  fallback?: React.ReactNode
}

export function RequireAuth({
  children,
  requiredRoles,
  requiredPermission,
  fallback,
}: RequireAuthProps) {
  const router = useRouter()
  const { user, isAuthenticated, _hasHydrated, hasAnyRole, hasPermission } = useAuthStore()

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) {
      router.replace('/login')
    }
  }, [_hasHydrated, isAuthenticated, router])

  if (!_hasHydrated) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <span className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    )
  }

  if (!isAuthenticated) return null

  // Check role requirement
  if (requiredRoles && requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
    return fallback ? <>{fallback}</> : <AccessDenied />
  }

  // Check permission requirement
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return fallback ? <>{fallback}</> : <AccessDenied />
  }

  return <>{children}</>
}
