'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Plus, Edit2, Eye, BedDouble, Trash2, Star } from 'lucide-react'
import { hotelsApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput, PageHeader, ConfirmDialog } from '@/components/shared'
import { HotelForm, type HotelFormData } from './HotelForm'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface Hotel {
  id: string
  name: string
  description?: string
  location?: { lat: number; lng: number }
  latitude?: number
  longitude?: number
  images?: string[]
  rating?: number
  star_rating?: number
  amenities?: string[]
  check_in_time?: string
  check_out_time?: string
  cancellation_policy?: string
  room_count?: number
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export function HotelList() {
  const qc = useQueryClient()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Hotel | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Hotel | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-hotels'],
    queryFn: () => hotelsApi.list().then((r) => r.data as Hotel[]),
    staleTime: 30000,
  })

  const createMutation = useMutation({
    mutationFn: (d: HotelFormData) => hotelsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hotels'] })
      setShowForm(false)
      toast.success('Hotel created successfully')
    },
    onError: () => toast.error('Failed to create hotel'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: HotelFormData }) =>
      hotelsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hotels'] })
      setShowForm(false)
      setEditing(null)
      toast.success('Hotel updated successfully')
    },
    onError: () => toast.error('Failed to update hotel'),
  })

  /*
   * Unpublish, not delete.
   *
   * This called `hotelsApi.delete(id)`, which existed on neither the API client
   * nor the backend — there is no DELETE /admin/hotels/:id — so the button threw
   * a TypeError. Hotels are referenced by bookings through their rooms, so hard
   * deletion would orphan history; `isPublished: false` removes it from the
   * public catalogue, which is what the update DTO exposes.
   */
  const deleteMutation = useMutation({
    mutationFn: (id: string) => hotelsApi.update(id, { isPublished: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hotels'] })
      setDeleteTarget(null)
      toast.success('Hotel unpublished successfully')
    },
    onError: () => toast.error('Failed to unpublish hotel'),
  })

  const filtered = data.filter((h: Hotel) => {
    if (!search) return true
    const term = search.toLowerCase()
    const locationStr = h.location
      ? `${h.location.lat}, ${h.location.lng}`
      : ''
    return (
      h.name?.toLowerCase().includes(term) ||
      locationStr.toLowerCase().includes(term)
    )
  })

  const openEdit = (h: Hotel) => {
    setEditing(h)
    setShowForm(true)
  }

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }

  const handleSubmit = (formData: HotelFormData) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditing(null)
  }

  const defaultFormValues: Partial<HotelFormData> | undefined = editing
    ? {
        name: editing.name,
        description: editing.description,
        latitude: editing.location?.lat ?? editing.latitude ?? 11.5564,
        longitude: editing.location?.lng ?? editing.longitude ?? 104.9282,
        images: editing.images,
        star_rating: editing.rating ?? editing.star_rating,
        amenities: editing.amenities,
        check_in_time: editing.check_in_time,
        check_out_time: editing.check_out_time,
        cancellation_policy: editing.cancellation_policy,
      }
    : undefined

  return (
    <div>
      <PageHeader
        title="Hotels"
        subtitle={`${data.length} hotels`}
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} /> Add Hotel
          </button>
        }
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name or location..."
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          data={filtered}
          loading={isLoading}
          rowKey="id"
          emptyMessage="No hotels found"
          columns={[
            {
              key: 'name',
              label: <span style={{ display: 'inline-block', paddingLeft: 32 }}>Hotel Name</span>,
              sortable: true,
              render: (r: Hotel) => (
                <div style={{ paddingLeft: 32 }} className="flex items-center gap-2">
                  {r.images && r.images.length > 0 ? (
                    <img
                      src={r.images[0]}
                      alt={r.name}
                      className="w-8 h-8 rounded object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                      <BedDouble size={14} className="text-muted-foreground" />
                    </div>
                  )}
                  <span className="font-medium">{r.name}</span>
                </div>
              ),
            },
            {
              key: 'location',
              label: 'Location',
              render: (r: Hotel) =>
                r.location
                  ? `${r.location.lat.toFixed(4)}, ${r.location.lng.toFixed(4)}`
                  : '-',
            },
            {
              key: 'rating',
              label: 'Rating',
              render: (r: Hotel) =>
                r.rating ? (
                  <span className="inline-flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={i < Math.round(r.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}
                      />
                    ))}
                    <span className="text-muted-foreground text-xs ml-1">
                      {r.rating}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                ),
            },
            {
              key: 'room_count',
              label: 'Rooms',
              render: (r: Hotel) => r.room_count ?? 0,
            },
            {
              key: 'check_in_time',
              label: 'Check-in',
              render: (r: Hotel) => r.check_in_time || '-',
            },
            {
              key: 'is_active',
              label: 'Status',
              render: (r: Hotel) => (
                <span
                  style={{
                    color: r.is_active !== false ? 'var(--success)' : 'var(--text-muted)',
                  }}
                >
                  {r.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              ),
            },
          ]}
          actions={(row: Hotel) => (
            <div className="flex items-center gap-1">
              <button
                className="btn btn-ghost btn-icon btn-sm tooltip-wrapper"
                onClick={() => router.push(`/admin/hotels/${row.id}`)}
                title="View Details"
              >
                <Eye size={13} />
              </button>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => router.push(`/admin/hotels/${row.id}/rooms`)}
                title="Manage Rooms"
              >
                <BedDouble size={13} />
              </button>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => openEdit(row)}
                title="Edit"
              >
                <Edit2 size={13} />
              </button>
              <button
                className="btn btn-ghost btn-icon btn-sm text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(row)}
                title="Unpublish"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        />
      </div>

      {/* Hotel Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-8 pb-5" style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 32 }}>
            <DialogTitle>
              {editing ? 'Edit Hotel' : 'Create Hotel'}
            </DialogTitle>
          </DialogHeader>
          <HotelForm
            defaultValues={defaultFormValues}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={createMutation.isPending || updateMutation.isPending}
            isEditing={!!editing}
          />
        </DialogContent>
      </Dialog>

      {/* Unpublish Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Unpublish Hotel"
        message={`Unpublish "${deleteTarget?.name}"? It will be hidden from the public catalogue and cannot be booked. Existing bookings are unaffected, and you can republish it later.`}
        confirmLabel="Unpublish"
        variant="danger"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
