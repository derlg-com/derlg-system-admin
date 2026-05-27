'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Edit2,
  Eye,
  Trash2,
  Search,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import { driversApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput, FilterDropdown, PageHeader, Modal, ConfirmDialog } from '@/components/shared'
import { DriverStatusBadge } from './DriverStatusBadge'
import { DriverForm, type DriverFormData } from './DriverForm'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

interface Driver {
  id: string
  driver_name: string
  driver_id: string
  telegram_id?: string | null
  phone: string
  vehicle_id?: string | null
  vehicle_name?: string
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE'
  last_status_update?: string
  last_telegram_activity?: string | null
  created_at?: string
  updated_at?: string
}

function TelegramBadge({ driver }: { driver: Driver }) {
  const isRegistered = !!driver.telegram_id
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
  const [deleting, setDeleting] = useState<Driver | null>(null)

  // Fetch drivers
  const { data = [], isLoading } = useQuery<Driver[]>({
    queryKey: ['admin-drivers', statusFilter, telegramFilter],
    queryFn: () => {
      const params: Record<string, any> = {}
      if (statusFilter) params.status = statusFilter
      if (telegramFilter === 'registered') params.has_telegram = true
      if (telegramFilter === 'not_registered') params.has_telegram = false
      return driversApi.list(params).then((r) => r.data)
    },
    staleTime: 30000,
  })

  // Create / Update mutation
  const mutation = useMutation({
    mutationFn: (d: any) =>
      editing
        ? driversApi.update(editing.id, d)
        : driversApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-drivers'] })
      setShowForm(false)
      setEditing(null)
      toast.success(editing ? 'Driver updated successfully' : 'Driver created successfully')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to save driver')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => driversApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-drivers'] })
      setDeleting(null)
      toast.success('Driver deleted successfully')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to delete driver')
    },
  })

  // Client-side search filter
  const filtered = data.filter((d) =>
    !search ||
    d.driver_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.driver_id?.toLowerCase().includes(search.toLowerCase())
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
    const payload = {
      driverName: formData.driver_name,
      driverId: formData.driver_id,
      phone: formData.phone,
      telegramId: formData.telegram_id || undefined,
      vehicleId: formData.vehicle_id || undefined,
    }
    mutation.mutate(payload)
  }

  const handleDelete = () => {
    if (deleting) {
      deleteMutation.mutate(deleting.id)
    }
  }

  const columns = [
    {
      key: 'driver_name',
      label: <span style={{ display: 'inline-block', paddingLeft: 32 }}>Name</span>,
      sortable: true,
      render: (r: Driver) => <div style={{ paddingLeft: 32 }}>{r.driver_name ?? '—'}</div>,
    },
    { key: 'driver_id', label: 'Driver ID', sortable: true },
    {
      key: 'vehicle_name',
      label: 'Vehicle',
      render: (r: Driver) => r.vehicle_name || '—',
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
      key: 'last_telegram_activity',
      label: 'Last Seen',
      render: (r: Driver) =>
        r.last_telegram_activity
          ? formatDistanceToNow(new Date(r.last_telegram_activity), { addSuffix: true })
          : '—',
    },
    {
      key: 'last_status_update',
      label: 'Last Update',
      render: (r: Driver) =>
        r.last_status_update
          ? formatDistanceToNow(new Date(r.last_status_update), { addSuffix: true })
          : '—',
    },
  ]

  return (
    <div>
      <PageHeader
        title="Drivers"
        subtitle={`${data.length} total drivers`}
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
                  setDeleting(row)
                }}
                title="Delete"
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
                  driver_name: editing.driver_name,
                  driver_id: editing.driver_id,
                  phone: editing.phone,
                  telegram_id: editing.telegram_id || '',
                  vehicle_id: editing.vehicle_id || '',
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

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleting}
        title="Delete Driver"
        message={`Are you sure you want to delete ${deleting?.driver_name}? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        loading={deleteMutation.isPending}
        variant="danger"
        confirmLabel="Delete"
      />
    </div>
  )
}
