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
  Loader2,
  Bot,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { bookingsApi } from '@/lib/api'
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
      bookingsApi.update(bookingId, {
        ...data,
        travel_date: format(data.travel_date, 'yyyy-MM-dd'),
        end_date: data.end_date ? format(data.end_date, 'yyyy-MM-dd') : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-booking', bookingId] })
      qc.invalidateQueries({ queryKey: ['admin-bookings'] })
      setShowEdit(false)
      toast.success('Booking updated successfully')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update booking')
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
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to cancel booking')
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
  const assignment = booking.assignment || null
  const payments = booking.payments || []
  const trip = booking.trip || null
  const hotel = booking.hotel || null
  const vehicle = booking.vehicle || null
  const guide = booking.guide || null
  const isEditable = ['RESERVED', 'CONFIRMED'].includes(booking.status)

  const statusColors: Record<string, string> = {
    RESERVED: 'text-amber-400 bg-amber-400/10',
    CONFIRMED: 'text-emerald-400 bg-emerald-400/10',
    COMPLETED: 'text-blue-400 bg-blue-400/10',
    CANCELLED: 'text-red-400 bg-red-400/10',
    REFUNDED: 'text-slate-400 bg-slate-400/10',
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
              <h1 className="text-xl font-bold">{booking.booking_ref}</h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[booking.status] || 'text-slate-400 bg-slate-400/10'}`}>
                {booking.status}
              </span>
              {booking.ai_assisted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-400/10 text-purple-400 px-2 py-0.5 text-xs">
                  <Bot className="size-3" /> AI
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {booking.booking_type.replace(/_/g, ' ')} · Created{' '}
              {booking.created_at ? format(parseISO(booking.created_at), 'PPP') : '—'}
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
                    {booking.travel_date ? format(parseISO(booking.travel_date), 'PPP') : '—'}
                  </p>
                </div>
              </div>
              {booking.end_date && (
                <div className="flex items-center gap-3">
                  <Calendar className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">End Date</p>
                    <p className="text-sm font-medium">{format(parseISO(booking.end_date), 'PPP')}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Users className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Passengers</p>
                  <p className="text-sm font-medium">
                    {booking.num_adults} adults
                    {booking.num_children > 0 && `, ${booking.num_children} children`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <DollarSign className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-sm font-medium">${Number(booking.total_usd).toFixed(2)}</p>
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
                {payments.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border border-border-default p-3"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="size-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {p.payment_method} · {p.status}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.created_at ? format(parseISO(p.created_at), 'PPP') : '—'}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-medium">${Number(p.amount_usd).toFixed(2)}</span>
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
                  <p className="text-sm font-medium">{user.name || '—'}</p>
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
          {booking.booking_type === 'TRANSPORT_ONLY' || booking.booking_type === 'PACKAGE' ? (
            <DriverAssignmentPanel
              bookingId={bookingId}
              vehicleId={vehicle?.id}
              passengerCount={(booking.num_adults || 0) + (booking.num_children || 0)}
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
                <span>${Number(booking.subtotal_usd || 0).toFixed(2)}</span>
              </div>
              {booking.discount_amount_usd > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-emerald-400">
                    -${Number(booking.discount_amount_usd).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t border-border-default pt-2 flex justify-between font-medium">
                <span>Total</span>
                <span>${Number(booking.total_usd || 0).toFixed(2)}</span>
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
            travel_date: booking.travel_date ? parseISO(booking.travel_date) : new Date(),
            end_date: booking.end_date ? parseISO(booking.end_date) : undefined,
            num_adults: booking.num_adults || 1,
            num_children: booking.num_children || 0,
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
        message={`Are you sure you want to cancel booking ${booking.booking_ref}? This will process a refund if payment was made.`}
        onConfirm={() => cancelMutation.mutate()}
        onCancel={() => setShowCancel(false)}
        loading={cancelMutation.isPending}
        variant="danger"
        confirmLabel="Cancel Booking"
      />
    </div>
  )
}
