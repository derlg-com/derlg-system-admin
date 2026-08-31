import type { Metadata } from 'next'
import { TripList } from '@/components/admin/trips/TripList'

export const metadata: Metadata = { title: 'Trip Packages — DerLg Admin' }

export default function TripsPage() {
  return <TripList />
}
