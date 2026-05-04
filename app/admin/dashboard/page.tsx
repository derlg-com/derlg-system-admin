import type { Metadata } from 'next'
import { DashboardOverview } from '@/components/admin/dashboard/DashboardOverview'

export const metadata: Metadata = { title: 'Dashboard — DerLg Admin' }

export default function DashboardPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Real-time overview of DerLg operations</p>
        </div>
      </div>
      <DashboardOverview />
    </div>
  )
}
