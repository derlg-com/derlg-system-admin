import type { Metadata } from 'next'
import { HotelList } from '@/components/admin/hotels/HotelList'
export const metadata: Metadata = { title: 'Hotels — DerLg Admin' }
export default function HotelsPage() { return <HotelList /> }
