'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Award, Eye, GraduationCap, Pencil, ShieldOff, ShieldCheck } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

import { customersApi, extractErrorMessage } from '@/lib/api'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { PageHeader, SearchInput } from '@/components/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { CustomerEditDialog } from './CustomerEditDialog'
import { CustomerStatusDialog } from './CustomerStatusDialog'

/**
 * Field names are camelCase throughout.
 *
 * This component previously read `name`, `loyalty_points`, `is_student` and
 * `created_at`, none of which the API returns — and it called `.filter()` on the
 * `{ data, meta }` envelope as if it were an array, which threw. Every column
 * rendered blank, or the page crashed outright.
 */
export interface Customer {
  id: string
  email: string
  fullName: string | null
  phone: string | null
  avatarUrl: string | null
  loyaltyPoints: number
  isStudentVerified: boolean
  role: string
  status: 'active' | 'inactive' | 'suspended'
  bookingCount: number
  reviewCount: number
  createdAt: string
  updatedAt: string
}

const STATUS_STYLES: Record<Customer['status'], string> = {
  active: 'bg-emerald-100 text-emerald-800',
  inactive: 'bg-slate-100 text-slate-700',
  suspended: 'bg-rose-100 text-rose-800',
}

export function CustomerList() {
  const router = useRouter()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [editTarget, setEditTarget] = useState<Customer | null>(null)
  const [statusTarget, setStatusTarget] = useState<Customer | null>(null)

  const listQuery = useQuery({
    queryKey: ['admin-customers', { search, status, page }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 }
      if (search.trim()) params.search = search.trim()
      if (status !== 'all') params.status = status
      const res = await customersApi.list(params)
      // Server-side filtering and pagination — the old client-side `.filter()`
      // could only ever search the current page anyway.
      return res.data as { data: Customer[]; meta: { total: number } }
    },
    staleTime: 30000,
  })

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      nextStatus,
      reason,
    }: {
      id: string
      nextStatus: string
      reason: string
    }) => customersApi.setStatus(id, nextStatus, reason),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-customers'] })
      setStatusTarget(null)
      const payload = res.data as { status: string; clearedSessionKeys: number }
      toast.success(
        payload.status === 'active'
          ? 'Customer reactivated'
          : `Customer ${payload.status}; ${payload.clearedSessionKeys} session(s) terminated`,
      )
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Failed to change status')),
  })

  const total = listQuery.data?.meta.total ?? 0

  const columns: Column<Customer>[] = [
    {
      key: 'fullName',
      label: 'Name',
      sortable: true,
      render: (r) => (
        <div>
          <div className="font-medium">{r.fullName ?? '—'}</div>
          <div className="text-xs text-slate-500">{r.email}</div>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <Badge className={STATUS_STYLES[r.status]}>{r.status}</Badge>,
    },
    {
      key: 'role',
      label: 'Role',
      render: (r) => <Badge variant="outline">{r.role}</Badge>,
    },
    {
      key: 'loyaltyPoints',
      label: 'Points',
      sortable: true,
      render: (r) => (
        <span className="inline-flex items-center gap-1 font-semibold">
          <Award className="size-3.5" />
          {r.loyaltyPoints}
        </span>
      ),
    },
    {
      key: 'bookingCount',
      label: 'Bookings',
      render: (r) => r.bookingCount,
    },
    {
      key: 'isStudentVerified',
      label: 'Student',
      render: (r) =>
        r.isStudentVerified ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
            <GraduationCap className="size-3.5" />
            Verified
          </span>
        ) : (
          <span className="text-sm text-slate-400">—</span>
        ),
    },
    {
      key: 'createdAt',
      label: 'Joined',
      sortable: true,
      render: (r) => (r.createdAt ? format(new Date(r.createdAt), 'MMM d, yyyy') : '—'),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Customers" subtitle={`${total} customer(s)`} />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(v: string) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search by name, email, or phone..."
        />
        <Select
          value={status}
          onValueChange={(v: string) => {
            setStatus(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          columns={columns}
          data={listQuery.data?.data ?? []}
          loading={listQuery.isLoading}
          rowKey="id"
          emptyMessage="No customers found"
          totalCount={total}
          currentPage={page}
          onPageChange={setPage}
          actions={(row) => (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                title="View profile"
                onClick={() => router.push(`/admin/customers/${row.id}`)}
              >
                <Eye size={13} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                title="Edit"
                onClick={() => setEditTarget(row)}
              >
                <Pencil size={13} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                title={row.status === 'active' ? 'Suspend' : 'Reactivate'}
                onClick={() => setStatusTarget(row)}
              >
                {row.status === 'active' ? (
                  <ShieldOff size={13} className="text-rose-600" />
                ) : (
                  <ShieldCheck size={13} className="text-emerald-600" />
                )}
              </Button>
            </div>
          )}
        />
      </div>

      <CustomerEditDialog
        customer={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null)
          qc.invalidateQueries({ queryKey: ['admin-customers'] })
        }}
      />

      {/*
        `key` remounts the dialog when a different customer is targeted, which
        clears the reason field. Without it, one customer's justification could
        be submitted against another.
      */}
      <CustomerStatusDialog
        key={statusTarget?.id ?? 'none'}
        customer={statusTarget}
        saving={statusMutation.isPending}
        onClose={() => setStatusTarget(null)}
        onConfirm={(nextStatus, reason) =>
          statusTarget &&
          statusMutation.mutate({ id: statusTarget.id, nextStatus, reason })
        }
      />
    </div>
  )
}
