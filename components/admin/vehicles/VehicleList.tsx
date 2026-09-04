'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Edit2,
  Eye,
  Trash2,
  Wrench,
} from 'lucide-react'
import { vehiclesApi, unwrapList } from '@/lib/api'
import { getApiErrorMessage } from '@/lib/utils'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput, FilterDropdown, PageHeader, Modal, ConfirmDialog } from '@/components/shared'
import { VehicleForm, type VehicleFormData } from './VehicleForm'
import { MaintenanceScheduler } from './MaintenanceScheduler'
import { toast } from 'sonner'

interface Vehicle {
  id: string
  name: string
  vehicleType: 'tuk_tuk' | 'van' | 'bus'
  licensePlate?: string | null
  capacity: number
  pricingModel: 'per_day' | 'per_km'
  // Decimal column, serialised as a string by Prisma — coerce with Number() to format.
  priceUsd: number | string
  province?: string
  images?: string[]
  isActive?: boolean
  createdAt?: string
  // Only the vehicle detail endpoint includes this; the list leaves it undefined.
  assignedDriver?: { id: string; driverName: string } | null
}

/** Wire payload for create/update — camelCase, matching the admin API. */
interface VehiclePayload {
  name: string
  vehicleType: string
  licensePlate?: string
  capacity: number
  pricingModel: string
  priceUsd: number
  province: string
  images: string[]
}

export function VehicleList() {
  const router = useRouter()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [deactivating, setDeactivating] = useState<Vehicle | null>(null)
  const [schedulingMaintenance, setSchedulingMaintenance] = useState<Vehicle | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-vehicles', categoryFilter, tierFilter],
    queryFn: () => {
      const params: Record<string, unknown> = {}
      if (categoryFilter) params.category = categoryFilter
      if (tierFilter) params.tier = tierFilter
      // Admin lists return `{ data, meta }`; unwrapList normalises to `{ items, meta }`.
      return vehiclesApi.list(params).then(unwrapList<Vehicle>)
    },
    staleTime: 30000,
  })

  const vehicles = data?.items ?? []

  const mutation = useMutation({
    mutationFn: (d: VehiclePayload) =>
      editing
        ? vehiclesApi.update(editing.id, d)
        : vehiclesApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-vehicles'] })
      setShowForm(false)
      setEditing(null)
      toast.success(editing ? 'Vehicle updated successfully' : 'Vehicle created successfully')
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to save vehicle'))
    },
  })

  // Deactivate mutation — soft delete (booking history references the row).
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => vehiclesApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-vehicles'] })
      setDeactivating(null)
      toast.success('Vehicle deactivated successfully')
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to deactivate vehicle'))
    },
  })

  const filtered = vehicles.filter((v) =>
    !search || v.name?.toLowerCase().includes(search.toLowerCase())
  )

  const openEdit = (vehicle: Vehicle) => {
    setEditing(vehicle)
    setShowForm(true)
  }

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }

  const handleFormSubmit = (formData: VehicleFormData) => {
    // Map the form's snake_case fields to the backend's camelCase DTO. `features`
    // is intentionally dropped: Create/UpdateVehicleDto declares no such field and
    // forbidNonWhitelisted would 400 the request if it were sent.
    const payload: VehiclePayload = {
      name: formData.name,
      vehicleType: formData.vehicle_type,
      licensePlate: formData.license_plate || undefined,
      capacity: formData.capacity,
      pricingModel: formData.pricing_model,
      priceUsd: formData.price_usd,
      province: formData.province,
      images: formData.images,
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
      key: 'name',
      label: <span style={{ display: 'inline-block', paddingLeft: 32 }}>Name</span>,
      sortable: true,
      render: (r: Vehicle) => <div style={{ paddingLeft: 32 }}>{r.name ?? '—'}</div>,
    },
    {
      key: 'vehicleType',
      label: 'Category',
      render: (r: Vehicle) => (
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {r.vehicleType.replace(/_/g, ' ')}
        </span>
      ),
    },
    { key: 'capacity', label: 'Capacity', sortable: true },
    {
      key: 'pricingModel',
      label: 'Pricing',
      render: (r: Vehicle) => (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-slate-400/10 text-slate-400">
          {r.pricingModel.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'priceUsd',
      label: 'Price (USD)',
      // priceUsd is a Prisma Decimal serialised as a string — coerce before formatting.
      render: (r: Vehicle) => `$${Number(r.priceUsd ?? 0).toFixed(2)}`,
    },
    {
      key: 'assignedDriver',
      label: 'Assigned Driver',
      render: (r: Vehicle) => r.assignedDriver?.driverName || '—',
    },
  ]

  return (
    <div>
      <PageHeader
        title="Vehicles"
        subtitle={`${vehicles.length} total vehicles`}
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} /> Add Vehicle
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name…"
          style={{ minWidth: 240 }}
        />
        <FilterDropdown
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { label: 'All Categories', value: '' },
            { label: 'Van', value: 'van' },
            { label: 'Bus', value: 'bus' },
            { label: 'Tuk Tuk', value: 'tuk_tuk' },
          ]}
          placeholder="All Categories"
        />
        <FilterDropdown
          value={tierFilter}
          onChange={setTierFilter}
          options={[
            { label: 'All Tiers', value: '' },
            // 'Standard' removed — Prisma VehicleTier is normal | vip, no STANDARD member.
            { label: 'VIP', value: 'vip' },
          ]}
          placeholder="All Tiers"
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          data={filtered}
          loading={isLoading}
          rowKey="id"
          emptyMessage="No vehicles found"
          columns={columns}
          onRowClick={(row) => router.push(`/admin/vehicles/${row.id}`)}
          actions={(row) => (
            <>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(`/admin/vehicles/${row.id}`)
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
                  setSchedulingMaintenance(row)
                }}
                title="Schedule Maintenance"
              >
                <Wrench size={13} />
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
        title={editing ? 'Edit Vehicle' : 'Add Vehicle'}
        onClose={() => {
          setShowForm(false)
          setEditing(null)
        }}
        maxWidth={720}
        footer={null}
      >
        <VehicleForm
          isEditing={!!editing}
          defaultValues={
            editing
              ? {
                  name: editing.name,
                  vehicle_type: editing.vehicleType,
                  license_plate: editing.licensePlate ?? '',
                  capacity: editing.capacity,
                  pricing_model: editing.pricingModel,
                  price_usd: Number(editing.priceUsd ?? 0),
                  province: editing.province || '',
                  features: [],
                  images: editing.images || [],
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

      {/* Maintenance Scheduler Modal */}
      <Modal
        open={!!schedulingMaintenance}
        title={`Schedule Maintenance — ${schedulingMaintenance?.name}`}
        onClose={() => setSchedulingMaintenance(null)}
        maxWidth={560}
        footer={null}
      >
        {schedulingMaintenance && (
          <MaintenanceScheduler
            vehicleId={schedulingMaintenance.id}
            onScheduled={() => setSchedulingMaintenance(null)}
          />
        )}
      </Modal>

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        open={!!deactivating}
        title="Deactivate Vehicle"
        message={`Deactivate ${deactivating?.name}? It will be hidden from new bookings and dispatch, but existing booking history is preserved.`}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivating(null)}
        loading={deactivateMutation.isPending}
        variant="danger"
        confirmLabel="Deactivate"
      />
    </div>
  )
}
