import type { Metadata } from 'next'
import { TelegramSubNav } from '@/components/admin/telegram/TelegramSubNav'
import { TelegramAnalyticsDashboard } from '@/components/admin/telegram/TelegramAnalyticsDashboard'

export const metadata: Metadata = { title: 'Telegram Analytics — DerLg Admin' }

export default function TelegramAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Telegram Management</h1>
          <p className="page-subtitle">Broadcast messages, analytics, and driver support</p>
        </div>
      </div>

      <TelegramSubNav />
      <TelegramAnalyticsDashboard />
    </div>
  )
}
