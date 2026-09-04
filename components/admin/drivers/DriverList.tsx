'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Edit2,
  Eye,
  Trash2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { driversApi, unwrapList } from '@/lib/api'
import { getApiErrorMessage } from '@/lib/utils'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput, FilterDropdown, PageHeader, Modal, ConfirmDialog } from '@/components/shared'
import { DriverStatusBadge } from './DriverStatusBadge'
import { DriverForm, type DriverFormData } from './DriverForm'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

interface Driver {
  id: string
  driverName: string
  driverId: string
  // bigint column, serialised to a string by the backend's BigInt JSON shim.
  telegramId?: string | null
  phone: string
  vehicleId?: string | null
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE'
  lastStatusUpdate?: string
  lastTelegramActivity?: string | null
  createdAt?: string
  updatedAt?: string
  // Included by the backend list query so the table can render the Vehicle column.
  vehicle?: { id: string; name: string; licensePlate?: string | null } | null
}

/** Wire payload for create/update — camelCase, matching the admin API. */
interface DriverPayload {
  driverName: string
  driverId: string
  phone: string
  telegramId?: string
  vehicleId?: string | null
}

function TelegramBadge({ driver }: { driver: Driver }) {
  const isRegistered = !!driver.telegramId
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        background: isRegistered ? 'var(--success-muted)' : 'var(--bg-elevated)',
        color: isRegistered ? 'var(--success)' : 'var(--text-muted)',
      }}
    >
      {isRegistered ? (
        <>
          <CheckCircle2 className="size-3" /> Registered
        </>
      ) : (
        <>
          <XCircle className="size-3" /> Not Registered
        </>
      )}
    </span>
  )
}

