'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { telegramApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, FilterDropdown } from '@/components/shared'
import { format } from 'date-fns'
import { RefreshCw } from 'lucide-react'

interface BroadcastMessage {
  id: string
  message_id: string
  content: string
  image_url?: string
  target_filter: Record<string, any>
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  sent_count: number
  failed_count: number
  created_at: string
  completed_at?: string
  sent_by_name?: string
}

const STATUS_OPTIONS = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Failed', value: 'FAILED' },
]

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    PENDING: 'badge badge-warning',
    IN_PROGRESS: 'badge badge-info',
    COMPLETED: 'badge badge-success',
    FAILED: 'badge badge-danger',
  }
  return <span className={variants[status] || 'badge'}>{status.replace(/_/g, ' ')}</span>
}

function TargetLabel({ filter }: { filter: Record<string, any> }) {
  const type = filter?.type || 'all'
  if (type === 'all') return 'All Drivers'
  if (type === 'online') return 'Online Only'
  if (type === 'offline') return 'Offline Only'
  if (type === 'vehicle_type') {
    const types = filter.vehicle_types || []
    return types.length > 0 ? types.join(', ') : 'By Vehicle Type'
  }
  return type
}

export function BroadcastHistory() {
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, refetch } = useQuery<{
    items: BroadcastMessage[]
    total: number
    page: number
    pageSize: number
  }>({
    queryKey: ['telegram-broadcast-history', statusFilter, page],
    queryFn: () =>
      telegramApi
        .getBroadcastHistory({
          status: statusFilter || undefined,
          page,
          pageSize: 20,
        })
        .then((r) => r.data),
    staleTime: 30000,
  })

  const items = data?.items || []
  const total = data?.total || 0

  const columns = [
    {
      key: 'created_at',
      label: 'Timestamp',
      sortable: true,
      render: (r: BroadcastMessage) =>
        format(new Date(r.created_at), 'MMM d, yyyy HH:mm'),
    },
    {
      key: 'content',
      label: 'Message',
      render: (r: BroadcastMessage) => (
        <div className="max-w-[300px] truncate text-sm" title={r.content}>
          {r.content}
        </div>
      ),
    },
    {
      key: 'target',
      label: 'Target',
      render: (r: BroadcastMessage) => <TargetLabel filter={r.target_filter} />,
    },
    {
      key: 'sent_count',
      label: 'Sent',
      render: (r: BroadcastMessage) => (
        <span className="text-emerald-500 font-medium">{r.sent_count}</span>
      ),
    },
    {
      key: 'failed_count',
      label: 'Failed',
      render: (r: BroadcastMessage) => (
        <span className={r.failed_count > 0 ? 'text-destructive font-medium' : ''}>
          {r.failed_count}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: BroadcastMessage) => <StatusBadge status={r.status} />,
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Broadcast History"
        subtitle={`${total} total broadcasts`}
        actions={
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => refetch()} title="Refresh">
            <RefreshCw size={14} />
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <FilterDropdown
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
          placeholder="All Statuses"
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          data={items}
          loading={isLoading}
          rowKey="id"
          emptyMessage="No broadcast history found"
          columns={columns}
          pageSize={20}
          currentPage={page}
          onPageChange={setPage}
          totalCount={total}
        />
      </div>
    </div>
  )
}
