'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { aiSessionsApi, bookingsApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, StatusBadge } from '@/components/shared'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import { Bot, TrendingUp, DollarSign, Edit2, Wrench } from 'lucide-react'
import { toast } from 'sonner'

// One row from getAIAssistedBookings().bookings. The service maps each booking
// down to exactly these fields — there is no user object, booking_type,
// metadata, ai_assisted flag or passenger split in the response — so the table
// shows the userId and a status/total/date summary only.
interface AIBooking {
  id: string
  reference: string
  userId: string
  status: string
  totalUsd: number
  createdAt: string
}

// getAIAssistedBookings returns this aggregate, NOT a bare array. The old code
// cast r.data to AIBooking[] and then called .length / .filter / .map on it,
// which threw because r.data is this object.
interface AIAssistedBookingsResponse {
  totalBookings: number
  aiAssistedBookings: number
  aiAssistedRevenueUsd: number
  bookings: AIBooking[]
  period: { startDate: string; endDate: string }
}

// getAIBookingSuccessRate response. The rate lives on successRatePercent, not
// the old success_rate.
interface SuccessRateResponse {
  totalAiAssistedBookings: number
  successfulBookings: number
  successRatePercent: number
  byStatus: Record<string, number>
  period: { startDate: string; endDate: string }
}

/** Fields an admin may correct on an AI-created booking (see UpdateBookingDto). */
interface BookingCorrection {
  status?: string
  startDate?: string
  passengerCount?: number
  roomCount?: number
}

