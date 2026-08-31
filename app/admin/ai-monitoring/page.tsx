import type { Metadata } from 'next'
import { AIMonitoringDashboard } from '@/components/admin/ai-monitoring/AIMonitoringDashboard'
import { AISessionList } from '@/components/admin/ai-monitoring/AISessionList'

export const metadata: Metadata = {
  title: 'AI Monitoring',
}

export default function AIMonitoringPage() {
  return (
    <div className="space-y-8">
      <AIMonitoringDashboard />
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Conversations</h2>
          <p className="text-sm text-slate-500">
            Archived concierge transcripts, including guest sessions.
          </p>
        </div>
        <AISessionList />
      </section>
    </div>
  )
}
