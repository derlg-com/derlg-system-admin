import type { Metadata } from 'next'
import { GuideDetailView } from '@/components/admin/guides/GuideDetailView'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  return { title: `Guide Details — ${id}` }
}

export default async function GuideDetailPage({ params }: PageProps) {
  const { id } = await params
  return <GuideDetailView guideId={id} />
}
