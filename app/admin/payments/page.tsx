'use client'

import { AccessDenied, PageHeader } from '@/components/shared'
import { usePermission } from '@/hooks/usePermission'
import { AbaExceptionQueue } from '@/components/admin/payments/AbaExceptionQueue'
import { RefundPayoutQueue } from '@/components/admin/payments/RefundPayoutQueue'
import { PaymentList } from '@/components/admin/payments/PaymentList'

/**
 * Payments operations.
 *
 * Reads are open to support agents fielding "did my payment go through?"; the two
 * write actions (settle an ABA payment, record a refund payout) move money or mark
 * it moved, so they are gated to OPERATIONS_MANAGER and SUPER_ADMIN and hidden —
 * not disabled — for everyone else, matching the sidebar convention. These lists
 * mirror the backend `@AdminRoles` decorators; the server enforces them again.
 */
export default function PaymentsPage() {
  const { hasAnyRole } = usePermission()
  const canView = hasAnyRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT'])
  const canWrite = hasAnyRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER'])

  if (!canView) {
    return (
      <AccessDenied
        title="No access to payments"
        message="Payment operations are available to support agents, operations managers and super admins."
      />
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Payments"
        subtitle="Resolve ABA exceptions, record refund payouts, and review every transaction."
      />
      {/* Exception queue first: it is the surface that needs attention. */}
      <AbaExceptionQueue canWrite={canWrite} />
      <RefundPayoutQueue canWrite={canWrite} />
      <PaymentList />
    </div>
  )
}
