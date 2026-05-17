import type { Metadata } from 'next'
import { CustomerProfileView } from '@/components/admin/customers/CustomerProfileView'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  return { title: `Customer Profile — ${id}` }
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params
  return <CustomerProfileView customerId={id} />
}
