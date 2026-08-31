'use client'

import { useQuery } from '@tanstack/react-query'
import { maintenanceApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { format, parseISO } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'

interface MaintenanceHistoryProps {
  vehicleId?: string
}

interface MaintenanceRecord {
  id: string
  vehicle_id: string
  maintenance_type: string
  scheduled_date: string
  completion_date?: string
  maintenance_cost?: number
  maintenance_notes?: string
  status: 'SCHEDULED' | 'IN_MAINTENANCE' | 'COMPLETED'
}

export function MaintenanceHistory({ vehicleId }: MaintenanceHistoryProps) {
  const { data = [], isLoading } = useQuery<MaintenanceRecord[]>({
    queryKey: ['admin-maintenance', vehicleId || 'all'],
    queryFn: () =>
      maintenanceApi
        .list(vehicleId ? { vehicle_id: vehicleId } : {})
        .then((r) => r.data),
    staleTime: 30000,
  })

  const totalCost = data.reduce((sum, r) => sum + (r.maintenance_cost || 0), 0)

  const columns = [
    {
      key: 'scheduled_date',
      label: 'Date',
      sortable: true,
      render: (r: MaintenanceRecord) =>
        r.scheduled_date ? format(parseISO(r.scheduled_date), 'MMM d, yyyy') : '—',
    },
    { key: 'maintenance_type', label: 'Type', sortable: true },
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
      key: 'maintenance_cost',
      label: 'Cost',
      render: (r: MaintenanceRecord) =>
        r.maintenance_cost !== undefined ? `$${r.maintenance_cost.toFixed(2)}` : '—',
    },
    {
      key: 'maintenance_notes',
      label: 'Notes',
      render: (r: MaintenanceRecord) => r.maintenance_notes || '—',
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
        data={data}
        rowKey="id"
        emptyMessage="No maintenance records found"
      />
    </div>
  )
}
