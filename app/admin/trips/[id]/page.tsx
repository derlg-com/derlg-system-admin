'use client'

import { useParams } from 'next/navigation'
import { TripDetailView } from '@/components/admin/trips/TripDetailView'

export default function TripDetailPage() {
  const params = useParams()
  return <TripDetailView tripId={params.id as string} />
}
