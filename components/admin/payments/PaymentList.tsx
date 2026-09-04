'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Receipt } from 'lucide-react'

import { paymentsApi, unwrapList } from '@/lib/api'
import { DataTable, FilterDropdown, SearchInput, type Column } from '@/components/shared'
import { Badge } from '@/components/ui/badge'

/** Prisma PaymentProvider (lowercase enum members). */
export type PaymentProviderValue = 'stripe' | 'bakong' | 'aba'

/** Prisma PaymentStatus (lowercase enum members). */
export type PaymentStatusValue =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'

export const PAYMENT_PROVIDERS: PaymentProviderValue[] = ['stripe', 'bakong', 'aba']
export const PAYMENT_STATUSES: PaymentStatusValue[] = [
  'pending',
  'processing',
  'succeeded',
  'failed',
  'refunded',
  'partially_refunded',
]

const PROVIDER_LABELS: Record<PaymentProviderValue, string> = {
  stripe: 'Stripe (card)',
  bakong: 'Bakong',
  aba: 'ABA',
}

const STATUS_LABELS: Record<PaymentStatusValue, string> = {
  pending: 'Pending',
  processing: 'Processing',
  succeeded: 'Succeeded',
  failed: 'Failed',
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
}

// Semantic colours only (emerald/amber/rose/slate), per the panel's convention.
const STATUS_STYLES: Record<PaymentStatusValue, string> = {
  pending: 'bg-amber-100 text-amber-800',
  processing: 'bg-amber-100 text-amber-800',
  succeeded: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-rose-100 text-rose-800',
  refunded: 'bg-slate-200 text-slate-700',
  partially_refunded: 'bg-slate-200 text-slate-700',
}

/**
 * Formats a USD amount for display.
 *
 * `amountUsd`/`refundedAmountUsd` are Prisma `Decimal(10,2)` columns, which arrive
 * over the wire as strings — coerce before `toFixed` or it throws.
 */
export function formatUsd(value: string | number | null | undefined): string {
  return `$${Number(value ?? 0).toFixed(2)}`
}

export function ProviderBadge({ provider }: { provider: PaymentProviderValue }) {
  return (
    <Badge variant="outline" className="uppercase">
      {provider}
    </Badge>
  )
}

export function PaymentStatusBadge({ status }: { status: PaymentStatusValue }) {
  return (
    <Badge className={STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700'}>
      {STATUS_LABELS[status] ?? status.replace(/_/g, ' ')}
    </Badge>
  )
}

export interface PaymentRefundSummary {
  id: string
  amountUsd: string
  status: PaymentStatusValue
  createdAt: string
}

export interface PaymentRow {
  id: string
  provider: PaymentProviderValue
  status: PaymentStatusValue
  amountUsd: string
  refundedAmountUsd: string
  currency: string
  providerPaymentId: string | null
  stripePaymentIntentId: string | null
  qrExpiresAt: string | null
  paidAt: string | null
  createdAt: string
  booking: { id: string; reference: string; status: string; totalUsd: string } | null
  user: { id: string; fullName: string; email: string } | null
  refunds: PaymentRefundSummary[]
}

/**
 * The full transaction ledger.
 *
 * Read-only: settlement and refund payouts are the two operations above this list.
 * Support agents reach this to answer "did my payment go through?", so the search
 * targets the two identifiers a customer or a bank statement actually carries — a
 * booking reference or a provider settlement id.
 */
export function PaymentList() {
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payments', { search, provider, status, page }],
    queryFn: () => {
      const params: Record<string, unknown> = { page, limit: 20 }
      // Omit filters entirely when unset: forbidNonWhitelisted 400s an empty
      // `provider=`/`status=`, and the list treats an absent filter as "all".
      if (provider) params.provider = provider
      if (status) params.status = status
      if (search.trim()) params.search = search.trim()
      return paymentsApi.list(params).then(unwrapList<PaymentRow>)
    },
    staleTime: 30000,
  })

  const columns: Column<PaymentRow>[] = [
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
      key: 'provider',
      label: 'Provider',
      render: (row) => <ProviderBadge provider={row.provider} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <PaymentStatusBadge status={row.status} />,
    },
    {
      key: 'amountUsd',
      label: 'Amount',
      render: (row) => (
        <span className="tabular-nums">{formatUsd(row.amountUsd)}</span>
      ),
    },
    {
      key: 'refundedAmountUsd',
      label: 'Refunded',
      render: (row) => {
        const refunded = Number(row.refundedAmountUsd ?? 0)
        return (
          <span
            className={
              refunded > 0 ? 'tabular-nums text-rose-700' : 'tabular-nums text-slate-400'
            }
          >
            {formatUsd(refunded)}
          </span>
        )
      },
    },
    {
      key: 'settlement',
      label: 'Settlement ID',
      render: (row) => {
        const settlementId = row.providerPaymentId ?? row.stripePaymentIntentId
        return settlementId ? (
          <span
            className="font-mono text-xs text-slate-600"
            title={settlementId}
          >
            {settlementId}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )
      },
    },
    {
      key: 'paidAt',
      label: 'Paid / Created',
      render: (row) =>
        row.paidAt ? (
          <div>
            <div>{format(new Date(row.paidAt), 'dd MMM yyyy, HH:mm')}</div>
            <div className="text-xs text-slate-500">paid</div>
          </div>
        ) : (
          <div>
            <div>{format(new Date(row.createdAt), 'dd MMM yyyy, HH:mm')}</div>
            <div className="text-xs text-slate-500">created</div>
          </div>
        ),
    },
  ]

  return (
    <section aria-labelledby="all-payments-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <Receipt className="size-5 text-slate-500" aria-hidden="true" />
        <h2 id="all-payments-heading" className="text-lg font-semibold">
          All payments
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(v: string) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search booking reference or settlement id"
          style={{ minWidth: 280 }}
        />
        <FilterDropdown
          label="Provider"
          value={provider}
          onChange={(v: string) => {
            setProvider(v)
            setPage(1)
          }}
          placeholder="All providers"
          options={[
            { label: 'All providers', value: '' },
            ...PAYMENT_PROVIDERS.map((p) => ({ label: PROVIDER_LABELS[p], value: p })),
          ]}
        />
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
        emptyMessage="No payments match the current filters."
        totalCount={data?.meta.total ?? 0}
        currentPage={page}
        onPageChange={setPage}
      />
    </section>
  )
}
