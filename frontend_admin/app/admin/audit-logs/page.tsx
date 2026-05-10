import type { Metadata } from 'next'
import { AuditLogViewer } from '@/components/admin/audit/AuditLogViewer'
export const metadata: Metadata = { title: 'Audit Logs — DerLg Admin' }
export default function AuditLogsPage() { return <AuditLogViewer /> }