export function AIMonitoringDashboard() {
  const qc = useQueryClient()
  const [editingBooking, setEditingBooking] = useState<AIBooking | null>(null)
  const [correctionForm, setCorrectionForm] = useState({
    status: '',
    startDate: '',
    passengerCount: 1,
    roomCount: 1,
  })

  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['admin-ai-bookings'],
    queryFn: () =>
      aiSessionsApi
        .getBookings()
        .then((r) => r.data as AIAssistedBookingsResponse),
    staleTime: 30000,
  })

  // The table and metrics operate on the bookings array carried by the
  // aggregate; default to [] until the query resolves.
  const bookings = bookingsData?.bookings ?? []

  const { data: successRateData } = useQuery({
    queryKey: ['admin-ai-success-rate'],
    queryFn: () =>
      aiSessionsApi.getSuccessRate().then((r) => r.data as SuccessRateResponse),
    staleTime: 60000,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BookingCorrection }) =>
      bookingsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ai-bookings'] })
      setEditingBooking(null)
      toast.success('Booking updated')
    },
    onError: () => toast.error('Failed to update booking'),
  })

  const openCorrection = (booking: AIBooking) => {
    setEditingBooking(booking)
    // Status is the only correctable field the bookings endpoint returns; dates
    // and counts are not in the response, so the form opens at safe defaults for
    // the admin to fill in.
    setCorrectionForm({
      status: booking.status || '',
      startDate: '',
      passengerCount: 1,
      roomCount: 1,
    })
  }

  const handleCorrectionSubmit = () => {
    if (!editingBooking) return
    // Keys mirror UpdateBookingDto exactly (status, startDate, passengerCount,
    // roomCount). forbidNonWhitelisted 400s on anything else — which is why the
    // old travel_date / num_adults / num_children payload was rejected.
    const payload: BookingCorrection = {}
    if (correctionForm.status) payload.status = correctionForm.status
    if (correctionForm.startDate) payload.startDate = correctionForm.startDate
    if (correctionForm.passengerCount >= 1)
      payload.passengerCount = correctionForm.passengerCount
    if (correctionForm.roomCount >= 1)
      payload.roomCount = correctionForm.roomCount
    updateMutation.mutate({ id: editingBooking.id, data: payload })
  }

  const successRate =
    successRateData?.successRatePercent ??
    (bookings.length > 0
      ? (
          (bookings.filter(
            (b) => b.status === 'confirmed' || b.status === 'completed',
          ).length /
            bookings.length) *
          100
        ).toFixed(1)
      : '0.0')

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Agent Monitoring"
        subtitle={`${bookings.length} AI-assisted bookings`}
      />

      {/* Metrics */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
      >
        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div
            className="inline-flex items-center justify-center rounded-full mb-2"
            style={{
              width: 40,
              height: 40,
              backgroundColor: 'var(--brand-secondary)20',
              color: 'var(--brand-secondary)',
            }}
          >
            <Bot size={18} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{bookings.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            AI Bookings
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div
            className="inline-flex items-center justify-center rounded-full mb-2"
            style={{
              width: 40,
              height: 40,
              backgroundColor: 'var(--success)20',
              color: 'var(--success)',
            }}
          >
            <TrendingUp size={18} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)' }}>
            {typeof successRate === 'number' ? successRate.toFixed(1) : successRate}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Success Rate
          </div>
        </div>

        {/* Replaces the old "validation errors" tile: that count came from
            booking.metadata.validation_errors, which getAIAssistedBookings does
            not return. Revenue is a real field on the same response. */}
        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div
            className="inline-flex items-center justify-center rounded-full mb-2"
            style={{
              width: 40,
              height: 40,
              backgroundColor: 'var(--warning)20',
              color: 'var(--warning)',
            }}
          >
            <DollarSign size={18} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            ${Number(bookingsData?.aiAssistedRevenueUsd ?? 0).toFixed(2)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            AI-Assisted Revenue
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="card" style={{ padding: 0 }}>
        <DataTable
          data={bookings}
          loading={isLoading}
          rowKey="id"
          emptyMessage="No AI-assisted bookings found"
          columns={[
            {
              key: 'reference',
              label: 'Ref',
              render: (r: AIBooking) => (
                <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {r.reference}
                </span>
              ),
            },
            {
              // The response carries only userId — no user name/email — so the
              // id is the honest identifier to show here.
              key: 'userId',
              label: 'User',
              render: (r: AIBooking) => (
                <span className="font-mono text-xs text-muted-foreground">
                  {r.userId}
                </span>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r: AIBooking) => <StatusBadge status={r.status} />,
            },
            {
              key: 'totalUsd',
              label: 'Total',
              render: (r: AIBooking) => (
                <span className="font-mono">${Number(r.totalUsd).toFixed(2)}</span>
              ),
            },
            {
              key: 'createdAt',
              label: 'Created',
              render: (r: AIBooking) =>
                format(new Date(r.createdAt), 'MMM d, HH:mm'),
            },
          ]}
          actions={(row: AIBooking) => (
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => openCorrection(row)}
              title="Manual correction"
            >
              <Wrench size={13} />
            </button>
          )}
        />
      </div>

      {/* Manual Correction Dialog */}
      <Dialog open={!!editingBooking} onOpenChange={(open) => !open && setEditingBooking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 size={16} />
              Manual Correction
            </DialogTitle>
          </DialogHeader>
          {editingBooking && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Booking{' '}
                <span className="font-mono text-primary">
                  {editingBooking.reference}
                </span>
              </div>

              <div>
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={correctionForm.status}
                  onValueChange={(v) =>
                    setCorrectionForm((f) => ({ ...f, status: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  {/* Lowercase BookingStatus enum values. */}
                  <SelectContent>
                    <SelectItem value="hold">Hold</SelectItem>
                    <SelectItem value="pending_payment">Pending Payment</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="payment_failed">Payment Failed</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={correctionForm.startDate}
                  onChange={(e) =>
                    setCorrectionForm((f) => ({
                      ...f,
                      startDate: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Passengers</label>
                  <Input
                    type="number"
                    min={1}
                    value={correctionForm.passengerCount}
                    onChange={(e) =>
                      setCorrectionForm((f) => ({
                        ...f,
                        passengerCount: parseInt(e.target.value) || 1,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Rooms</label>
                  <Input
                    type="number"
                    min={1}
                    value={correctionForm.roomCount}
                    onChange={(e) =>
                      setCorrectionForm((f) => ({
                        ...f,
                        roomCount: parseInt(e.target.value) || 1,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setEditingBooking(null)}
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCorrectionSubmit}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
