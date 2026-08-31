'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Edit2,
  Eye,
  Trash2,
  UserCheck,
  AlertCircle,
  Bot,
  Loader2,
  XCircle,
} from 'lucide-react'
import { bookingsApi, assignmentsApi, driversApi } from '@/lib/api'
import { getApiErrorMessage } from '@/lib/utils'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput, FilterDropdown, PageHeader, Modal, FormField, ConfirmDialog } from '@/components/shared'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'

interface Booking {
  id: string
  booking_ref: string
  user?: { name: string; email: string }
  user_id: string
  booking_type: string
  status: string
  travel_date: string
  total_usd: number
  ai_assisted: boolean
  num_adults: number
  num_children: number
}

interface AssignableDriver {
  id: string
  driver_name: string
  phone: string
  telegram_id?: string | null
}

export function BookingList() {
  const router = useRouter()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [aiFilter, setAiFilter] = useState('')
  const [selected, setSelected] = useState<Booking | null>(null)
  const [showCancel, setShowCancel] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [assignDriverId, setAssignDriverId] = useState('')

  const { data = [], isLoading } = useQuery<Booking[]>({
    queryKey: ['admin-bookings', statusFilter, typeFilter, aiFilter],
    queryFn: () => {
      const params: Record<string, unknown> = {}
      if (statusFilter) params.status = statusFilter
      if (typeFilter) params.booking_type = typeFilter
      if (aiFilter === 'ai') params.ai_assisted = true
      if (aiFilter === 'manual') params.ai_assisted = false
      return bookingsApi.list(params).then((r) => r.data)
    },
    staleTime: 30000,
  })

  const { data: availableDrivers = [] } = useQuery<AssignableDriver[]>({
    queryKey: ['admin-drivers-available'],
    queryFn: () => driversApi.list({ status: 'AVAILABLE' }).then((r) => r.data),
    enabled: showAssign,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => bookingsApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-bookings'] })
      setShowCancel(false)
      setSelected(null)
      toast.success('Booking cancelled successfully')
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to cancel booking'))
    },
  })

  const assignMutation = useMutation({
    mutationFn: (d: { driver_id: string; booking_id: string; vehicle_id: string }) =>
      assignmentsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-bookings'] })
      setShowAssign(false)
      setAssignDriverId('')
      toast.success('Driver assigned successfully')
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to assign driver'))
    },
  })

  const filtered = data.filter((b) => {
    if (!search) return true
    return (
      b.booking_ref?.toLowerCase().includes(search.toLowerCase()) ||
      b.user?.email?.toLowerCase().includes(search.toLowerCase())
    )
  })


  const columns = [
    {
      key: 'booking_ref',
      label: <span style={{ display: 'inline-block', paddingLeft: 32 }}>Ref</span>,
      sortable: true,
      render: (r: Booking) => (
        <div style={{ paddingLeft: 32 }}>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              color: 'var(--brand-primary)',
              background: 'var(--brand-primary-muted)',
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            {r.booking_ref}
          </span>
        </div>
      ),
    },
    {
      key: 'user',
      label: 'Customer',
      headerClassName: 'whitespace-nowrap',
      render: (r: Booking) => (
        <div>
          <p className="text-sm font-medium">{r.user?.name || r.user_id}</p>
          {r.user?.email && (
            <p className="text-xs text-muted-foreground">{r.user.email}</p>
          )}
        </div>
      ),
    },
    {
      key: 'booking_type',
      label: 'Type',
      render: (r: Booking) => (
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {r.booking_type.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: Booking) => {
        const colors: Record<string, { text: string; bg: string }> = {
          RESERVED: { text: 'var(--warning)', bg: 'var(--warning-muted)' },
          CONFIRMED: { text: 'var(--success)', bg: 'var(--success-muted)' },
          COMPLETED: { text: 'var(--info)', bg: 'var(--info-muted)' },
          CANCELLED: { text: 'var(--danger)', bg: 'var(--danger-muted)' },
          REFUNDED: { text: 'var(--text-muted)', bg: 'var(--bg-elevated)' },
        }
        const cfg = colors[r.status] || { text: 'var(--text-muted)', bg: 'var(--bg-elevated)' }
        return (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ color: cfg.text, background: cfg.bg }}
          >
            {r.status}
          </span>
        )
      },
    },
    {
      key: 'travel_date',
      label: 'Travel Date',
      sortable: true,
      render: (r: Booking) =>
        r.travel_date ? format(parseISO(r.travel_date), 'MMM d, yyyy') : '—',
    },
    {
      key: 'total_usd',
      label: 'Total',
      sortable: true,
      render: (r: Booking) => `$${Number(r.total_usd).toFixed(2)}`,
    },
    {
      key: 'ai_assisted',
      label: 'AI',
      render: (r: Booking) =>
        r.ai_assisted ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-400/10 text-purple-400 px-2 py-0.5 text-xs">
            <Bot className="size-3" />
            AI
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Manual</span>
        ),
    },
  ]

  return (
    <div>
      <PageHeader title="Bookings" subtitle={`${data.length} total bookings`} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search booking ref or email…"
          style={{ minWidth: 240 }}
        />
        <FilterDropdown
          value={statusFilter}
          onChange={setStatusFilter}
          placeholder="All Statuses"
          options={[
            { label: 'Reserved', value: 'RESERVED' },
            { label: 'Confirmed', value: 'CONFIRMED' },
            { label: 'Completed', value: 'COMPLETED' },
            { label: 'Cancelled', value: 'CANCELLED' },
            { label: 'Refunded', value: 'REFUNDED' },
          ]}
        />
        <FilterDropdown
          value={typeFilter}
          onChange={setTypeFilter}
          placeholder="All Types"
          options={[
            { label: 'Package', value: 'PACKAGE' },
            { label: 'Hotel Only', value: 'HOTEL_ONLY' },
            { label: 'Transport Only', value: 'TRANSPORT_ONLY' },
            { label: 'Guide Only', value: 'GUIDE_ONLY' },
          ]}
        />
        <FilterDropdown
          value={aiFilter}
          onChange={setAiFilter}
          placeholder="AI / Manual"
          options={[
            { label: 'AI Assisted', value: 'ai' },
            { label: 'Manual', value: 'manual' },
          ]}
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          data={filtered}
          loading={isLoading}
          rowKey="id"
          emptyMessage="No bookings found"
          onRowClick={(row) => router.push(`/admin/bookings/${row.id}`)}
          columns={columns}
          actions={(row) => (
            <>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(`/admin/bookings/${row.id}`)
                }}
                title="View Details"
              >
                <Eye size={13} />
              </button>
              {row.booking_type === 'TRANSPORT_ONLY' &&
                ['RESERVED', 'CONFIRMED'].includes(row.status) && (
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    title="Assign Driver"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelected(row)
                      setShowAssign(true)
                    }}
                  >
                    <UserCheck size={13} color="var(--success)" />
                  </button>
                )}
              {['RESERVED', 'CONFIRMED'].includes(row.status) && (
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  title="Cancel"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelected(row)
                    setShowCancel(true)
                  }}
                >
                  <XCircle size={13} color="var(--danger)" />
                </button>
              )}
            </>
          )}
        />
      </div>

      {/* Assign Driver Modal */}
      <Modal
        open={showAssign}
        title="Assign Driver"
        onClose={() => {
          setShowAssign(false)
          setAssignDriverId('')
        }}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowAssign(false)
                setAssignDriverId('')
              }}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={!assignDriverId || assignMutation.isPending}
              onClick={() =>
                assignMutation.mutate({
                  driver_id: assignDriverId,
                  booking_id: selected?.id || '',
                  vehicle_id: '',
                })
              }
            >
              {assignMutation.isPending ? 'Assigning…' : 'Assign Driver'}
            </button>
          </>
        }
      >
        <FormField label="Select Available Driver">
          <select
            className="form-select"
            value={assignDriverId}
            onChange={(e) => setAssignDriverId(e.target.value)}
          >
            <option value="">— Select driver —</option>
            {availableDrivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.driver_name} ({d.phone})
                {d.telegram_id ? ' · Telegram' : ''}
              </option>
            ))}
          </select>
        </FormField>
        {assignMutation.isError && (
          <div className="alert alert-danger" style={{ marginTop: 12, fontSize: 12 }}>
            Failed to assign driver. Driver may no longer be available.
          </div>
        )}
      </Modal>

      {/* Cancel confirm */}
      <ConfirmDialog
        open={showCancel}
        title="Cancel Booking"
        message={`Are you sure you want to cancel booking ${selected?.booking_ref}? This will process a refund if payment was made.`}
        confirmLabel="Cancel Booking"
        onConfirm={() => selected && cancelMutation.mutate(selected.id)}
        onCancel={() => {
          setShowCancel(false)
          setSelected(null)
        }}
        loading={cancelMutation.isPending}
      />
    </div>
  )
}
