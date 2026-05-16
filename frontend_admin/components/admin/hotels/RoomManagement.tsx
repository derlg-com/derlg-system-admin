'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Plus, Edit2, Trash2, ArrowLeft, BedDouble, CalendarDays } from 'lucide-react'
import { hotelsApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, ConfirmDialog } from '@/components/shared'
import { RoomForm, type RoomFormData } from './RoomForm'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns'

interface Room {
  id: string
  name: string
  description?: string
  capacity: number
  price_per_night: number
  images?: string[]
  amenities?: string[]
  hotel_id: string
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

interface RoomManagementProps {
  hotelId: string
}

export function RoomManagement({ hotelId }: RoomManagementProps) {
  const qc = useQueryClient()
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Room | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['admin-hotel-rooms', hotelId],
    queryFn: () => hotelsApi.getRooms(hotelId).then((r) => r.data as Room[]),
    staleTime: 30000,
  })

  const createMutation = useMutation({
    mutationFn: (d: RoomFormData) => hotelsApi.createRoom(hotelId, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hotel-rooms', hotelId] })
      setShowForm(false)
      toast.success('Room created successfully')
    },
    onError: () => toast.error('Failed to create room'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ roomId, data }: { roomId: string; data: RoomFormData }) =>
      hotelsApi.updateRoom(hotelId, roomId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hotel-rooms', hotelId] })
      setShowForm(false)
      setEditing(null)
      toast.success('Room updated successfully')
    },
    onError: () => toast.error('Failed to update room'),
  })

  const deleteMutation = useMutation({
    mutationFn: (roomId: string) => hotelsApi.deleteRoom(hotelId, roomId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hotel-rooms', hotelId] })
      setDeleteTarget(null)
      toast.success('Room deleted successfully')
    },
    onError: () => toast.error('Failed to delete room'),
  })

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (room: Room) => {
    setEditing(room)
    setShowForm(true)
  }

  const handleSubmit = (formData: RoomFormData) => {
    if (editing) {
      updateMutation.mutate({ roomId: editing.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditing(null)
  }

  const defaultFormValues: Partial<RoomFormData> | undefined = editing
    ? {
        name: editing.name,
        description: editing.description,
        capacity: editing.capacity,
        price_per_night: editing.price_per_night,
        images: editing.images,
        amenities: editing.amenities,
      }
    : undefined

  // Calendar helpers
  const monthStart = startOfMonth(calendarMonth)
  const monthEnd = endOfMonth(monthStart)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(monthEnd)

  const calendarDays: Date[] = []
  let day = calStart
  while (day <= calEnd) {
    calendarDays.push(day)
    day = addDays(day, 1)
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Mock availability data — in production this would come from an API
  const getAvailability = (date: Date, roomId: string) => {
    const daySeed = date.getDate() + parseInt(roomId.slice(-2), 36)
    if (daySeed % 7 === 0) return 'booked'
    if (daySeed % 5 === 0) return 'limited'
    return 'available'
  }

  const availabilityColor = (status: string) => {
    switch (status) {
      case 'booked':
        return 'bg-destructive/20 text-destructive'
      case 'limited':
        return 'bg-warning/20 text-warning'
      default:
        return 'bg-success/20 text-success'
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/admin/hotels')}
        >
          <ArrowLeft className="size-4 mr-1" />
          Back to Hotels
        </Button>
      </div>

      <PageHeader
        title="Room Management"
        subtitle={`${rooms.length} rooms`}
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} /> Add Room
          </button>
        }
      />

      {/* Rooms Table */}
      <div className="card mb-6" style={{ padding: 0 }}>
        <DataTable
          data={rooms}
          loading={isLoading}
          rowKey="id"
          emptyMessage="No rooms found"
          columns={[
            {
              key: 'name',
              label: 'Room Name',
              sortable: true,
              render: (r: Room) => (
                <div className="flex items-center gap-2">
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
              key: 'capacity',
              label: 'Capacity',
              render: (r: Room) => `${r.capacity} guests`,
            },
            {
              key: 'price_per_night',
              label: 'Price/Night',
              render: (r: Room) => `$${r.price_per_night?.toFixed(2) ?? '0.00'}`,
            },
            {
              key: 'amenities',
              label: 'Amenities',
              render: (r: Room) =>
                r.amenities && r.amenities.length > 0
                  ? `${r.amenities.length} amenities`
                  : '-',
            },
            {
              key: 'is_active',
              label: 'Status',
              render: (r: Room) => (
                <span
                  style={{
                    color:
                      r.is_active !== false
                        ? 'var(--success)'
                        : 'var(--text-muted)',
                  }}
                >
                  {r.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              ),
            },
          ]}
          actions={(row: Room) => (
            <div className="flex items-center gap-1">
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setSelectedRoom(row)}
                title="View Calendar"
              >
                <CalendarDays size={13} />
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
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        />
      </div>

      {/* Availability Calendar */}
      {selectedRoom && (
        <div className="card mb-6">
          <div className="card-header" style={{ marginBottom: 16, paddingBottom: 16 }}>
            <div>
              <h3 className="card-title">
                Availability Calendar — {selectedRoom.name}
              </h3>
              <p className="page-subtitle">
                Click a day to see booking status
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
              >
                Previous
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {format(calendarMonth, 'MMMM yyyy')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
              >
                Next
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRoom(null)}
              >
                Close
              </Button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-success/20 border border-success/40" />
              <span className="text-xs text-muted-foreground">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-warning/20 border border-warning/40" />
              <span className="text-xs text-muted-foreground">Limited</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-destructive/20 border border-destructive/40" />
              <span className="text-xs text-muted-foreground">Booked</span>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((wd) => (
              <div
                key={wd}
                className="text-center text-xs font-medium text-muted-foreground py-2"
              >
                {wd}
              </div>
            ))}
            {calendarDays.map((d, i) => {
              const status = getAvailability(d, selectedRoom.id)
              const inMonth = isSameMonth(d, calendarMonth)
              return (
                <div
                  key={i}
                  className={`
                    aspect-square rounded-md border p-1 flex flex-col items-center justify-center gap-0.5
                    ${inMonth ? '' : 'opacity-30 bg-muted/30'}
                    ${isSameDay(d, new Date()) ? 'border-primary ring-1 ring-primary' : 'border-border-default'}
                  `}
                >
                  <span className={`text-xs font-medium ${isSameDay(d, new Date()) ? 'text-primary' : ''}`}>
                    {format(d, 'd')}
                  </span>
                  {inMonth && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${availabilityColor(status)}`}
                    >
                      {status === 'available' ? 'Free' : status === 'limited' ? 'Few' : 'Full'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Room Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Room' : 'Create Room'}</DialogTitle>
          </DialogHeader>
          <RoomForm
            defaultValues={defaultFormValues}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={createMutation.isPending || updateMutation.isPending}
            isEditing={!!editing}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Room"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
