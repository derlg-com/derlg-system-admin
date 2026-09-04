'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  MapPin,
  Phone,
  Mail,
  User,
  CheckCircle2,
  Truck,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { emergencyApi, driversApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const EmergencyMap = dynamic(
  () => import('./EmergencyMap').then((m) => m.EmergencyMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full rounded-lg" />,
  },
)
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow, format } from 'date-fns'
import { toast } from 'sonner'

interface EmergencyDetailViewProps {
  alertId: string
}

interface EmergencyAlert {
  id: string
  alertType: string
  status: string
  message?: string
  latitude?: number
  longitude?: number
  userId?: string
  user?: {
    fullName: string | null
    email?: string
    phone?: string
  }
  booking_id?: string
  driverId?: string
  driver?: {
    driverName: string
    phone?: string
    status: string
  }
  notes?: string
  createdAt: string
  acknowledgedAt?: string
  resolvedAt?: string
}

/** Wire payload accepted by PATCH /v1/admin/emergency/:id */
interface EmergencyAlertUpdate {
  // Lowercase to match `EmergencyAlertStatus`; the controller branches on
  // 'acknowledged'/'resolved'. Timestamps are set server-side; the resolution
  // note maps to `notes` — the DTO whitelists only these keys, so anything else
  // is rejected with a 400.
  status: 'acknowledged' | 'resolved'
  notes?: string
}

