'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Phone,
  Mail,
  Truck,
  Calendar,
  Star,
  Route,
  Clock,
  MessageCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { driversApi, vehiclesApi } from '@/lib/api'
import { DriverStatusBadge } from './DriverStatusBadge'
import { DataTable } from '@/components/shared/DataTable'
import { formatDistanceToNow, format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface DriverDetailViewProps {
  driverId: string
}

interface Assignment {
  id: string
  booking_id: string
  status: string
  assignment_timestamp: string
  response_timestamp?: string
  trip_start_time?: string
  completion_timestamp?: string
  rejection_reason?: string
  telegram_notified: boolean
}

export function DriverDetailView({ driverId }: DriverDetailViewProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'profile' | 'assignments'>('profile')

  const { data: driver, isLoading: driverLoading } = useQuery({
    queryKey: ['admin-driver', driverId],
    queryFn: () => driversApi.get(driverId).then((r) => r.data),
    staleTime: 30000,
  })

  const { data: vehicle } = useQuery({
    queryKey: ['admin-vehicle', driver?.vehicle_id],
    queryFn: () => vehiclesApi.get(driver.vehicle_id).then((r) => r.data),
    enabled: !!driver?.vehicle_id,
    staleTime: 60000,
  })

  if (driverLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!driver) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="size-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">Driver not found</h2>
        <p className="text-muted-foreground mt-1">The driver you are looking for does not exist.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/drivers')}>
          <ArrowLeft className="size-4 mr-1" /> Back to Drivers
        </Button>
      </div>
    )
  }

  const assignments: Assignment[] = driver.assignments || []
  const totalTrips = driver.total_trips ?? assignments.filter((a) => a.status === 'COMPLETED').length
  const averageRating = driver.average_rating ?? 0
  const isTelegramRegistered = !!driver.telegram_id

  const assignmentColumns = [
    { key: 'booking_id', label: 'Booking', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (r: Assignment) => (
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${
            r.status === 'COMPLETED'
              ? 'text-emerald-400'
              : r.status === 'ACCEPTED'
              ? 'text-blue-400'
              : r.status === 'REJECTED'
              ? 'text-red-400'
              : r.status === 'PENDING'
              ? 'text-amber-400'
              : 'text-slate-400'
          }`}
        >
          {r.status === 'COMPLETED' && <CheckCircle2 className="size-3" />}
          {r.status === 'REJECTED' && <XCircle className="size-3" />}
          {r.status === 'PENDING' && <Clock className="size-3" />}
          {r.status}
        </span>
      ),
    },
    {
      key: 'assignment_timestamp',
      label: 'Assigned',
      render: (r: Assignment) =>
        r.assignment_timestamp
          ? formatDistanceToNow(new Date(r.assignment_timestamp), { addSuffix: true })
          : '—',
    },
    {
      key: 'telegram_notified',
      label: 'Notified',
      render: (r: Assignment) =>
        r.telegram_notified ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
            <MessageCircle className="size-3" /> Yes
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No</span>
        ),
    },
    {
      key: 'rejection_reason',
      label: 'Notes',
      render: (r: Assignment) => r.rejection_reason || '—',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.push('/admin/drivers')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{driver.driver_name}</h1>
          <p className="text-sm text-muted-foreground">
            {driver.driver_id} ·{' '}
            <DriverStatusBadge status={driver.status} pulsing />
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-emerald-400/10 flex items-center justify-center">
              <Route className="size-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalTrips}</p>
              <p className="text-xs text-muted-foreground">Total Trips</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-amber-400/10 flex items-center justify-center">
              <Star className="size-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{averageRating > 0 ? averageRating.toFixed(1) : 'N/A'}</p>
              <p className="text-xs text-muted-foreground">Average Rating</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-blue-400/10 flex items-center justify-center">
              <MessageCircle className="size-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {isTelegramRegistered ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 text-lg">
                    <CheckCircle2 className="size-5" /> Yes
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-slate-400 text-lg">
                    <XCircle className="size-5" /> No
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">Telegram Registered</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
        <button
          className={`tab ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          Assignment History ({assignments.length})
        </button>
      </div>

      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile info */}
          <div className="card space-y-4">
            <h3 className="card-title">Driver Information</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium">{driver.phone || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MessageCircle className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Telegram ID</p>
                  <p className="text-sm font-medium">{driver.telegram_id || 'Not registered'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="text-sm font-medium">
                    {driver.created_at ? format(new Date(driver.created_at), 'PPP') : '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Last Status Update</p>
                  <p className="text-sm font-medium">
                    {driver.last_status_update
                      ? formatDistanceToNow(new Date(driver.last_status_update), { addSuffix: true })
                      : '—'}
                  </p>
                </div>
              </div>
              {driver.last_telegram_activity && (
                <div className="flex items-center gap-3">
                  <MessageCircle className="size-4 text-emerald-400" />
                  <div>
                    <p className="text-sm text-muted-foreground">Last Telegram Activity</p>
                    <p className="text-sm font-medium">
                      {formatDistanceToNow(new Date(driver.last_telegram_activity), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Vehicle info */}
          <div className="card space-y-4">
            <h3 className="card-title">Assigned Vehicle</h3>
            {vehicle ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Truck className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Vehicle Name</p>
                    <p className="text-sm font-medium">{vehicle.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <p className="text-sm font-medium">{vehicle.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Route className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Capacity</p>
                    <p className="text-sm font-medium">{vehicle.capacity} passengers</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Star className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Tier</p>
                    <p className="text-sm font-medium">{vehicle.tier}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No vehicle assigned.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="card">
          <DataTable
            columns={assignmentColumns}
            data={assignments}
            emptyMessage="No assignment history yet"
            rowKey="id"
          />
        </div>
      )}
    </div>
  )
}