export function DriverList() {
  const router = useRouter()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [telegramFilter, setTelegramFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Driver | null>(null)
  const [deactivating, setDeactivating] = useState<Driver | null>(null)

  // Fetch drivers
  const { data, isLoading } = useQuery({
    queryKey: ['admin-drivers', statusFilter, telegramFilter],
    queryFn: () => {
      const params: Record<string, unknown> = {}
      if (statusFilter) params.status = statusFilter
      // Backend validates has_telegram with @IsBooleanString: it must be the
      // string 'true'/'false', not a boolean, or the whole request 400s.
      if (telegramFilter === 'registered') params.has_telegram = 'true'
      if (telegramFilter === 'not_registered') params.has_telegram = 'false'
      // Admin lists return `{ data, meta }`; unwrapList normalises to `{ items, meta }`.
      return driversApi.list(params).then(unwrapList<Driver>)
    },
    staleTime: 30000,
  })

  const drivers = data?.items ?? []

  // Create / Update mutation
  const mutation = useMutation({
    mutationFn: (d: DriverPayload) =>
      editing
        ? driversApi.update(editing.id, d)
        : driversApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-drivers'] })
      setShowForm(false)
      setEditing(null)
      toast.success(editing ? 'Driver updated successfully' : 'Driver created successfully')
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to save driver'))
    },
  })

  // Deactivate mutation — soft delete (assignment history references the row).
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => driversApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-drivers'] })
      setDeactivating(null)
      toast.success('Driver deactivated successfully')
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to deactivate driver'))
    },
  })

  // Client-side search filter
  const filtered = drivers.filter((d) =>
    !search ||
    d.driverName?.toLowerCase().includes(search.toLowerCase()) ||
    d.driverId?.toLowerCase().includes(search.toLowerCase())
  )


  const openEdit = (driver: Driver) => {
    setEditing(driver)
    setShowForm(true)
  }

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }

  const handleFormSubmit = (formData: DriverFormData) => {
    const payload: DriverPayload = {
      driverName: formData.driver_name,
      driverId: formData.driver_id,
      phone: formData.phone,
      telegramId: formData.telegram_id || undefined,
      vehicleId: formData.vehicle_id ? formData.vehicle_id : (editing ? null : undefined),
    }
    mutation.mutate(payload)
  }

  const handleDeactivate = () => {
    if (deactivating) {
      deactivateMutation.mutate(deactivating.id)
    }
  }

  const columns = [
    {
      key: 'driverName',
      label: <span style={{ display: 'inline-block', paddingLeft: 32 }}>Name</span>,
      sortable: true,
      render: (r: Driver) => <div style={{ paddingLeft: 32 }}>{r.driverName ?? '—'}</div>,
    },
    { key: 'driverId', label: 'Driver ID', sortable: true },
    {
      key: 'vehicle',
      label: 'Vehicle',
      render: (r: Driver) => r.vehicle?.name || '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: Driver) => <DriverStatusBadge status={r.status} pulsing />,
    },
    {
      key: 'telegram_status',
      label: 'Telegram',
      render: (r: Driver) => <TelegramBadge driver={r} />,
    },
    {
      key: 'lastTelegramActivity',
      label: 'Last Seen',
      render: (r: Driver) =>
        r.lastTelegramActivity
          ? formatDistanceToNow(new Date(r.lastTelegramActivity), { addSuffix: true })
          : '—',
    },
    {
      key: 'lastStatusUpdate',
      label: 'Last Update',
      render: (r: Driver) =>
        r.lastStatusUpdate
          ? formatDistanceToNow(new Date(r.lastStatusUpdate), { addSuffix: true })
          : '—',
    },
  ]

  return (
    <div>
      <PageHeader
        title="Drivers"
        subtitle={`${drivers.length} total drivers`}
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} /> Add Driver
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name or ID…"
          style={{ minWidth: 240 }}
        />
        <FilterDropdown
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { label: 'All Statuses', value: '' },
            { label: 'Available', value: 'AVAILABLE' },
            { label: 'Busy', value: 'BUSY' },
            { label: 'Offline', value: 'OFFLINE' },
          ]}
          placeholder="All Statuses"
        />
        <FilterDropdown
          value={telegramFilter}
          onChange={setTelegramFilter}
          options={[
            { label: 'All', value: '' },
            { label: 'Registered', value: 'registered' },
            { label: 'Not Registered', value: 'not_registered' },
          ]}
          placeholder="Telegram Status"
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          data={filtered}
          loading={isLoading}
          rowKey="id"
          emptyMessage="No drivers found"
          columns={columns}
          onRowClick={(row) => router.push(`/admin/drivers/${row.id}`)}
          actions={(row) => (
            <>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(`/admin/drivers/${row.id}`)
                }}
                title="View Details"
              >
                <Eye size={13} />
              </button>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  openEdit(row)
                }}
                title="Edit"
              >
                <Edit2 size={13} />
              </button>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeactivating(row)
                }}
                title="Deactivate"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        />
      </div>

      {/* Form Modal */}
      <Modal
        open={showForm}
        title={editing ? 'Edit Driver' : 'Add Driver'}
        onClose={() => {
          setShowForm(false)
          setEditing(null)
        }}
        maxWidth={640}
        footer={null}
      >
        <DriverForm
          isEditing={!!editing}
          defaultValues={
            editing
              ? {
                  driver_name: editing.driverName,
                  driver_id: editing.driverId,
                  phone: editing.phone,
                  telegram_id: editing.telegramId || '',
                  vehicle_id: editing.vehicleId || '',
                }
              : undefined
          }
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setShowForm(false)
            setEditing(null)
          }}
          loading={mutation.isPending}
        />
      </Modal>

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        open={!!deactivating}
        title="Deactivate Driver"
        message={`Deactivate ${deactivating?.driverName}? They will be set OFFLINE and hidden from dispatch. Their assignment history is preserved.`}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivating(null)}
        loading={deactivateMutation.isPending}
        variant="danger"
        confirmLabel="Deactivate"
      />
    </div>
  )
}
