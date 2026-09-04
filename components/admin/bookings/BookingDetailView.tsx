'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  Users,
  DollarSign,
  CreditCard,
  MapPin,
  Mail,
  Phone,
  User,
  AlertCircle,
  Edit3,
  XCircle,
} from 'lucide-react'
import { bookingsApi } from '@/lib/api'
import { getApiErrorMessage } from '@/lib/utils'
import { DriverAssignmentPanel } from './DriverAssignmentPanel'
import { BookingModificationForm, type BookingModificationData } from './BookingModificationForm'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Modal, ConfirmDialog } from '@/components/shared'

interface BookingDetailViewProps {
  bookingId: string
}

interface PaymentRecord {
  id: string
  status?: string
  paidAt?: string | null
  amountUsd?: number | string | null
}

export function BookingDetailView({ bookingId }: BookingDetailViewProps) {
  const router = useRouter()
  const qc = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [showCancel, setShowCancel] = useState(false)

  const { data: booking, isLoading } = useQuery({
    queryKey: ['admin-booking', bookingId],
    queryFn: () => bookingsApi.get(bookingId).then((r) => r.data),
    staleTime: 30000,
  })

  const updateMutation = useMutation({
    mutationFn: (data: BookingModificationData) =>
      // The backend UpdateBookingDto (forbidNonWhitelisted) accepts only
      // startDate/endDate/passengerCount; the old travel_date/end_date/num_*
      // payload was rejected with 400.
      bookingsApi.update(bookingId, {
        startDate: format(data.travel_date, 'yyyy-MM-dd'),
        endDate: data.end_date ? format(data.end_date, 'yyyy-MM-dd') : undefined,
        passengerCount: data.num_adults + data.num_children,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-booking', bookingId] })
      qc.invalidateQueries({ queryKey: ['admin-bookings'] })
      setShowEdit(false)
      toast.success('Booking updated successfully')
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to update booking'))
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => bookingsApi.cancel(bookingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-booking', bookingId] })
      qc.invalidateQueries({ queryKey: ['admin-bookings'] })
      setShowCancel(false)
      toast.success('Booking cancelled successfully')
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to cancel booking'))
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="size-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">Booking not found</h2>
        <p className="text-muted-foreground mt-1">The booking you are looking for does not exist.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/bookings')}>
          <ArrowLeft className="size-4 mr-1" /> Back to Bookings
        </Button>
      </div>
    )
  }

  const user = booking.user || {}
  const assignment = booking.driverAssignment || null
  const payments: PaymentRecord[] = booking.payments || []
  const trip = booking.trip || null
  const hotel = booking.hotel || null
  const vehicle = booking.vehicle || null
  const guide = booking.guide || null
  const isEditable = ['hold', 'pending_payment', 'confirmed'].includes(booking.status)

  // Booking type and the vehicle live on the line items, not on the booking, so
  // derive them defensively — this both stops booking.booking_type.replace(...)
  // from throwing and lets the driver panel show for transport bookings.
  const bookingItems: Array<{ bookingType: string; vehicleId?: string | null }> =
    Array.isArray(booking.items) ? booking.items : []
  const itemTypes = Array.from(new Set(bookingItems.map((i) => i.bookingType)))
  const bookingTypeLabel = itemTypes.length
    ? itemTypes.map((t) => t.replace(/_/g, ' ')).join(', ')
    : '—'
  const needsDriver = itemTypes.includes('transportation')
  const transportVehicleId =
    bookingItems.find((i) => i.bookingType === 'transportation')?.vehicleId ?? undefined

  const statusColors: Record<string, { text: string; bg: string }> = {
    hold: { text: 'var(--warning)', bg: 'var(--warning-muted)' },
    pending_payment: { text: 'var(--warning)', bg: 'var(--warning-muted)' },
    confirmed: { text: 'var(--success)', bg: 'var(--success-muted)' },
    completed: { text: 'var(--info)', bg: 'var(--info-muted)' },
    cancelled: { text: 'var(--danger)', bg: 'var(--danger-muted)' },
    expired: { text: 'var(--text-muted)', bg: 'var(--bg-elevated)' },
    payment_failed: { text: 'var(--danger)', bg: 'var(--danger-muted)' },
    no_show: { text: 'var(--text-muted)', bg: 'var(--bg-elevated)' },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push('/admin/bookings')}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{booking.reference}</h1>
              {(() => {
                const cfg = statusColors[booking.status] || { text: 'var(--text-muted)', bg: 'var(--bg-elevated)' }
                return (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ color: cfg.text, background: cfg.bg }}
                  >
                    {booking.status.replace(/_/g, ' ')}
                  </span>
                )
              })()}
            </div>
            <p className="text-sm text-muted-foreground">
              {bookingTypeLabel} · Created{' '}
              {booking.createdAt ? format(parseISO(booking.createdAt), 'PPP') : '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditable && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
                <Edit3 className="size-4 mr-1" /> Modify
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowCancel(true)}>
                <XCircle className="size-4 mr-1" /> Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - booking info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Trip details */}
          <div className="card space-y-4">
            <h3 className="card-title">Booking Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Travel Date</p>
                  <p className="text-sm font-medium">
                    {booking.startDate ? format(parseISO(booking.startDate), 'PPP') : '—'}
                  </p>
                </div>
              </div>
              {booking.endDate && (
                <div className="flex items-center gap-3">
                  <Calendar className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">End Date</p>
                    <p className="text-sm font-medium">{format(parseISO(booking.endDate), 'PPP')}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Users className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Passengers</p>
                  <p className="text-sm font-medium">{booking.passengerCount} passengers</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <DollarSign className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-sm font-medium">${Number(booking.totalUsd).toFixed(2)}</p>
                </div>
              </div>
            </div>
            {booking.special_requests && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1">Special Requests</p>
                {booking.special_requests}
              </div>
            )}
            {booking.customizations && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1">Customizations</p>
                {booking.customizations}
              </div>
            )}
          </div>

          {/* Trip/Hotel/Vehicle/Guide details */}
          {(trip || hotel || vehicle || guide) && (
            <div className="card space-y-4">
              <h3 className="card-title">Services</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {trip && (
                  <div className="rounded-md border border-border-default p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="size-4 text-blue-400" />
                      <span className="text-sm font-medium">Trip</span>
                    </div>
                    <p className="text-sm">{trip.name || trip.destination}</p>
                  </div>
                )}
                {hotel && (
                  <div className="rounded-md border border-border-default p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="size-4 text-amber-400" />
                      <span className="text-sm font-medium">Hotel</span>
                    </div>
                    <p className="text-sm">{hotel.name}</p>
                    <p className="text-xs text-muted-foreground">{hotel.location}</p>
                  </div>
                )}
                {vehicle && (
                  <div className="rounded-md border border-border-default p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="size-4 text-emerald-400" />
                      <span className="text-sm font-medium">Vehicle</span>
                    </div>
                    <p className="text-sm">{vehicle.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {vehicle.category} · {vehicle.capacity} seats
                    </p>
                  </div>
                )}
                {guide && (
                  <div className="rounded-md border border-border-default p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="size-4 text-purple-400" />
                      <span className="text-sm font-medium">Guide</span>
                    </div>
                    <p className="text-sm">{guide.name}</p>
                    <p className="text-xs text-muted-foreground">{guide.languages?.join(', ')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment history */}
          {payments.length > 0 && (
            <div className="card space-y-4">
              <h3 className="card-title">Payment History</h3>
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border border-border-default p-3"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="size-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{p.status}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.paidAt ? format(parseISO(p.paidAt), 'PPP') : '—'}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-medium">${Number(p.amountUsd).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column - customer + assignment */}
        <div className="space-y-6">
          {/* Customer info */}
          <div className="card space-y-4">
            <h3 className="card-title">Customer</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="text-sm font-medium">{user.fullName || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{user.email || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium">{user.phone || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Driver assignment */}
          {needsDriver ? (
            <DriverAssignmentPanel
              bookingId={bookingId}
              vehicleId={transportVehicleId}
              passengerCount={booking.passengerCount || 0}
              currentAssignment={assignment}
              onAssigned={() => qc.invalidateQueries({ queryKey: ['admin-booking', bookingId] })}
            />
          ) : null}

          {/* Price breakdown */}
          <div className="card space-y-3">
            <h3 className="card-title">Price Breakdown</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${Number(booking.subtotalUsd || 0).toFixed(2)}</span>
              </div>
              {booking.discountUsd > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-emerald-400">
                    -${Number(booking.discountUsd).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t border-border-default pt-2 flex justify-between font-medium">
                <span>Total</span>
                <span>${Number(booking.totalUsd || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        open={showEdit}
        title="Modify Booking"
        onClose={() => setShowEdit(false)}
        maxWidth={560}
        footer={null}
      >
        <BookingModificationForm
          defaultValues={{
            // The form's own field names are unchanged; only the source booking
            // fields are corrected (startDate/endDate/passengerCount).
            travel_date: booking.startDate ? parseISO(booking.startDate) : new Date(),
            end_date: booking.endDate ? parseISO(booking.endDate) : undefined,
            num_adults: booking.passengerCount || 1,
            num_children: 0,
            customizations: booking.customizations || '',
          }}
          onSubmit={(data) => updateMutation.mutate(data)}
          onCancel={() => setShowEdit(false)}
          loading={updateMutation.isPending}
        />
      </Modal>

      {/* Cancel Confirmation */}
      <ConfirmDialog
        open={showCancel}
        title="Cancel Booking"
        message={`Are you sure you want to cancel booking ${booking.reference}? This will process a refund if payment was made.`}
        onConfirm={() => cancelMutation.mutate()}
        onCancel={() => setShowCancel(false)}
        loading={cancelMutation.isPending}
        variant="danger"
        confirmLabel="Cancel Booking"
      />
    </div>
  )
}
