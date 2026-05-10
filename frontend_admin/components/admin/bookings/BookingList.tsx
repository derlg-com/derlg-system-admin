'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, UserCheck, AlertCircle } from 'lucide-react'
import { bookingsApi, assignmentsApi, driversApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput, FilterDropdown, StatusBadge, PageHeader, Modal, FormField, ConfirmDialog } from '@/components/shared'
import { format } from 'date-fns'

export function BookingList() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [assignDriverId, setAssignDriverId] = useState('')

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-bookings', statusFilter, typeFilter],
    queryFn: () => bookingsApi.list({ status: statusFilter || undefined, booking_type: typeFilter || undefined }).then((r) => r.data),
    refetchInterval: 30_000,
  })

  const { data: availableDrivers = [] } = useQuery({
    queryKey: ['admin-drivers-available'],
    queryFn: () => driversApi.list({ status: 'AVAILABLE' }).then((r) => r.data),
    enabled: showAssign,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => bookingsApi.cancel(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-bookings'] }); setShowCancel(false); setSelected(null) },
  })

  const assignMutation = useMutation({
    mutationFn: (d: { driver_id: string; booking_id: string; vehicle_id: string }) => assignmentsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-bookings'] }); setShowAssign(false); setAssignDriverId('') },
  })

  const filtered = data.filter((b: any) => {
    if (!search) return true
    return b.booking_ref?.toLowerCase().includes(search.toLowerCase()) ||
      b.user?.email?.toLowerCase().includes(search.toLowerCase())
  })

  const openDetail = (b: any) => { setSelected(b); setShowDetail(true) }

  return (
    <div>
      <PageHeader title="Bookings" subtitle={`${data.length} total bookings`} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search booking ref or email…" style={{ flex: 1 }} />
        <FilterDropdown value={statusFilter} onChange={setStatusFilter} placeholder="All Statuses" options={[
          { label: 'Reserved', value: 'RESERVED' }, { label: 'Confirmed', value: 'CONFIRMED' },
          { label: 'Completed', value: 'COMPLETED' }, { label: 'Cancelled', value: 'CANCELLED' }, { label: 'Refunded', value: 'REFUNDED' },
        ]} />
        <FilterDropdown value={typeFilter} onChange={setTypeFilter} placeholder="All Types" options={[
          { label: 'Package', value: 'PACKAGE' }, { label: 'Hotel Only', value: 'HOTEL_ONLY' },
          { label: 'Transport Only', value: 'TRANSPORT_ONLY' }, { label: 'Guide Only', value: 'GUIDE_ONLY' },
        ]} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          data={filtered}
          loading={isLoading}
          rowKey="id"
          emptyMessage="No bookings found"
          onRowClick={openDetail}
          columns={[
            {
              key: 'booking_ref', label: 'Ref',
              render: (r) => <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--brand-primary)', background: 'var(--brand-primary-muted)', padding: '2px 8px', borderRadius: 4 }}>{r.booking_ref}</span>
            },
            { key: 'user', label: 'Customer', render: (r) => r.user?.name || r.user_id },
            { key: 'booking_type', label: 'Type', render: (r) => <StatusBadge status={r.booking_type} /> },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'travel_date', label: 'Travel Date', render: (r) => format(new Date(r.travel_date), 'MMM d, yyyy') },
            { key: 'total_usd', label: 'Total', render: (r) => `$${Number(r.total_usd).toFixed(2)}` },
          ]}
          actions={(row) => (
            <>
              {row.booking_type === 'TRANSPORT_ONLY' && row.status === 'CONFIRMED' && (
                <button className="btn btn-ghost btn-icon btn-sm" title="Assign Driver"
                  onClick={(e) => { e.stopPropagation(); setSelected(row); setShowAssign(true) }}>
                  <UserCheck size={13} color="var(--success)" />
                </button>
              )}
              {['RESERVED', 'CONFIRMED'].includes(row.status) && (
                <button className="btn btn-ghost btn-icon btn-sm" title="Cancel"
                  onClick={(e) => { e.stopPropagation(); setSelected(row); setShowCancel(true) }}>
                  <AlertCircle size={13} color="var(--danger)" />
                </button>
              )}
            </>
          )}
        />
      </div>

      {/* Detail Modal */}
      {selected && (
        <Modal open={showDetail} title={`Booking ${selected.booking_ref}`} onClose={() => { setShowDetail(false); setSelected(null) }} maxWidth={640}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              ['Type', selected.booking_type], ['Status', selected.status],
              ['Customer', selected.user?.name], ['Email', selected.user?.email],
              ['Travel Date', format(new Date(selected.travel_date), 'MMM d, yyyy')],
              ['End Date', selected.end_date ? format(new Date(selected.end_date), 'MMM d, yyyy') : '—'],
              ['Adults', selected.num_adults], ['Children', selected.num_children],
              ['Subtotal', `$${Number(selected.subtotal_usd).toFixed(2)}`],
              ['Discount', `$${Number(selected.discount_amount_usd || 0).toFixed(2)}`],
              ['Total', `$${Number(selected.total_usd).toFixed(2)}`],
            ].map(([label, value]) => (
              <div key={label as string}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{String(value ?? '—')}</div>
              </div>
            ))}
          </div>
          {selected.special_requests && (
            <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-elevated)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Special Requests</div>
              <div style={{ fontSize: 13 }}>{selected.special_requests}</div>
            </div>
          )}
        </Modal>
      )}

      {/* Assign Driver Modal */}
      <Modal open={showAssign} title="Assign Driver" onClose={() => setShowAssign(false)}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowAssign(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={!assignDriverId || assignMutation.isPending}
            onClick={() => assignMutation.mutate({ driver_id: assignDriverId, booking_id: selected?.id, vehicle_id: selected?.vehicle_id })}>
            {assignMutation.isPending ? 'Assigning…' : 'Assign Driver'}
          </button>
        </>}>
        <FormField label="Select Available Driver">
          <select className="form-select" value={assignDriverId} onChange={(e) => setAssignDriverId(e.target.value)}>
            <option value="">— Select driver —</option>
            {availableDrivers.map((d: any) => (
              <option key={d.id} value={d.id}>{d.driver_name} ({d.phone})</option>
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
        onConfirm={() => cancelMutation.mutate(selected?.id)}
        onCancel={() => { setShowCancel(false); setSelected(null) }}
        loading={cancelMutation.isPending}
      />
    </div>
  )
}
