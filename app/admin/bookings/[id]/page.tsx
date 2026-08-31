import type { Metadata } from 'next'
import { BookingDetailView } from '@/components/admin/bookings/BookingDetailView'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  return { title: `Booking Details — ${id}` }
}

export default async function BookingDetailPage({ params }: PageProps) {
  const { id } = await params
  return <BookingDetailView bookingId={id} />
}
