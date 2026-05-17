import type { Metadata } from 'next'
import { AIMonitoringDashboard } from '@/components/admin/ai-monitoring/AIMonitoringDashboard'

export const metadata: Metadata = {
  title: 'AI Monitoring',
}

export default function AIMonitoringPage() {
  return <AIMonitoringDashboard />
}
