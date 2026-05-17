'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  BedDouble,
  MapPin,
  Star,
  Clock,
  ShieldCheck,
  Edit2,
  BedDoubleIcon,
} from 'lucide-react'
import { hotelsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

interface Hotel {
  id: string
  name: string
  description?: string
  location?: { lat: number; lng: number }
  images?: string[]
  rating?: number
  amenities?: string[]
  check_in_time?: string
  check_out_time?: string
  cancellation_policy?: string
  room_count?: number
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export default function HotelDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: hotel, isLoading } = useQuery({
    queryKey: ['admin-hotel', id],
    queryFn: () => hotelsApi.get(id).then((r) => r.data as Hotel),
    staleTime: 60000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
        </div>
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!hotel) {
    return (
      <div className="empty-state">
        <p className="empty-state-title">Hotel not found</p>
        <Button variant="outline" onClick={() => router.push('/admin/hotels')}>
          <ArrowLeft className="size-4 mr-1" />
          Back to Hotels
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/hotels')}>
          <ArrowLeft className="size-4 mr-1" />
          Back to Hotels
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">{hotel.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            {hotel.rating ? (
              <span className="flex items-center gap-0.5 text-amber-400">
                <Star className="size-4 fill-amber-400" />
                {hotel.rating}
              </span>
            ) : null}
            <Badge variant={hotel.is_active !== false ? 'default' : 'secondary'}>
              {hotel.is_active !== false ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/admin/hotels/${id}/rooms`)}
          >
            <BedDoubleIcon className="size-4 mr-1.5" />
            Manage Rooms
          </Button>
          <Button onClick={() => router.push(`/admin/hotels`)}>
            <Edit2 className="size-4 mr-1.5" />
            Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Images */}
          {hotel.images && hotel.images.length > 0 && (
            <div className="card">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {hotel.images.map((url, i) => (
                  <div key={i} className="rounded-lg overflow-hidden border aspect-video">
                    <img src={url} alt={`${hotel.name} ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {hotel.description && (
            <div className="card">
              <h3 className="card-title mb-3">Description</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{hotel.description}</p>
            </div>
          )}

          {/* Amenities */}
          {hotel.amenities && hotel.amenities.length > 0 && (
            <div className="card">
              <h3 className="card-title mb-3">Amenities</h3>
              <div className="flex flex-wrap gap-2">
                {hotel.amenities.map((amenity) => (
                  <Badge key={amenity} variant="secondary">{amenity}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Cancellation Policy */}
          {hotel.cancellation_policy && (
            <div className="card">
              <h3 className="card-title mb-3 flex items-center gap-2">
                <ShieldCheck className="size-4" />
                Cancellation Policy
              </h3>
              <p className="text-sm text-muted-foreground">{hotel.cancellation_policy}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="card">
            <h3 className="card-title mb-4">Details</h3>
            <div className="space-y-4">
              {hotel.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="size-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Location</p>
                    <p className="text-xs text-muted-foreground">
                      {hotel.location.lat.toFixed(6)}, {hotel.location.lng.toFixed(6)}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Clock className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Check-in / Check-out</p>
                  <p className="text-xs text-muted-foreground">
                    {hotel.check_in_time || '14:00'} / {hotel.check_out_time || '12:00'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <BedDouble className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Rooms</p>
                  <p className="text-xs text-muted-foreground">{hotel.room_count ?? 0} rooms</p>
                </div>
              </div>
              {hotel.created_at && (
                <div className="pt-3 border-t border-border-subtle">
                  <p className="text-xs text-muted-foreground">
                    Added: {new Date(hotel.created_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Location Map */}
          {hotel.location && (
            <div className="card">
              <h3 className="card-title mb-3">Map</h3>
              <div className="rounded-lg overflow-hidden border" style={{ height: 220 }}>
                <iframe
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${hotel.location.lng - 0.01},${hotel.location.lat - 0.01},${hotel.location.lng + 0.01},${hotel.location.lat + 0.01}&layer=mapnik&marker=${hotel.location.lat},${hotel.location.lng}`}
                />
              </div>
              <a
                href={`https://www.openstreetmap.org/?mlat=${hotel.location.lat}&mlon=${hotel.location.lng}#map=15/${hotel.location.lat}/${hotel.location.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary mt-2 inline-block hover:underline"
              >
                View larger map
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
