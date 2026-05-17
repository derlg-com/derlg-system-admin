'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Volume2,
  VolumeX,
  Filter,
} from 'lucide-react'
import { emergencyApi } from '@/lib/api'
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

const ALERT_COLORS: Record<string, string> = {
  SOS: 'var(--danger)',
  MEDICAL: 'var(--warning)',
  THEFT: '#8b5cf6',
  LOST: 'var(--info)',
}

interface EmergencyAlert {
  id: string
  alert_type: string
  status: string
  message?: string
  latitude?: number
  longitude?: number
  user_id?: string
  user?: { name: string }
  created_at: string
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

  // Request browser notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        setBrowserNotifEnabled(true)
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((perm) => {
          setBrowserNotifEnabled(perm === 'granted')
        })
      }
    }
  }, [])

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-emergency', statusFilter, typeFilter],
    queryFn: () =>
      emergencyApi
        .list({
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(typeFilter ? { alert_type: typeFilter } : {}),
        })
        .then((r) => r.data as EmergencyAlert[]),
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
          !prevIds.includes(a.id) && a.status === 'SENT'
      )

      newAlerts.forEach((alert: EmergencyAlert) => {
        // Play sound
        if (soundEnabled) {
          playAlertSound()
        }

        // Browser notification
        if (browserNotifEnabled && typeof window !== 'undefined') {
          new Notification('🚨 Emergency Alert', {
            body: `${alert.alert_type}: ${alert.message || 'No message'}`,
            icon: '/favicon.ico',
            tag: alert.id,
          })
        }

        // In-app notification
        addNotification({
          type: 'EMERGENCY',
          title: '🚨 Emergency Alert',
          message: `${alert.alert_type} from ${alert.user?.name || 'Unknown'}`,
          priority: 'urgent',
          data: alert,
        })

        toast.error(`New ${alert.alert_type} emergency alert!`, {
          description: alert.message || 'Requires immediate attention',
        })
      })
    }

    prevAlertsRef.current = currentIds
  }, [data, soundEnabled, browserNotifEnabled, addNotification])

  const playAlertSound = useCallback(() => {
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
  }, [])

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      emergencyApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-emergency'] })
      toast.success('Alert updated')
    },
    onError: () => toast.error('Failed to update alert'),
  })

  const hasSentAlerts = data.some((a: EmergencyAlert) => a.status === 'SENT')

  const filtered = data.filter((a: EmergencyAlert) => {
    if (statusFilter && a.status !== statusFilter) return false
    if (typeFilter && a.alert_type !== typeFilter) return false
    return true
  })

  return (
    <div>
      <PageHeader
        title="Emergency Alerts"
        subtitle={
          hasSentAlerts
            ? '🚨 Active emergencies require attention'
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
                { label: 'SOS', value: 'SOS' },
                { label: 'Medical', value: 'MEDICAL' },
                { label: 'Theft', value: 'THEFT' },
                { label: 'Lost', value: 'LOST' },
              ]}
            />
            <FilterDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="All Statuses"
              options={[
                { label: 'Sent (Open)', value: 'SENT' },
                { label: 'Acknowledged', value: 'ACKNOWLEDGED' },
                { label: 'Resolved', value: 'RESOLVED' },
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
              key: 'alert_type',
              label: 'Type',
              render: (r: EmergencyAlert) => (
                <span
                  className="inline-flex items-center gap-1.5 font-semibold"
                  style={{ color: ALERT_COLORS[r.alert_type] || 'var(--text-primary)' }}
                >
                  <AlertTriangle
                    className="size-4"
                    style={{ color: ALERT_COLORS[r.alert_type] }}
                  />
                  {r.alert_type}
                </span>
              ),
            },
            {
              key: 'user',
              label: 'Customer',
              render: (r: EmergencyAlert) => r.user?.name || r.user_id || '—',
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
              key: 'created_at',
              label: 'Time',
              render: (r: EmergencyAlert) =>
                formatDistanceToNow(new Date(r.created_at), {
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
              {row.status === 'SENT' && (
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    updateMutation.mutate({
                      id: row.id,
                      payload: {
                        status: 'ACKNOWLEDGED',
                        acknowledged_at: new Date().toISOString(),
                      },
                    })
                  }}
                  title="Acknowledge"
                  disabled={updateMutation.isPending}
                >
                  <CheckCircle size={13} />
                </button>
              )}
              {row.status === 'ACKNOWLEDGED' && (
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    updateMutation.mutate({
                      id: row.id,
                      payload: {
                        status: 'RESOLVED',
                        resolved_at: new Date().toISOString(),
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
