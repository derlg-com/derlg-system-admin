import type { Metadata } from 'next'
import { DriverDetailView } from '@/components/admin/drivers/DriverDetailView'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  return { title: `Driver Details — ${id}` }
}

export default async function DriverDetailPage({ params }: PageProps) {
  const { id } = await params
  return <DriverDetailView driverId={id} />
}