// Keyed by the lowercase `EmergencyAlertStatus` / `EmergencyAlertType` enum
// values the backend returns (triggered | acknowledged | resolved, sos | medical
// | theft | lost).
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  triggered: { label: 'Triggered', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  acknowledged: { label: 'Acknowledged', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  resolved: { label: 'Resolved', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
}

const ALERT_COLORS: Record<string, string> = {
  sos: '#ef4444',
  medical: '#f59e0b',
  theft: '#8b5cf6',
  lost: '#06b6d4',
}

// Mock nearby places — in production this would come from a geocoding API
function getMockNearbyPlaces(lat: number, lng: number) {
  return [
    { name: 'Royal Hospital', lat: lat + 0.002, lng: lng + 0.0015, type: 'hospital' as const },
    { name: 'City Police Station', lat: lat - 0.0015, lng: lng + 0.002, type: 'police' as const },
    { name: 'Grand Hotel', lat: lat + 0.001, lng: lng - 0.002, type: 'hotel' as const },
  ]
}

export function EmergencyDetailView({ alertId }: EmergencyDetailViewProps) {
  const router = useRouter()
  const qc = useQueryClient()
  const [resolutionNotes, setResolutionNotes] = useState('')

  const { data: alert, isLoading } = useQuery({
    queryKey: ['admin-emergency', alertId],
    queryFn: () => emergencyApi.get(alertId).then((r) => r.data as EmergencyAlert),
    staleTime: 30000,
  })

  const { data: driverData } = useQuery({
    queryKey: ['admin-emergency-driver', alert?.driverId],
    queryFn: () => driversApi.get(alert!.driverId!).then((r) => r.data),
    enabled: !!alert?.driverId,
    staleTime: 60000,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EmergencyAlertUpdate }) =>
      emergencyApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-emergency', alertId] })
      qc.invalidateQueries({ queryKey: ['admin-emergency'] })
      toast.success('Alert updated successfully')
    },
    onError: () => toast.error('Failed to update alert'),
  })

  const handleAcknowledge = () => {
    updateMutation.mutate({
      id: alertId,
      data: { status: 'acknowledged' },
    })
  }

  const handleResolve = () => {
    updateMutation.mutate({
      id: alertId,
      data: {
        status: 'resolved',
        notes: resolutionNotes,
      },
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (!alert) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="size-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">Alert not found</h2>
        <p className="text-muted-foreground mt-1">
          The emergency alert you are looking for does not exist.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/admin/emergency')}
        >
          <ArrowLeft className="size-4 mr-1" /> Back to Alerts
        </Button>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[alert.status] || STATUS_CONFIG.triggered
  const alertColor = ALERT_COLORS[alert.alertType] || ALERT_COLORS.sos
  const nearbyPlaces =
    alert.latitude && alert.longitude
      ? getMockNearbyPlaces(alert.latitude, alert.longitude)
      : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push('/admin/emergency')}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{alert.alertType} Alert</h1>
            <Badge
              style={{
                backgroundColor: statusConfig.bg,
                color: statusConfig.color,
                borderColor: statusConfig.color,
              }}
              variant="outline"
            >
              {statusConfig.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {alert.id} ·{' '}
            {formatDistanceToNow(new Date(alert.createdAt), {
              addSuffix: true,
            })}
          </p>
        </div>
      </div>

      {/* Urgent banner for triggered alerts */}
      {alert.status === 'triggered' && (
        <div
          className="alert alert-danger"
          style={{ animation: 'pulse-dot 2s ease-in-out infinite' }}
        >
          <AlertTriangle size={16} />
          <span>
            This alert has not been acknowledged yet and requires immediate
            attention!
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Alert message */}
          {alert.message && (
            <div
              className="card"
              style={{
                borderLeft: `4px solid ${alertColor}`,
              }}
            >
              <h3 className="card-title mb-2 flex items-center gap-2">
                <AlertTriangle className="size-4" style={{ color: alertColor }} />
                Alert Message
              </h3>
              <p className="text-sm leading-relaxed">{alert.message}</p>
            </div>
          )}

          {/* Map */}
          {alert.latitude && alert.longitude && (
            <div className="card space-y-3">
              <h3 className="card-title flex items-center gap-2">
                <MapPin className="size-4" />
                Location
              </h3>
              <EmergencyMap
                lat={alert.latitude}
                lng={alert.longitude}
                alertType={alert.alertType}
                radius={500}
                nearbyPlaces={nearbyPlaces}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Lat: {alert.latitude.toFixed(6)}, Lng:{' '}
                  {alert.longitude.toFixed(6)}
                </span>
                <a
                  href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Open in Google Maps
                </a>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="card space-y-4">
            <h3 className="card-title flex items-center gap-2">
              <Clock className="size-4" />
              Timeline
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className="size-2 rounded-full mt-2 shrink-0"
                  style={{ backgroundColor: ALERT_COLORS.sos }}
                />
                <div>
                  <p className="text-sm font-medium">Alert Sent</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(alert.createdAt), 'PPpp')}
                  </p>
                </div>
              </div>
              {alert.acknowledgedAt && (
                <div className="flex items-start gap-3">
                  <div
                    className="size-2 rounded-full mt-2 shrink-0"
                    style={{ backgroundColor: ALERT_COLORS.medical }}
                  />
                  <div>
                    <p className="text-sm font-medium">Acknowledged</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(alert.acknowledgedAt), 'PPpp')}
                    </p>
                  </div>
                </div>
              )}
              {alert.resolvedAt && (
                <div className="flex items-start gap-3">
                  <div
                    className="size-2 rounded-full mt-2 shrink-0"
                    style={{ backgroundColor: '#22c55e' }}
                  />
                  <div>
                    <p className="text-sm font-medium">Resolved</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(alert.resolvedAt), 'PPpp')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Resolution notes (if resolved) */}
          {alert.notes && (
            <div className="card space-y-2">
              <h3 className="card-title flex items-center gap-2">
                <ShieldCheck className="size-4" />
                Resolution Notes
              </h3>
              <p className="text-sm text-muted-foreground">
                {alert.notes}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          {alert.status !== 'resolved' && (
            <div className="card space-y-4">
              <h3 className="card-title">Actions</h3>
              {alert.status === 'triggered' && (
                <Button
                  className="w-full"
                  onClick={handleAcknowledge}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending && (
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                  )}
                  <CheckCircle2 className="size-4 mr-1.5" />
                  Acknowledge Alert
                </Button>
              )}
              {alert.status === 'acknowledged' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Resolution Notes
                    </label>
                    <textarea
                      className="form-textarea w-full"
                      rows={3}
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Describe how the emergency was resolved..."
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleResolve}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending && (
                      <Loader2 className="size-4 animate-spin mr-1.5" />
                    )}
                    <ShieldCheck className="size-4 mr-1.5" />
                    Mark Resolved
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Customer info */}
          <div className="card space-y-4">
            <h3 className="card-title flex items-center gap-2">
              <User className="size-4" />
              Customer
            </h3>
            {alert.user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="text-sm font-medium">{alert.user.fullName}</p>
                  </div>
                </div>
                {alert.user.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="text-sm font-medium">{alert.user.email}</p>
                    </div>
                  </div>
                )}
                {alert.user.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <a
                        href={`tel:${alert.user.phone}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {alert.user.phone}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Customer information not available.
              </p>
            )}
          </div>

          {/* Driver info */}
          {(alert.driver || driverData) && (
            <div className="card space-y-4">
              <h3 className="card-title flex items-center gap-2">
                <Truck className="size-4" />
                Assigned Driver
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="text-sm font-medium">
                      {alert.driver?.driverName || driverData?.driverName}
                    </p>
                  </div>
                </div>
                {(alert.driver?.phone || driverData?.phone) && (
                  <div className="flex items-center gap-3">
                    <Phone className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <a
                        href={`tel:${alert.driver?.phone || driverData?.phone}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {alert.driver?.phone || driverData?.phone}
                      </a>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-sm font-medium">
                      {alert.driver?.status || driverData?.status}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Booking link */}
          {alert.booking_id && (
            <div className="card">
              <h3 className="card-title mb-2">Related Booking</h3>
              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  router.push(`/admin/bookings/${alert.booking_id}`)
                }
              >
                View Booking {alert.booking_id}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
