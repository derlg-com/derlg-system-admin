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

/** Matches AssignmentResponseDto (camelCase). */
interface Assignment {
  id: string
  bookingId: string
  status: string
  assignmentTimestamp: string
  responseTimestamp?: string
  tripStartTime?: string
  completionTimestamp?: string
  rejectionReason?: string
  telegramNotified: boolean
}

/** Matches DriverResponseDto (camelCase). The detail endpoint returns
 *  `assignmentCount`, not the assignment array — see the note below. */
interface Driver {
  id: string
  driverName: string
  driverId: string
  telegramId?: string | null
  phone: string
  vehicleId?: string | null
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE'
  preferredLanguage?: string
  lastStatusUpdate?: string
  lastTelegramActivity?: string | null
  createdAt?: string
  updatedAt?: string
  vehicle?: { id: string; name: string; licensePlate?: string | null } | null
  assignmentCount: number
  // The relation exists on the model but the detail endpoint only returns the
  // count; typed optional so the history tab degrades to empty rather than crash.
  assignments?: Assignment[]
}

/** Subset of VehicleResponseDto that this view reads. */
interface AssignedVehicle {
  id: string
  name: string
  vehicleType: string
  capacity: number
  licensePlate?: string | null
}

export function DriverDetailView({ driverId }: DriverDetailViewProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'profile' | 'assignments'>('profile')

  const { data: driver, isLoading: driverLoading } = useQuery<Driver>({
    queryKey: ['admin-driver', driverId],
    queryFn: () => driversApi.get(driverId).then((r) => r.data),
    staleTime: 30000,
  })

  const { data: vehicle } = useQuery<AssignedVehicle>({
    queryKey: ['admin-vehicle', driver?.vehicleId],
    queryFn: () => vehiclesApi.get(driver!.vehicleId!).then((r) => r.data),
    enabled: !!driver?.vehicleId,
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

  const assignments: Assignment[] = driver.assignments ?? []
  // Backend detail response exposes only the assignment count, not the list.
  const totalTrips = driver.assignmentCount ?? 0
  // No rating field exists on the driver contract, so this always renders N/A.
  const averageRating = 0
  const isTelegramRegistered = !!driver.telegramId

  const assignmentColumns = [
    { key: 'bookingId', label: 'Booking', sortable: true },
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
      key: 'assignmentTimestamp',
      label: 'Assigned',
      render: (r: Assignment) =>
        r.assignmentTimestamp
          ? formatDistanceToNow(new Date(r.assignmentTimestamp), { addSuffix: true })
          : '—',
    },
    {
      key: 'telegramNotified',
      label: 'Notified',
      render: (r: Assignment) =>
        r.telegramNotified ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
            <MessageCircle className="size-3" /> Yes
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No</span>
        ),
    },
    {
      key: 'rejectionReason',
      label: 'Notes',
      render: (r: Assignment) => r.rejectionReason || '—',
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
          <h1 className="text-xl font-bold">{driver.driverName}</h1>
          <p className="text-sm text-muted-foreground">
            {driver.driverId} ·{' '}
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
          Assignment History ({driver.assignmentCount ?? assignments.length})
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
                  <p className="text-sm font-medium">{driver.telegramId || 'Not registered'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="text-sm font-medium">
                    {driver.createdAt ? format(new Date(driver.createdAt), 'PPP') : '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Last Status Update</p>
                  <p className="text-sm font-medium">
                    {driver.lastStatusUpdate
                      ? formatDistanceToNow(new Date(driver.lastStatusUpdate), { addSuffix: true })
                      : '—'}
                  </p>
                </div>
              </div>
              {driver.lastTelegramActivity && (
                <div className="flex items-center gap-3">
                  <MessageCircle className="size-4 text-emerald-400" />
                  <div>
                    <p className="text-sm text-muted-foreground">Last Telegram Activity</p>
                    <p className="text-sm font-medium">
                      {formatDistanceToNow(new Date(driver.lastTelegramActivity), {
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
                    <p className="text-sm font-medium">{vehicle.vehicleType}</p>
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
                    {/* Vehicle detail response has no `tier`; show the plate, which it does return. */}
                    <p className="text-sm text-muted-foreground">License Plate</p>
                    <p className="text-sm font-medium">{vehicle.licensePlate || '—'}</p>
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
