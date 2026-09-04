'use client'

import { useState,
  useEffect,
  useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { emergencyApi, unwrapList } from '@/lib/api'
import { useNotificationStore } from '@/store/adminStore'
import { DataTable } from '@/components/shared/DataTable'
import {
  FilterDropdown,
  StatusBadge,
  PageHeader,
} from '@/components/shared'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

// Keyed by the backend `EmergencyAlertType` enum, which is lowercase
// (sos | medical | theft | lost) — the values now arrive in that casing.
const ALERT_COLORS: Record<string, string> = {
  sos: 'var(--danger)',
  medical: 'var(--warning)',
  theft: 'var(--brand-accent)',
  lost: 'var(--info)',
}

interface EmergencyAlert {
  id: string
  alertType: string
  status: string
  message?: string
  latitude?: number
  longitude?: number
  userId?: string
  user?: { fullName: string | null }
  createdAt: string
}

/** Wire payload accepted by PATCH /v1/admin/emergency/:id */
interface EmergencyAlertUpdate {
  // Lowercase to match `EmergencyAlertStatus`; the controller branches on
  // 'acknowledged'/'resolved'. Timestamps are set server-side and the resolution
  // note maps to `notes` — the DTO whitelists only these, so any other key 400s.
  status: 'acknowledged' | 'resolved'
  notes?: string
}

/**
 * Hoisted to module scope: it closes over nothing, and defining it below the
 * effect that calls it meant the effect referenced a `const` in its temporal
 * dead zone.
 */
function playAlertSound() {
  try {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'square'
    oscillator.frequency.setValueAtTime(880, ctx.currentTime)
    oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.1)
    oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.4)
  } catch {
    // ignore audio errors
  }
}

