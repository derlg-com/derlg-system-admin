import type { Metadata } from 'next'
import { BookingList } from '@/components/admin/bookings/BookingList'
export const metadata: Metadata = { title: 'Bookings — DerLg Admin' }
export default function BookingsPage() { return <BookingList /> }
