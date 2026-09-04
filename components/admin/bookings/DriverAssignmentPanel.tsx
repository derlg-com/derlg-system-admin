'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MessageCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Send,
} from 'lucide-react'
import { driversApi, assignmentsApi, unwrapList } from '@/lib/api'
import { getApiErrorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

interface Driver {
  id: string
  driverName: string
  phone: string
  telegramId?: string | null
  vehicleId?: string | null
  status: string
}

interface Assignment {
  id: string
  driverId: string
  vehicleId?: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED'
  telegramNotified?: boolean
  assignmentTimestamp: string
  responseTimestamp?: string
  driver?: Driver
}

interface DriverAssignmentPanelProps {
  bookingId: string
  vehicleId?: string
  passengerCount?: number
  currentAssignment?: Assignment | null
  onAssigned?: () => void
}

const COUNTDOWN_SECONDS = 5 * 60 // 5 minutes

function CountdownTimer({ startTime }: { startTime: string }) {
  const [remaining, setRemaining] = useState(() => {
    const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)
    return Math.max(0, COUNTDOWN_SECONDS - elapsed)
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  return (
    <span className="text-xs font-mono tabular-nums">
      {minutes}:{seconds.toString().padStart(2, '0')}
    </span>
  )
}

export function DriverAssignmentPanel({
  bookingId,
  vehicleId,
  passengerCount = 1,
  currentAssignment,
  onAssigned,
}: DriverAssignmentPanelProps) {
  const qc = useQueryClient()
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [telegramOnly, setTelegramOnly] = useState(false)
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-drivers', 'AVAILABLE', telegramOnly],
    queryFn: () => {
      const params: Record<string, unknown> = { status: 'AVAILABLE' }
      // has_telegram is validated with @IsBooleanString server-side — send the
      // string 'true', not a JS boolean.
      if (telegramOnly) params.has_telegram = 'true'
      // Admin lists return { data, meta } after the envelope unwrap; unwrapList
      // normalises that into an array so .find/.map below cannot throw.
      return driversApi.list(params).then(unwrapList<Driver>)
    },
    staleTime: 10000,
  })
  const drivers = data?.items ?? []

  const assignMutation = useMutation({
    // AssignDriverDto expects camelCase; vehicleId is optional and only sent when
    // a real UUID is present (an empty string fails the backend's @IsUUID()).
    mutationFn: (data: { driverId: string; bookingId: string; vehicleId?: string }) =>
      assignmentsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-bookings'] })
      setSelectedDriverId('')
      setError('')
      toast.success('Driver assigned successfully')
      onAssigned?.()
    },
    onError: (err) => {
      const msg = getApiErrorMessage(err, 'Failed to assign driver')
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        setError('Driver is no longer available. Please select another driver.')
      } else {
        setError(msg)
      }
    },
  })

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId)
  const handleAssign = () => {
    if (!selectedDriverId) return
    setError('')
    assignMutation.mutate({
      driverId: selectedDriverId,
      bookingId,
      // Only include vehicleId when a real UUID is present; '' fails @IsUUID().
      ...(vehicleId ? { vehicleId } : {}),
    })
  }

  // Show current assignment status
  if (currentAssignment) {
    const statusConfig: Record<
      string,
      { label: string; icon: React.ReactNode; color: string }
    > = {
      PENDING: {
        label: 'Pending Response',
        icon: <Clock className="size-4" />,
        color: 'text-amber-400',
      },
      ACCEPTED: {
        label: 'Accepted',
        icon: <CheckCircle2 className="size-4" />,
        color: 'text-emerald-400',
      },
      REJECTED: {
        label: 'Rejected',
        icon: <XCircle className="size-4" />,
        color: 'text-red-400',
      },
      COMPLETED: {
        label: 'Completed',
        icon: <CheckCircle2 className="size-4" />,
        color: 'text-blue-400',
      },
    }

    const config = statusConfig[currentAssignment.status] || statusConfig.PENDING

    return (
      <div className="rounded-lg border border-border-default p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Current Assignment</h4>
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.color}`}>
            {config.icon}
            {config.label}
          </span>
        </div>

        {currentAssignment.driver && (
          <div className="text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Driver: </span>
              {currentAssignment.driver.driverName}
            </p>
            <p>
              <span className="text-muted-foreground">Phone: </span>
              {currentAssignment.driver.phone}
            </p>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs">
          {currentAssignment.telegramNotified && (
            <span className="inline-flex items-center gap-1 text-blue-400">
              <MessageCircle className="size-3" />
              Telegram notified
            </span>
          )}
          {currentAssignment.status === 'PENDING' && (
            <span className="inline-flex items-center gap-1 text-amber-400">
              <Clock className="size-3" />
              Expires in:{' '}
              <CountdownTimer startTime={currentAssignment.assignmentTimestamp} />
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border-default p-4 space-y-4">
      <div className="flex items-center justify-between">
        {/*
          Passenger count is shown rather than used for a client-side capacity
          gate. The gate that used to live here compared against a hardcoded
          guess of 10 seats and its result was never read. The backend rejects an
          undersized vehicle with a 409 and an explicit message, which this panel
          already surfaces — so the operator needs the number, not a second
          (and contradictory) rule.
        */}
        <h4 className="text-sm font-medium">
          Assign Driver
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {passengerCount} {passengerCount === 1 ? 'passenger' : 'passengers'}
          </span>
        </h4>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={telegramOnly}
            onChange={(e) => setTelegramOnly(e.target.checked)}
            className="rounded border-border-default"
          />
          Telegram drivers only
        </label>
      </div>

      <div className="space-y-2">
        <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={isLoading ? 'Loading drivers...' : 'Select available driver'} />
          </SelectTrigger>
          <SelectContent>
            {drivers.length === 0 && (
              <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                No available drivers
              </div>
            )}
            {drivers.map((driver) => (
              <SelectItem key={driver.id} value={driver.id}>
                <div className="flex items-center gap-2">
                  <span>{driver.driverName}</span>
                  {driver.telegramId && (
                    <MessageCircle className="size-3 text-blue-400" />
                  )}
                  <span className="text-muted-foreground text-xs">({driver.phone})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedDriver && !selectedDriver.telegramId && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <AlertTriangle className="size-3" />
            This driver is not registered on Telegram
          </div>
        )}

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-red-400">
            <XCircle className="size-3" />
            {error}
          </div>
        )}
      </div>

      <Button
        onClick={handleAssign}
        disabled={!selectedDriverId || assignMutation.isPending}
        className="w-full"
      >
        {assignMutation.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin mr-1" />
            Assigning...
          </>
        ) : (
          <>
            <Send className="size-4 mr-1" />
            Assign Driver
          </>
        )}
      </Button>
    </div>
  )
}
