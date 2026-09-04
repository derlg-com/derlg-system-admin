'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { format } from 'date-fns'
import { HandCoins, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { refundsApi, unwrapList } from '@/lib/api'
import { getApiErrorMessage } from '@/lib/utils'
import { DataTable, FilterDropdown, FormField, Modal, type Column } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import {
  PAYMENT_STATUSES,
  ProviderBadge,
  PaymentStatusBadge,
  formatUsd,
  type PaymentProviderValue,
  type PaymentStatusValue,
} from './PaymentList'

export interface RefundRow {
  id: string
  amountUsd: string
  percentage: number
  reason: string
  status: PaymentStatusValue
  providerRefundId: string | null
  processedById: string | null
  createdAt: string
  payment: {
    id: string
    provider: PaymentProviderValue
    amountUsd: string
    refundedAmountUsd: string
    booking: { id: string; reference: string } | null
    user: { id: string; fullName: string; email: string } | null
  } | null
}

const STATUS_LABELS: Record<PaymentStatusValue, string> = {
  pending: 'Pending',
  processing: 'Processing',
  succeeded: 'Succeeded',
  failed: 'Failed',
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
}

// Mirrors CompleteRefundDto so the operator gets an inline message rather than a
// 400 toast.
const payoutSchema = z.object({
  providerRefundId: z
    .string()
    .trim()
    .min(4, 'Enter the bank transfer reference (at least 4 characters)')
    .max(120, 'Keep the reference under 120 characters'),
  reason: z
    .string()
    .trim()
    .min(10, 'Give a reason of at least 10 characters describing the payout')
    .max(500, 'Keep the reason under 500 characters'),
})

type PayoutFormData = z.infer<typeof payoutSchema>

function PayoutDialog({
  target,
  onClose,
}: {
  target: RefundRow
  onClose: () => void
}) {
  const qc = useQueryClient()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PayoutFormData>({
    resolver: zodResolver(payoutSchema),
    defaultValues: { providerRefundId: '', reason: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: PayoutFormData) =>
      refundsApi.complete(target.id, data.providerRefundId, data.reason),
    onSuccess: () => {
      // Confirming a payout moves the payment's refunded total and status, so the
      // refunds queue and the ledger below both need refreshing.
      qc.invalidateQueries({ queryKey: ['admin-refunds'] })
      qc.invalidateQueries({ queryKey: ['admin-payments'] })
      toast.success('Refund payout recorded')
      onClose()
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to record payout')),
  })

  return (
    <Modal
      open
      title="Mark refund as paid out"
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
            Record payout
          </Button>
        </>
      }
    >
      <div className="mb-4 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
        <p className="font-semibold">Record this only after the bank transfer is done.</p>
        <p className="mt-1">
          ABA has no refund API, so this is what moves the refunded total on the
          original payment. The books must not show money returned before it was.
        </p>
      </div>

      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-500">Booking</dt>
        <dd className="font-medium">{target.payment?.booking?.reference ?? '—'}</dd>
        <dt className="text-slate-500">Customer</dt>
        <dd>{target.payment?.user?.fullName ?? '—'}</dd>
        <dt className="text-slate-500">Amount to transfer</dt>
        <dd className="font-semibold tabular-nums">
          {formatUsd(target.amountUsd)} ({target.percentage}%)
        </dd>
      </dl>

      <FormField
        label="Bank transfer reference"
        required
        error={errors.providerRefundId?.message}
      >
        <Input
          {...register('providerRefundId')}
          aria-label="Bank transfer reference"
          autoComplete="off"
          placeholder="e.g. ABA transfer receipt no."
        />
      </FormField>

      <FormField
        label="Reason"
        required
        error={errors.reason?.message}
        hint="Recorded in the audit log alongside the transfer reference."
      >
        <Textarea
          {...register('reason')}
          aria-label="Reason"
          rows={3}
          placeholder="Transferred $X to the customer's account on…"
        />
      </FormField>
    </Modal>
  )
}

/**
 * The refund payout work queue.
 *
 * Defaults to the pending filter because that is the outstanding work. Card
 * refunds are shown but never actionable here: Stripe settles them and the
 * backend answers PAY_METHOD_NOT_SUPPORTED. The "Mark paid out" action is offered
 * for the providers the backend actually accepts by hand — everything that is not
 * a card — which in practice is ABA.
 */
export function RefundPayoutQueue({ canWrite }: { canWrite: boolean }) {
  const [status, setStatus] = useState<string>('pending')
  const [page, setPage] = useState(1)
  const [payoutTarget, setPayoutTarget] = useState<RefundRow | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-refunds', { status, page }],
    queryFn: () => {
      const params: Record<string, unknown> = { page, limit: 20 }
      if (status) params.status = status
      return refundsApi.list(params).then(unwrapList<RefundRow>)
    },
    staleTime: 30000,
  })

  const columns: Column<RefundRow>[] = [
    {
      key: 'booking',
      label: 'Booking',
      render: (row) => (
        <span className="font-medium">{row.payment?.booking?.reference ?? '—'}</span>
      ),
    },
    {
      key: 'user',
      label: 'Customer',
      render: (row) => (
        <div>
          <div>{row.payment?.user?.fullName ?? '—'}</div>
          {row.payment?.user?.email ? (
            <div className="text-xs text-slate-500">{row.payment.user.email}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'amountUsd',
      label: 'Amount',
      render: (row) => (
        <span className="tabular-nums">{formatUsd(row.amountUsd)}</span>
      ),
    },
    {
      key: 'percentage',
      label: 'Tier',
      render: (row) => `${Number(row.percentage)}%`,
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (row) => (
        <span className="block max-w-[22ch] truncate" title={row.reason}>
          {row.reason}
        </span>
      ),
    },
    {
      key: 'provider',
      label: 'Provider',
      render: (row) =>
        row.payment ? <ProviderBadge provider={row.payment.provider} /> : <span>—</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <PaymentStatusBadge status={row.status} />,
    },
    {
      key: 'createdAt',
      label: 'Requested',
      render: (row) => format(new Date(row.createdAt), 'dd MMM yyyy, HH:mm'),
    },
  ]

  return (
    <section aria-labelledby="refund-payouts-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <HandCoins className="size-5 text-slate-500" aria-hidden="true" />
        <h2 id="refund-payouts-heading" className="text-lg font-semibold">
          Refund payouts
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterDropdown
          label="Status"
          value={status}
          onChange={(v: string) => {
            setStatus(v)
            setPage(1)
          }}
          placeholder="All statuses"
          options={[
            { label: 'All statuses', value: '' },
            ...PAYMENT_STATUSES.map((s) => ({ label: STATUS_LABELS[s], value: s })),
          ]}
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        rowKey="id"
        emptyMessage="No refunds match the current filter."
        totalCount={data?.meta.total ?? 0}
        currentPage={page}
        onPageChange={setPage}
        actions={(row) => {
          // Stripe processes card refunds itself; the backend refuses a manual
          // payout on them. Show why rather than a dead button.
          if (row.payment?.provider === 'stripe') {
            return (
              <span
                className="text-xs text-slate-500"
                title="Stripe processes card refunds automatically; there is nothing to confirm by hand."
              >
                Auto — Stripe
              </span>
            )
          }
          // Already paid out: the payment's refunded total has moved. Read-only.
          if (row.status === 'succeeded') {
            return (
              <span className="text-xs text-emerald-700" title={row.providerRefundId ?? undefined}>
                Paid out
              </span>
            )
          }
          if (!canWrite) return <span className="text-xs text-slate-400">—</span>
          return (
            <Button variant="outline" size="sm" onClick={() => setPayoutTarget(row)}>
              <HandCoins className="size-3.5" /> Mark paid out
            </Button>
          )
        }}
      />

      {payoutTarget ? (
        <PayoutDialog target={payoutTarget} onClose={() => setPayoutTarget(null)} />
      ) : null}
    </section>
  )
}
