'use client'

import { AuditLogViewer } from '@/components/admin/audit/AuditLogViewer'
import { AccessDenied } from '@/components/shared'
import { usePermission } from '@/hooks/usePermission'

export default function AuditLogsPage() {
  const { isSuperAdmin } = usePermission()

  if (!isSuperAdmin) {
    return (
      <AccessDenied
        title="Super Admin Only"
        message="Audit log access is restricted to SUPER_ADMIN role."
      />
    )
  }

  return <AuditLogViewer />
}