export function EmergencyAlertList() {
  const router = useRouter()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [browserNotifEnabled, setBrowserNotifEnabled] = useState(false)
  const prevAlertsRef = useRef<string[]>([])
  const addNotification = useNotificationStore((s) => s.addNotification)

  // Request browser notification permission.
  //
  // `requestPermission()` resolves with the existing decision without prompting
  // when permission is not 'default', so one async path covers both the
  // already-granted and not-yet-asked cases — and avoids a synchronous setState
  // inside the effect, which cascades an extra render.
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'denied') return
    Notification.requestPermission().then((perm) => {
      setBrowserNotifEnabled(perm === 'granted')
    })
  }, [])

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-emergency', statusFilter, typeFilter],
    queryFn: () =>
      emergencyApi
        .list({
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(typeFilter ? { alert_type: typeFilter } : {}),
        })
        .then((r) => unwrapList<EmergencyAlert>(r).items),
    refetchInterval: 15000,
    staleTime: 10000,
  })

  // Detect new alerts and play sound + browser notification
  useEffect(() => {
    const currentIds = data.map((a: EmergencyAlert) => a.id)
    const prevIds = prevAlertsRef.current

    if (prevIds.length > 0) {
      const newAlerts = data.filter(
        (a: EmergencyAlert) =>
          !prevIds.includes(a.id) && a.status === 'triggered'
      )

      newAlerts.forEach((alert: EmergencyAlert) => {
        // Play sound
        if (soundEnabled) {
          playAlertSound()
        }

        // Browser notification
        if (browserNotifEnabled && typeof window !== 'undefined') {
          new Notification('Emergency Alert', {
            body: `${alert.alertType}: ${alert.message || 'No message'}`,
            icon: '/favicon.ico',
            tag: alert.id,
          })
        }

        // In-app notification
        addNotification({
          type: 'EMERGENCY',
          title: 'Emergency Alert',
          message: `${alert.alertType} from ${alert.user?.fullName || 'Unknown'}`,
          priority: 'urgent',
          data: alert,
        })

        toast.error(`New ${alert.alertType} emergency alert!`, {
          description: alert.message || 'Requires immediate attention',
        })
      })
    }

    prevAlertsRef.current = currentIds
  }, [data, soundEnabled, browserNotifEnabled, addNotification])

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EmergencyAlertUpdate }) =>
      emergencyApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-emergency'] })
      toast.success('Alert updated')
    },
    onError: () => toast.error('Failed to update alert'),
  })

  const hasSentAlerts = data.some((a: EmergencyAlert) => a.status === 'triggered')

  const filtered = data.filter((a: EmergencyAlert) => {
    if (statusFilter && a.status !== statusFilter) return false
    if (typeFilter && a.alertType !== typeFilter) return false
    return true
  })

  return (
    <div>
      <PageHeader
        title="Emergency Alerts"
        subtitle={
          hasSentAlerts
            ? 'Active emergencies require attention'
            : `${data.length} total alerts`
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Sound on' : 'Sound off'}
            >
              {soundEnabled ? (
                <Volume2 className="size-4" />
              ) : (
                <VolumeX className="size-4 text-muted-foreground" />
              )}
            </Button>
            <FilterDropdown
              value={typeFilter}
              onChange={setTypeFilter}
              placeholder="All Types"
              options={[
                { label: 'SOS', value: 'sos' },
                { label: 'Medical', value: 'medical' },
                { label: 'Theft', value: 'theft' },
                { label: 'Lost', value: 'lost' },
              ]}
            />
            <FilterDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="All Statuses"
              options={[
                { label: 'Triggered (Open)', value: 'triggered' },
                { label: 'Acknowledged', value: 'acknowledged' },
                { label: 'Resolved', value: 'resolved' },
              ]}
            />
          </div>
        }
      />

      {hasSentAlerts && (
        <div
          className="alert alert-danger"
          style={{ marginBottom: 16, animation: 'pulse-dot 2s ease-in-out infinite' }}
        >
          <AlertTriangle size={16} />
          <span>There are active emergency alerts requiring immediate attention!</span>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          data={filtered}
          loading={isLoading}
          rowKey="id"
          emptyMessage="No emergency alerts"
          onRowClick={(row: EmergencyAlert) =>
            router.push(`/admin/emergency/${row.id}`)
          }
          columns={[
            {
              key: 'alertType',
              label: <span style={{ display: 'inline-block', paddingLeft: 32 }}>Type</span>,
              render: (r: EmergencyAlert) => (
                <div style={{ paddingLeft: 32 }}>
                  <span
                    className="inline-flex items-center gap-1.5 font-semibold"
                    style={{ color: ALERT_COLORS[r.alertType] || 'var(--text-primary)' }}
                  >
                    <div style={{ color: ALERT_COLORS[r.alertType] || 'var(--text-primary)' }}>
                      <AlertTriangle className="size-4" />
                    </div>
                    {r.alertType}
                  </span>
                </div>
              ),
            },
            {
              key: 'user',
              label: 'Customer',
              render: (r: EmergencyAlert) => r.user?.fullName || r.userId || '—',
            },
            {
              key: 'location',
              label: 'Location',
              render: (r: EmergencyAlert) =>
                r.latitude && r.longitude
                  ? `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`
                  : '—',
            },
            {
              key: 'status',
              label: 'Status',
              render: (r: EmergencyAlert) => (
                <StatusBadge status={r.status} />
              ),
            },
            {
              key: 'createdAt',
              label: 'Time',
              render: (r: EmergencyAlert) =>
                formatDistanceToNow(new Date(r.createdAt), {
                  addSuffix: true,
                }),
            },
          ]}
          actions={(row: EmergencyAlert) => (
            <div className="flex items-center gap-1">
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(`/admin/emergency/${row.id}`)
                }}
                title="View Details"
              >
                <Eye size={13} />
              </button>
              {row.status === 'triggered' && (
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    updateMutation.mutate({
                      id: row.id,
                      payload: {
                        status: 'acknowledged',
                      },
                    })
                  }}
                  title="Acknowledge"
                  disabled={updateMutation.isPending}
                >
                  <CheckCircle size={13} />
                </button>
              )}
              {row.status === 'acknowledged' && (
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    updateMutation.mutate({
                      id: row.id,
                      payload: {
                        status: 'resolved',
                      },
                    })
                  }}
                  title="Resolve"
                  disabled={updateMutation.isPending}
                >
                  <XCircle size={13} />
                </button>
              )}
            </div>
          )}
        />
      </div>
    </div>
  )
}
