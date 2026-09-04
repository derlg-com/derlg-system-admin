'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { format, formatDistanceToNow } from 'date-fns'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { paymentsApi, unwrapList } from '@/lib/api'
import { getApiErrorMessage } from '@/lib/utils'
import { DataTable, FormField, Modal, type Column } from '@/components/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import { formatUsd } from './PaymentList'

/**
 * An ABA payment the Telegram listener could not settle on its own: the QR
 * expired while still pending, meaning either money arrived with no matching
 * alert, or two pending payments shared an amount and the listener refused to
 * guess which booking to confirm.
 */
export interface AbaException {
  id: string
  amountUsd: string
  qrExpiresAt: string
  createdAt: string
  booking: { id: string; reference: string; status: string } | null
  user: { id: string; fullName: string; email: string } | null
}

// Mirrors SettlePaymentManuallyDto: the backend 400s otherwise, so validate here
// to give the operator an inline message instead of a toast after a round trip.
const settleSchema = z.object({
  abaTrxId: z
    .string()
    .trim()
    .regex(
      /^\d{6,32}$/,
      'Enter the numeric ABA transaction id from the credit alert (6–32 digits)',
    ),
  reason: z
    .string()
    .trim()
    .min(10, 'Give a reason of at least 10 characters explaining this settlement')
    .max(500, 'Keep the reason under 500 characters'),
})

type SettleFormData = z.infer<typeof settleSchema>

function SettleDialog({
  target,
  onClose,
}: {
  target: AbaException
  onClose: () => void
}) {
  const qc = useQueryClient()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettleFormData>({
    resolver: zodResolver(settleSchema),
    defaultValues: { abaTrxId: '', reason: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: SettleFormData) =>
      paymentsApi.settleManually(target.id, data.abaTrxId, data.reason),
    onSuccess: () => {
      // Settling removes this row from the exceptions and flips the payment to
      // succeeded, so both surfaces are now stale.
      qc.invalidateQueries({ queryKey: ['admin-aba-exceptions'] })
      qc.invalidateQueries({ queryKey: ['admin-payments'] })
      toast.success('Payment settled and booking confirmed')
      onClose()
    },
    // The backend rejects a reused transaction id or an already-settled payment
    // with an explanatory message — surface it verbatim, it is actionable.
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to settle payment')),
  })

  return (
    <Modal
      open
      title="Settle ABA payment manually"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit((data) => mutation.mutate(data))}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Settle payment
          </Button>
        </>
      }
    >
      <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="font-semibold">Settling confirms this booking as paid.</p>
        <p className="mt-1">
          First verify the amount below against the ABA statement. The transaction
          id you enter ties this settlement to that statement line and cannot be
          reused to settle another booking.
        </p>
      </div>

      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-500">Booking</dt>
        <dd className="font-medium">{target.booking?.reference ?? '—'}</dd>
        <dt className="text-slate-500">Customer</dt>
        <dd>{target.user?.fullName ?? '—'}</dd>
        <dt className="text-slate-500">Amount to verify</dt>
        <dd className="font-semibold tabular-nums">{formatUsd(target.amountUsd)}</dd>
      </dl>

      <FormField label="ABA transaction id" required error={errors.abaTrxId?.message}>
        <Input
          {...register('abaTrxId')}
          aria-label="ABA transaction id"
          inputMode="numeric"
          autoComplete="off"
          placeholder="e.g. 178220228091798"
        />
      </FormField>

      <FormField
        label="Reason"
        required
        error={errors.reason?.message}
        hint="Recorded in the audit log alongside the transaction id."
      >
        <Textarea
          {...register('reason')}
          aria-label="Reason"
          rows={3}
          placeholder="Verified $X against the ABA statement line dated…"
        />
      </FormField>
    </Modal>
  )
}

/**
 * The exception queue — the reason this screen exists.
 *
 * Rendered first on the payments page because it is the surface that needs
 * attention: each row is a customer's money sitting unresolved behind an expired
 * QR. Presented as an alert region so a screen reader announces the outstanding
 * count.
 */
export function AbaExceptionQueue({ canWrite }: { canWrite: boolean }) {
  const [settleTarget, setSettleTarget] = useState<AbaException | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-aba-exceptions'],
    // getAbaExceptions returns a bare array; unwrapList normalises it to items.
    queryFn: () => paymentsApi.getAbaExceptions().then(unwrapList<AbaException>),
    staleTime: 30000,
  })

  const exceptions = data?.items ?? []
  const count = exceptions.length

  const summary = isLoading
    ? 'Checking for ABA payments that need manual settlement…'
    : count === 0
      ? 'No ABA payments are awaiting manual settlement.'
      : `${count} expired ABA payment${count === 1 ? '' : 's'} awaiting manual settlement. Verify each amount against the ABA statement before settling.`

  const columns: Column<AbaException>[] = [
    {
      key: 'booking',
      label: 'Booking',
      render: (row) => (
        <span className="font-medium">{row.booking?.reference ?? '—'}</span>
      ),
    },
    {
      key: 'user',
      label: 'Customer',
      render: (row) => (
        <div>
          <div>{row.user?.fullName ?? '—'}</div>
          {row.user?.email ? (
            <div className="text-xs text-slate-500">{row.user.email}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'amountUsd',
      label: 'Amount',
      render: (row) => (
        <span className="font-semibold tabular-nums">{formatUsd(row.amountUsd)}</span>
      ),
    },
    {
      key: 'qrExpiresAt',
      label: 'QR expired',
      render: (row) => (
        <span title={format(new Date(row.qrExpiresAt), 'dd MMM yyyy, HH:mm')}>
          {formatDistanceToNow(new Date(row.qrExpiresAt), { addSuffix: true })}
        </span>
      ),
    },
  ]

  return (
    <section aria-labelledby="aba-exceptions-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-5 text-amber-600" aria-hidden="true" />
        <h2 id="aba-exceptions-heading" className="text-lg font-semibold">
          ABA payment exceptions
        </h2>
        {count > 0 && (
          <Badge className="bg-amber-100 text-amber-800">{count}</Badge>
        )}
      </div>

      {/* Announced to assistive tech: this is the alert surface, and the count is
          the operator's cue to act. */}
      <p role="status" aria-live="polite" className="text-sm text-slate-500">
        {summary}
      </p>

      <DataTable
        columns={columns}
        data={exceptions}
        loading={isLoading}
        rowKey="id"
        emptyMessage="Nothing to resolve — every ABA payment has settled or is still within its QR window."
        actions={
          canWrite
            ? (row) => (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSettleTarget(row)}
                >
                  Settle manually
                </Button>
              )
            : undefined
        }
      />

      {settleTarget ? (
        <SettleDialog target={settleTarget} onClose={() => setSettleTarget(null)} />
      ) : null}
    </section>
  )
}
