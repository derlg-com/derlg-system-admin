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
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import { Bot, TrendingUp, MessageSquare, AlertCircle, Edit2, Wrench } from 'lucide-react'
import { toast } from 'sonner'

interface AIBooking {
  id: string
  booking_ref: string
  user?: { name: string; email: string }
  user_id: string
  status: string
  booking_type: string
  total_usd: number
  ai_assisted: boolean
  metadata?: {
    session_id?: string
    ai_assisted?: boolean
    validation_errors?: string[]
    [key: string]: unknown
  }
  created_at: string
  travel_date?: string
  num_adults?: number
  num_children?: number
}

/** Fields an admin may correct on an AI-created booking. */
interface BookingCorrection {
  status?: string
  travel_date?: string
  num_adults?: number
  num_children?: number
}

interface SessionDetails {
  sessionId: string
  conversation_history?: Array<{
    role: string
    content: string
    timestamp?: string
  }>
  booking_id?: string
  status?: string
}

export function AIMonitoringDashboard() {
  const qc = useQueryClient()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [editingBooking, setEditingBooking] = useState<AIBooking | null>(null)
  const [correctionForm, setCorrectionForm] = useState({
    status: '',
    travel_date: '',
    num_adults: 1,
    num_children: 0,
  })

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['admin-ai-bookings'],
    queryFn: () => aiSessionsApi.getBookings().then((r) => r.data as AIBooking[]),
    staleTime: 30000,
  })

  const { data: successRateData } = useQuery({
    queryKey: ['admin-ai-success-rate'],
    queryFn: () => aiSessionsApi.getSuccessRate().then((r) => r.data),
    staleTime: 60000,
  })

  const { data: sessionDetails, isLoading: sessionLoading } = useQuery({
    queryKey: ['admin-ai-session', sessionId],
    queryFn: () => aiSessionsApi.getSession(sessionId!).then((r) => r.data as SessionDetails),
    enabled: !!sessionId,
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
    setCorrectionForm({
      status: booking.status || '',
      travel_date: booking.travel_date ? format(new Date(booking.travel_date), 'yyyy-MM-dd') : '',
      num_adults: booking.num_adults ?? 1,
      num_children: booking.num_children ?? 0,
    })
  }

  const handleCorrectionSubmit = () => {
    if (!editingBooking) return
    const payload: BookingCorrection = {}
    if (correctionForm.status) payload.status = correctionForm.status
    if (correctionForm.travel_date) payload.travel_date = correctionForm.travel_date
    if (correctionForm.num_adults != null) payload.num_adults = correctionForm.num_adults
    if (correctionForm.num_children != null) payload.num_children = correctionForm.num_children
    updateMutation.mutate({ id: editingBooking.id, data: payload })
  }

  const successRate = successRateData?.success_rate ??
    (bookings.length > 0
      ? ((bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED').length /
          bookings.length) *
        100).toFixed(1)
      : '0.0')

  const validationErrors = (booking: AIBooking) => {
    const errs = booking.metadata?.validation_errors
    return Array.isArray(errs) ? errs : []
  }

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
            <AlertCircle size={18} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--warning)' }}>
            {bookings.filter((b) => validationErrors(b).length > 0).length}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            With Validation Errors
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
              key: 'booking_ref',
              label: 'Ref',
              render: (r: AIBooking) => (
                <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {r.booking_ref}
                </span>
              ),
            },
            {
              key: 'user',
              label: 'Customer',
              render: (r: AIBooking) => r.user?.name || '—',
            },
            {
              key: 'status',
              label: 'Status',
              render: (r: AIBooking) => <StatusBadge status={r.status} />,
            },
            {
              key: 'booking_type',
              label: 'Type',
              render: (r: AIBooking) => (
                <Badge variant="outline" className="text-xs">
                  {r.booking_type}
                </Badge>
              ),
            },
            {
              key: 'total_usd',
              label: 'Total',
              render: (r: AIBooking) => (
                <span className="font-mono">${Number(r.total_usd).toFixed(2)}</span>
              ),
            },
            {
              key: 'ai_flag',
              label: 'AI',
              render: (r: AIBooking) =>
                r.ai_assisted || r.metadata?.ai_assisted ? (
                  <Bot size={14} className="text-primary" />
                ) : (
                  '—'
                ),
            },
            {
              key: 'session_id',
              label: 'Session',
              render: (r: AIBooking) => {
                const sid = r.metadata?.session_id
                return sid ? (
                  <button
                    className="font-mono text-xs text-muted-foreground hover:text-primary underline"
                    onClick={() => setSessionId(sid)}
                  >
                    {sid.slice(0, 12)}…
                  </button>
                ) : (
                  '—'
                )
              },
            },
            {
              key: 'errors',
              label: 'Errors',
              render: (r: AIBooking) => {
                const errs = validationErrors(r)
                return errs.length > 0 ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs text-destructive"
                    title={errs.join(', ')}
                  >
                    <AlertCircle size={12} />
                    {errs.length} error{errs.length > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )
              },
            },
            {
              key: 'created_at',
              label: 'Created',
              render: (r: AIBooking) =>
                format(new Date(r.created_at), 'MMM d, HH:mm'),
            },
          ]}
          actions={(row: AIBooking) => (
            <div className="flex items-center gap-1">
              {row.metadata?.session_id && (
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => setSessionId(row.metadata!.session_id!)}
                  title="View session"
                >
                  <MessageSquare size={13} />
                </button>
              )}
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => openCorrection(row)}
                title="Manual correction"
              >
                <Wrench size={13} />
              </button>
            </div>
          )}
        />
      </div>

      {/* Session History Dialog */}
      <Dialog open={!!sessionId} onOpenChange={(open) => !open && setSessionId(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare size={16} />
              Session History
            </DialogTitle>
          </DialogHeader>
          {sessionLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : sessionDetails?.conversation_history ? (
            <div className="space-y-3">
              {sessionDetails.conversation_history.map((msg, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-muted ml-4'
                      : msg.role === 'assistant'
                      ? 'bg-primary/10 mr-4'
                      : 'bg-warning/10'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs capitalize">
                      {msg.role}
                    </Badge>
                    {msg.timestamp && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(msg.timestamp), 'HH:mm:ss')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No conversation history available for this session.
            </p>
          )}
        </DialogContent>
      </Dialog>

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
                  {editingBooking.booking_ref}
                </span>
              </div>

              {validationErrors(editingBooking).length > 0 && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm font-medium text-destructive mb-1">
                    Validation Errors
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside">
                    {validationErrors(editingBooking).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

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
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    <SelectItem value="REFUNDED">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Travel Date</label>
                <Input
                  type="date"
                  value={correctionForm.travel_date}
                  onChange={(e) =>
                    setCorrectionForm((f) => ({
                      ...f,
                      travel_date: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Adults</label>
                  <Input
                    type="number"
                    min={1}
                    value={correctionForm.num_adults}
                    onChange={(e) =>
                      setCorrectionForm((f) => ({
                        ...f,
                        num_adults: parseInt(e.target.value) || 1,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Children</label>
                  <Input
                    type="number"
                    min={0}
                    value={correctionForm.num_children}
                    onChange={(e) =>
                      setCorrectionForm((f) => ({
                        ...f,
                        num_children: parseInt(e.target.value) || 0,
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
