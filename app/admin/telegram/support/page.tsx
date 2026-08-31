import type { Metadata } from 'next'
import { TelegramSubNav } from '@/components/admin/telegram/TelegramSubNav'
import { SupportTicketList } from '@/components/admin/telegram/SupportTicketList'

export const metadata: Metadata = { title: 'Telegram Support — DerLg Admin' }

export default function TelegramSupportPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Telegram Management</h1>
          <p className="page-subtitle">Broadcast messages, analytics, and driver support</p>
        </div>
      </div>

      <TelegramSubNav />
      <SupportTicketList />
    </div>
  )
}
