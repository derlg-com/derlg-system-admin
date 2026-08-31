'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { telegramApi } from '@/lib/api'
import { getApiErrorMessage } from '@/lib/utils'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, FilterDropdown, ConfirmDialog } from '@/components/shared'
import { useNotificationStore } from '@/store/adminStore'
import { format } from 'date-fns'
import {
  RefreshCw,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'

interface SupportTicket {
  id: string
  ticket_id: string
  driver_id: string
  driver_name?: string
  driver_id_code?: string
  message: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  assigned_to?: string
  assigned_to_name?: string
  resolved_at?: string
  created_at: string
  updated_at: string
}

const STATUS_OPTIONS = [
  { label: 'Open', value: 'OPEN' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Closed', value: 'CLOSED' },
]

const PRIORITY_OPTIONS = [
  { label: 'Low', value: 'LOW' },
  { label: 'Normal', value: 'NORMAL' },
  { label: 'High', value: 'HIGH' },
  { label: 'Urgent', value: 'URGENT' },
]

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    OPEN: 'badge badge-warning',
    IN_PROGRESS: 'badge badge-info',
    RESOLVED: 'badge badge-success',
    CLOSED: 'badge badge-default',
  }
  return <span className={variants[status] || 'badge'}>{status.replace(/_/g, ' ')}</span>
}

function PriorityBadge({ priority }: { priority: string }) {
  const icons: Record<string, React.ReactNode> = {
    LOW: <Clock size={12} />,
    NORMAL: <Clock size={12} />,
    HIGH: <AlertTriangle size={12} />,
    URGENT: <AlertTriangle size={12} />,
  }
  const colors: Record<string, string> = {
    LOW: 'text-muted-foreground',
    NORMAL: 'text-blue-500',
    HIGH: 'text-amber-500',
    URGENT: 'text-destructive',
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${colors[priority]}`}>
      {icons[priority]}
      {priority}
    </span>
  )
}

export function SupportTicketList() {
  const qc = useQueryClient()
  const addNotification = useNotificationStore((s) => s.addNotification)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assigningTicket, setAssigningTicket] = useState<SupportTicket | null>(null)
  const [resolvingTicket, setResolvingTicket] = useState<SupportTicket | null>(null)

  const { data, isLoading, refetch } = useQuery<{
    items: SupportTicket[]
    total: number
  }>({
    queryKey: ['telegram-support-tickets', statusFilter, priorityFilter],
    queryFn: () =>
      telegramApi
        .getSupportTickets({
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
        })
        .then((r) => r.data),
    staleTime: 30000,
    refetchInterval: 30000,
  })

  // WebSocket simulation for real-time ticket notifications
  useEffect(() => {
    const handleWsMessage = (event: Event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data)
        if (data.type === 'SUPPORT_TICKET_CREATED' || data.type === 'driver:support:ticket') {
          toast.info(`New support ticket from ${data.driver_name || 'driver'}`, {
            duration: 5000,
          })
          addNotification({
            type: 'SYSTEM',
            title: 'New Support Ticket',
            message: data.message || 'A driver has created a support ticket',
            data,
          })
          qc.invalidateQueries({ queryKey: ['telegram-support-tickets'] })
        }
      } catch {
        // ignore parse errors
      }
    }

    // Listen to WebSocket messages on window (broadcast channel from useAdminWebSocket)
    window.addEventListener('websocket-message', handleWsMessage)
    return () => window.removeEventListener('websocket-message', handleWsMessage)
  }, [qc, addNotification])

  const assignMutation = useMutation({
    mutationFn: ({ id, assignedTo }: { id: string; assignedTo: string }) =>
      telegramApi.assignTicket(id, assignedTo),
    onSuccess: () => {
      toast.success('Ticket assigned successfully')
      setAssigningTicket(null)
      qc.invalidateQueries({ queryKey: ['telegram-support-tickets'] })
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to assign ticket'))
    },
  })

  const resolveMutation = useMutation({
    mutationFn: (id: string) => telegramApi.updateTicket(id, { status: 'RESOLVED' }),
    onSuccess: () => {
      toast.success('Ticket resolved')
      setResolvingTicket(null)
      qc.invalidateQueries({ queryKey: ['telegram-support-tickets'] })
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to resolve ticket'))
    },
  })

  const items = data?.items || []
  const total = data?.total || 0

  const columns = [
    {
      key: 'ticket_id',
      label: 'Ticket ID',
      render: (r: SupportTicket) => (
        <span className="font-mono text-xs">{r.ticket_id}</span>
      ),
    },
    {
      key: 'driver',
      label: 'Driver',
      render: (r: SupportTicket) => (
        <div>
          <div className="text-sm font-medium">{r.driver_name || 'Unknown'}</div>
          <div className="text-xs text-muted-foreground">{r.driver_id_code}</div>
        </div>
      ),
    },
    {
      key: 'message',
      label: 'Message',
      render: (r: SupportTicket) => (
        <div className="max-w-[280px] truncate text-sm" title={r.message}>
          {r.message}
        </div>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (r: SupportTicket) => <PriorityBadge priority={r.priority} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: SupportTicket) => <StatusBadge status={r.status} />,
    },
    {
      key: 'assigned_to',
      label: 'Assigned To',
      render: (r: SupportTicket) => (
        <span className="text-sm">{r.assigned_to_name || 'Unassigned'}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (r: SupportTicket) =>
        format(new Date(r.created_at), 'MMM d, HH:mm'),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Support Tickets"
        subtitle={`${total} total tickets`}
        actions={
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => refetch()} title="Refresh">
            <RefreshCw size={14} />
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-4 mb-5">
        <FilterDropdown
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
          placeholder="All Statuses"
        />
        <FilterDropdown
          value={priorityFilter}
          onChange={setPriorityFilter}
          options={PRIORITY_OPTIONS}
          placeholder="All Priorities"
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          data={items}
          loading={isLoading}
          rowKey="id"
          emptyMessage="No support tickets found"
          columns={columns}
          actions={(row: SupportTicket) => (
            <>
              {row.status === 'OPEN' && (
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setAssigningTicket(row)
                  }}
                  title="Assign to me"
                >
                  <UserCheck size={13} />
                </button>
              )}
              {(row.status === 'OPEN' || row.status === 'IN_PROGRESS') && (
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setResolvingTicket(row)
                  }}
                  title="Resolve"
                >
                  <CheckCircle2 size={13} className="text-emerald-500" />
                </button>
              )}
            </>
          )}
        />
      </div>

      {/* Assign Dialog */}
      <ConfirmDialog
        open={!!assigningTicket}
        title="Assign Ticket"
        message={`Assign ticket ${assigningTicket?.ticket_id} to yourself?`}
        onConfirm={() => {
          if (assigningTicket) {
            // Use current user id from localStorage or a default
            const userId = 'current-user'
            assignMutation.mutate({ id: assigningTicket.id, assignedTo: userId })
          }
        }}
        onCancel={() => setAssigningTicket(null)}
        loading={assignMutation.isPending}
        confirmLabel="Assign"
      />

      {/* Resolve Dialog */}
      <ConfirmDialog
        open={!!resolvingTicket}
        title="Resolve Ticket"
        message={`Mark ticket ${resolvingTicket?.ticket_id} as resolved?`}
        onConfirm={() => {
          if (resolvingTicket) {
            resolveMutation.mutate(resolvingTicket.id)
          }
        }}
        onCancel={() => setResolvingTicket(null)}
        loading={resolveMutation.isPending}
        variant="primary"
        confirmLabel="Resolve"
      />
    </div>
  )
}
