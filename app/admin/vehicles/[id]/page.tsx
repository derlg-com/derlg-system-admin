'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Truck,
  Users,
  Star,
  DollarSign,
  Calendar,
  Wrench,
  AlertCircle,
  Check,
  ImageIcon,
} from 'lucide-react'
import { vehiclesApi } from '@/lib/api'
import { MaintenanceHistory } from '@/components/admin/vehicles/MaintenanceHistory'
import { MaintenanceScheduler } from '@/components/admin/vehicles/MaintenanceScheduler'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function VehicleDetailPage() {
  const router = useRouter()
  const params = useParams()
  const vehicleId = params.id as string
  const [showScheduler, setShowScheduler] = useState(false)

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['admin-vehicle', vehicleId],
    queryFn: () => vehiclesApi.get(vehicleId).then((r) => r.data),
    staleTime: 30000,
  })

  if (isLoading) {
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

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="size-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">Vehicle not found</h2>
        <p className="text-muted-foreground mt-1">The vehicle you are looking for does not exist.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/vehicles')}>
          <ArrowLeft className="size-4 mr-1" /> Back to Vehicles
        </Button>
      </div>
    )
  }

  const features = vehicle.features || []
  const images = vehicle.images || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push('/admin/vehicles')}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{vehicle.name}</h1>
            <p className="text-sm text-muted-foreground">
              {vehicle.category.replace(/_/g, ' ')} · {vehicle.tier}
            </p>
          </div>
        </div>
        <Button onClick={() => setShowScheduler(true)}>
          <Wrench className="size-4 mr-1.5" />
          Schedule Maintenance
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-blue-400/10 flex items-center justify-center">
              <Users className="size-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{vehicle.capacity}</p>
              <p className="text-xs text-muted-foreground">Capacity</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-emerald-400/10 flex items-center justify-center">
              <DollarSign className="size-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">${vehicle.price_per_day?.toFixed(2) || '0.00'}</p>
              <p className="text-xs text-muted-foreground">Price / Day</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-amber-400/10 flex items-center justify-center">
              <DollarSign className="size-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">${vehicle.price_per_km?.toFixed(2) || '0.00'}</p>
              <p className="text-xs text-muted-foreground">Price / KM</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-purple-400/10 flex items-center justify-center">
              <Truck className="size-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{vehicle.assigned_driver?.driver_name || '—'}</p>
              <p className="text-xs text-muted-foreground">Assigned Driver</p>
            </div>
          </div>
        </div>
      </div>

      {/* Images */}
      {images.length > 0 && (
        <div className="card space-y-3">
          <h3 className="card-title">Images</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {images.map((url: string) => (
              <div key={url} className="rounded-lg overflow-hidden border aspect-video">
                <img src={url} alt={vehicle.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Features */}
      {features.length > 0 && (
        <div className="card space-y-3">
          <h3 className="card-title">Features</h3>
          <div className="flex flex-wrap gap-2">
            {features.map((feature: string) => (
              <span
                key={feature}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-sm"
              >
                <Check className="size-3" />
                {feature}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Maintenance History */}
      <div className="card space-y-4">
        <MaintenanceHistory vehicleId={vehicleId} />
      </div>

      {/* Schedule Maintenance Modal */}
      {showScheduler && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowScheduler(false)}>
          <div
            className="bg-card border rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Schedule Maintenance</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowScheduler(false)}>✕</button>
            </div>
            <div className="p-6">
              <MaintenanceScheduler
                vehicleId={vehicleId}
                onScheduled={() => setShowScheduler(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
