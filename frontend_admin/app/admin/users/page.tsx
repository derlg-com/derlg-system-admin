'use client'

import { AdminUserList } from '@/components/admin/users/AdminUserList'
import { AccessDenied } from '@/components/shared'
import { usePermission } from '@/hooks/usePermission'

export default function UsersPage() {
  const { isSuperAdmin } = usePermission()

  if (!isSuperAdmin) {
    return (
      <AccessDenied
        title="Super Admin Only"
        message="Admin user management is restricted to SUPER_ADMIN role."
      />
    )
  }

  return <AdminUserList />
}
