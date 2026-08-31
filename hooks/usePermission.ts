import { useAuthStore } from '@/store/adminStore'

export function usePermission() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const hasAnyRole = useAuthStore((s) => s.hasAnyRole)
  const user = useAuthStore((s) => s.user)

  return {
    hasPermission,
    hasAnyRole,
    user,
    isSuperAdmin: user?.adminRole === 'SUPER_ADMIN',
    isOperationsManager: user?.adminRole === 'OPERATIONS_MANAGER',
    isFleetManager: user?.adminRole === 'FLEET_MANAGER',
    isSupportAgent: user?.adminRole === 'SUPPORT_AGENT',
    canManageDrivers: hasAnyRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'FLEET_MANAGER']),
    canManageVehicles: hasAnyRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'FLEET_MANAGER']),
    canManageBookings: hasAnyRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT']),
    canManageCustomers: hasAnyRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT']),
    canManageHotels: hasAnyRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']),
    canManageGuides: hasAnyRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']),
    canManageEmergency: hasAnyRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']),
    canManageDiscounts: hasAnyRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']),
    canViewAnalytics: hasAnyRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']),
    canManageAdminUsers: hasAnyRole(['SUPER_ADMIN']),
    canViewAuditLogs: hasAnyRole(['SUPER_ADMIN']),
    canManageAIMonitoring: hasAnyRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']),
  }
}
