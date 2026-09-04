'use client'

import { useQuery } from '@tanstack/react-query'
import { maintenanceApi, unwrapList } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { format, parseISO } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'

interface MaintenanceHistoryProps {
  vehicleId?: string
}

interface MaintenanceRecord {
  id: string
  vehicleId: string
  maintenanceType: string
  scheduledDate: string
  completionDate?: string | null
  // Decimal column, serialised as a string by Prisma — coerce with Number() to format.
  maintenanceCost?: number | string | null
  maintenanceNotes?: string | null
  status: 'SCHEDULED' | 'IN_MAINTENANCE' | 'COMPLETED'
}

export function MaintenanceHistory({ vehicleId }: MaintenanceHistoryProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-maintenance', vehicleId || 'all'],
    // For a single vehicle, getForVehicle returns the COMPLETE history as a bare
    // array (no 20-row pagination cap), which the total-cost sum below relies on;
    // the general list is paginated. unwrapList normalises both to `{ items }`.
    queryFn: () =>
      (vehicleId
        ? maintenanceApi.getForVehicle(vehicleId)
        : maintenanceApi.list({})
      ).then(unwrapList<MaintenanceRecord>),
    staleTime: 30000,
  })

  const records = data?.items ?? []

  const totalCost = records.reduce(
    (sum, r) => sum + (r.maintenanceCost != null ? Number(r.maintenanceCost) : 0),
    0,
  )

  const columns = [
    {
      key: 'scheduledDate',
      label: 'Date',
      sortable: true,
      render: (r: MaintenanceRecord) =>
        r.scheduledDate ? format(parseISO(r.scheduledDate), 'MMM d, yyyy') : '—',
    },
    { key: 'maintenanceType', label: 'Type', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (r: MaintenanceRecord) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            r.status === 'COMPLETED'
              ? 'bg-emerald-400/10 text-emerald-400'
              : r.status === 'IN_MAINTENANCE'
              ? 'bg-amber-400/10 text-amber-400'
              : 'bg-blue-400/10 text-blue-400'
          }`}
        >
          {r.status.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'maintenanceCost',
      label: 'Cost',
      render: (r: MaintenanceRecord) =>
        r.maintenanceCost != null ? `$${Number(r.maintenanceCost).toFixed(2)}` : '—',
    },
    {
      key: 'maintenanceNotes',
      label: 'Notes',
      render: (r: MaintenanceRecord) => r.maintenanceNotes || '—',
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Maintenance History</h3>
        <div className="text-sm text-muted-foreground">
          Total Cost: <span className="font-medium text-primary">${totalCost.toFixed(2)}</span>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={records}
        rowKey="id"
        emptyMessage="No maintenance records found"
      />
    </div>
  )
}
