import type { Metadata } from 'next'
import { EmergencyDetailView } from '@/components/admin/emergency/EmergencyDetailView'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  return { title: `Emergency Alert — ${id}` }
}

export default async function EmergencyDetailPage({ params }: PageProps) {
  const { id } = await params
  return <EmergencyDetailView alertId={id} />
}
