import type { Metadata } from 'next'
import { RoomManagement } from '@/components/admin/hotels/RoomManagement'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return { title: `Rooms — Hotel ${id} — DerLg Admin` }
}

export default async function HotelRoomsPage({ params }: Props) {
  const { id } = await params
  return <RoomManagement hotelId={id} />
}
