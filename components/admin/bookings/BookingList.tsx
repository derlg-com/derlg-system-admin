'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  Eye,
  UserCheck,
  XCircle,
} from 'lucide-react'
import { bookingsApi, assignmentsApi, driversApi, unwrapList } from '@/lib/api'
import { getApiErrorMessage } from '@/lib/utils'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput, FilterDropdown, PageHeader, Modal, FormField, ConfirmDialog } from '@/components/shared'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'

interface BookingItemSummary {
  bookingType: string
}

interface Booking {
  id: string
  reference: string
  user?: { id: string; fullName: string | null; email: string; phone: string | null }
  userId: string
  status: string
  startDate: string
  totalUsd: number
  // The admin bookings list endpoint does not include line items, and the type
  // lives on items[].bookingType (not on the booking), so this is optional and
  // usually absent here.
  items?: BookingItemSummary[]
}

interface AssignableDriver {
  id: string
  driverName: string
  phone: string
  telegramId?: string | null
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

  const { data, isLoading } = useQuery({
    queryKey: ['admin-bookings', statusFilter, typeFilter, aiFilter],
    queryFn: () => {
      const params: Record<string, unknown> = {}
      if (statusFilter) params.status = statusFilter
      if (typeFilter) params.booking_type = typeFilter
      // ai_assisted is validated with @IsBooleanString server-side, so it must
      // be the string 'true'/'false', not a JS boolean.
      if (aiFilter === 'ai') params.ai_assisted = 'true'
      if (aiFilter === 'manual') params.ai_assisted = 'false'
      // Admin lists return { data, meta }; the axios interceptor unwraps one
      // level, so response.data is that object (not an array). unwrapList
      // normalises it so the .filter() below cannot throw.
      return bookingsApi.list(params).then(unwrapList<Booking>)
    },
    staleTime: 30000,
  })
  const bookings = data?.items ?? []

  const { data: driversData } = useQuery({
    queryKey: ['admin-drivers-available'],
    queryFn: () =>
      driversApi.list({ status: 'AVAILABLE' }).then(unwrapList<AssignableDriver>),
    enabled: showAssign,
  })
  const availableDrivers = driversData?.items ?? []

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
    // AssignDriverDto expects camelCase driverId/bookingId; vehicleId is optional
    // and omitted here — this dialog has no vehicle picker, so the backend defaults
    // to the driver's own assigned vehicle.
    mutationFn: (d: { driverId: string; bookingId: string; vehicleId?: string }) =>
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

  const filtered = bookings.filter((b) => {
    if (!search) return true
    return (
      b.reference?.toLowerCase().includes(search.toLowerCase()) ||
      b.user?.email?.toLowerCase().includes(search.toLowerCase())
    )
  })

  // Booking type lives on the line items; the list endpoint omits them, so this
  // returns [] and the Type column falls back to '—' rather than crashing on
  // r.booking_type.replace(...).
  const bookingItemTypes = (b: Booking): string[] =>
    Array.from(new Set((b.items ?? []).map((i) => i.bookingType)))


  const columns = [
    {
      key: 'reference',
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
            {r.reference}
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
          <p className="text-sm font-medium">{r.user?.fullName || r.userId}</p>
          {r.user?.email && (
            <p className="text-xs text-muted-foreground">{r.user.email}</p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (r: Booking) => {
        const types = bookingItemTypes(r)
        return (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {types.length ? types.map((t) => t.replace(/_/g, ' ')).join(', ') : '—'}
          </span>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: Booking) => {
        // BookingStatus enum members are lowercase, so the colour map must be
        // keyed on them — the old UPPERCASE keys never matched and every badge
        // rendered grey.
        const colors: Record<string, { text: string; bg: string }> = {
          hold: { text: 'var(--warning)', bg: 'var(--warning-muted)' },
          pending_payment: { text: 'var(--warning)', bg: 'var(--warning-muted)' },
          confirmed: { text: 'var(--success)', bg: 'var(--success-muted)' },
          completed: { text: 'var(--info)', bg: 'var(--info-muted)' },
          cancelled: { text: 'var(--danger)', bg: 'var(--danger-muted)' },
          expired: { text: 'var(--text-muted)', bg: 'var(--bg-elevated)' },
          payment_failed: { text: 'var(--danger)', bg: 'var(--danger-muted)' },
          no_show: { text: 'var(--text-muted)', bg: 'var(--bg-elevated)' },
        }
        const cfg = colors[r.status] || { text: 'var(--text-muted)', bg: 'var(--bg-elevated)' }
        return (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ color: cfg.text, background: cfg.bg }}
          >
            {r.status.replace(/_/g, ' ')}
          </span>
        )
      },
    },
    {
      key: 'startDate',
      label: 'Travel Date',
      sortable: true,
      render: (r: Booking) =>
        r.startDate ? format(parseISO(r.startDate), 'MMM d, yyyy') : '—',
    },
    {
      key: 'totalUsd',
      label: 'Total',
      sortable: true,
      render: (r: Booking) => `$${Number(r.totalUsd).toFixed(2)}`,
    },
  ]

  return (
    <div>
      <PageHeader title="Bookings" subtitle={`${data?.meta.total ?? 0} total bookings`} />

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
            { label: 'Hold', value: 'hold' },
            { label: 'Pending Payment', value: 'pending_payment' },
            { label: 'Confirmed', value: 'confirmed' },
            { label: 'Completed', value: 'completed' },
            { label: 'Cancelled', value: 'cancelled' },
            { label: 'Expired', value: 'expired' },
            { label: 'Payment Failed', value: 'payment_failed' },
            { label: 'No Show', value: 'no_show' },
          ]}
        />
        <FilterDropdown
          value={typeFilter}
          onChange={setTypeFilter}
          placeholder="All Types"
          options={[
            { label: 'Trip Package', value: 'trip_package' },
            { label: 'Hotel Room', value: 'hotel_room' },
            { label: 'Transportation', value: 'transportation' },
            { label: 'Tour Guide', value: 'tour_guide' },
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
              {bookingItemTypes(row).includes('transportation') &&
                ['hold', 'pending_payment', 'confirmed'].includes(row.status) && (
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
              {['hold', 'pending_payment', 'confirmed'].includes(row.status) && (
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
                  driverId: assignDriverId,
                  bookingId: selected?.id || '',
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
                {d.driverName} ({d.phone})
                {d.telegramId ? ' · Telegram' : ''}
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
        message={`Are you sure you want to cancel booking ${selected?.reference}? This will process a refund if payment was made.`}
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
