import type { Metadata } from 'next'
import { TelegramSubNav } from '@/components/admin/telegram/TelegramSubNav'
import { BroadcastComposer } from '@/components/admin/telegram/BroadcastComposer'
import { BroadcastHistory } from '@/components/admin/telegram/BroadcastHistory'

export const metadata: Metadata = { title: 'Telegram Broadcast — DerLg Admin' }

export default function TelegramBroadcastPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Telegram Management</h1>
          <p className="page-subtitle">Broadcast messages, analytics, and driver support</p>
        </div>
      </div>

      <TelegramSubNav />

      <BroadcastComposer />
      <BroadcastHistory />
    </div>
  )
}
