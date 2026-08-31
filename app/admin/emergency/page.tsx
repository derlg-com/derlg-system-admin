import type { Metadata } from 'next'
import { EmergencyAlertList } from '@/components/admin/emergency/EmergencyAlertList'
export const metadata: Metadata = { title: 'Emergency Alerts — DerLg Admin' }
export default function EmergencyPage() { return <EmergencyAlertList /> }
