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
  Loader2,
} from 'lucide-react'
import { vehiclesApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput, FilterDropdown, PageHeader, Modal, ConfirmDialog } from '@/components/shared'
import { VehicleForm, type VehicleFormData } from './VehicleForm'
import { MaintenanceScheduler } from './MaintenanceScheduler'
import { toast } from 'sonner'

interface Vehicle {
  id: string
  name: string
  category: 'VAN' | 'BUS' | 'TUK_TUK'
  capacity: number
  tier: 'STANDARD' | 'VIP'
  price_per_day: number
  price_per_km?: number
  features?: string[]
  images?: string[]
  assigned_driver?: { id: string; driver_name: string }
  created_at?: string
}

export function VehicleList() {
  const router = useRouter()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [deleting, setDeleting] = useState<Vehicle | null>(null)
  const [schedulingMaintenance, setSchedulingMaintenance] = useState<Vehicle | null>(null)

  const { data = [], isLoading } = useQuery<Vehicle[]>({
    queryKey: ['admin-vehicles', categoryFilter, tierFilter],
    queryFn: () => {
      const params: Record<string, any> = {}
      if (categoryFilter) params.category = categoryFilter
      if (tierFilter) params.tier = tierFilter
      return vehiclesApi.list(params).then((r) => r.data)
    },
    staleTime: 30000,
  })

  const mutation = useMutation({
    mutationFn: (d: VehicleFormData) =>
      editing
        ? vehiclesApi.update(editing.id, d)
        : vehiclesApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-vehicles'] })
      setShowForm(false)
      setEditing(null)
      toast.success(editing ? 'Vehicle updated successfully' : 'Vehicle created successfully')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to save vehicle')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vehiclesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-vehicles'] })
      setDeleting(null)
      toast.success('Vehicle deleted successfully')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to delete vehicle')
    },
  })

  const filtered = data.filter((v) =>
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
    mutation.mutate(formData)
  }

  const handleDelete = () => {
    if (deleting) {
      deleteMutation.mutate(deleting.id)
    }
  }

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    {
      key: 'category',
      label: 'Category',
      render: (r: Vehicle) => (
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {r.category.replace(/_/g, ' ')}
        </span>
      ),
    },
    { key: 'capacity', label: 'Capacity', sortable: true },
    {
      key: 'tier',
      label: 'Tier',
      render: (r: Vehicle) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            r.tier === 'VIP'
              ? 'bg-amber-400/10 text-amber-400'
              : 'bg-slate-400/10 text-slate-400'
          }`}
        >
          {r.tier}
        </span>
      ),
    },
    {
      key: 'price_per_day',
      label: 'Price/Day',
      render: (r: Vehicle) => `$${r.price_per_day?.toFixed(2) || '0.00'}`,
    },
    {
      key: 'assigned_driver',
      label: 'Assigned Driver',
      render: (r: Vehicle) => r.assigned_driver?.driver_name || '—',
    },
  ]

  return (
    <div>
      <PageHeader
        title="Vehicles"
        subtitle={`${data.length} total vehicles`}
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} /> Add Vehicle
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
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
            { label: 'Van', value: 'VAN' },
            { label: 'Bus', value: 'BUS' },
            { label: 'Tuk Tuk', value: 'TUK_TUK' },
          ]}
          placeholder="All Categories"
        />
        <FilterDropdown
          value={tierFilter}
          onChange={setTierFilter}
          options={[
            { label: 'Standard', value: 'STANDARD' },
            { label: 'VIP', value: 'VIP' },
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
                  category: editing.category,
                  capacity: editing.capacity,
                  tier: editing.tier,
                  price_per_day: editing.price_per_day,
                  price_per_km: editing.price_per_km,
                  features: editing.features || [],
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

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleting}
        title="Delete Vehicle"
        message={`Are you sure you want to delete ${deleting?.name}? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        loading={deleteMutation.isPending}
        variant="danger"
        confirmLabel="Delete"
      />
    </div>
  )
}
