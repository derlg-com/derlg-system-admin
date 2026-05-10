import type { Metadata } from 'next'
import { GuideList } from '@/components/admin/guides/GuideList'
export const metadata: Metadata = { title: 'Tour Guides — DerLg Admin' }
export default function GuidesPage() { return <GuideList /> }
