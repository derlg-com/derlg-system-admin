import type { Metadata } from 'next'
import { AnalyticsDashboard } from '@/components/admin/analytics/AnalyticsDashboard'
export const metadata: Metadata = { title: 'Analytics — DerLg Admin' }
export default function AnalyticsPage() {
  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">Analytics & Reports</h1><p className="page-subtitle">Revenue, bookings, driver performance, and more</p></div></div>
      <AnalyticsDashboard />
    </div>
  )
}
