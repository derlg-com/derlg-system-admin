'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditLogsApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { FilterDropdown, PageHeader } from '@/components/shared'
import { format } from 'date-fns'
import { Download, ChevronDown, ChevronRight } from 'lucide-react'

const ACTION_TYPES = ['DRIVER_ASSIGNMENT', 'BOOKING_MODIFICATION', 'PRICING_CHANGE', 'USER_ROLE_CHANGE', 'DRIVER_STATUS_UPDATE', 'BOOKING_CANCELLATION']

export function AuditLogViewer() {
  const [actionFilter, setActionFilter] = useState('')
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0] })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-audit-logs', actionFilter, startDate, endDate],
    queryFn: () => auditLogsApi.list({ action_type: actionFilter || undefined, start_date: startDate, end_date: endDate }).then((r) => r.data),
  })

  const handleExport = async () => {
    try {
      const res = await auditLogsApi.export({ start_date: startDate, end_date: endDate })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = `audit-logs-${startDate}-${endDate}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch { /* ignore */ }
  }

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle={`${data.length} records`}
        actions={<button className="btn btn-secondary" onClick={handleExport}><Download size={14} /> Export CSV</button>}
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <FilterDropdown value={actionFilter} onChange={setActionFilter} placeholder="All Action Types"
          options={ACTION_TYPES.map((t) => ({ label: t.replace(/_/g, ' '), value: t }))} />
        <input className="form-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: 'auto' }} />
        <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>—</span>
        <input className="form-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: 'auto' }} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable<Record<string, any>> data={data} loading={isLoading} rowKey="id" emptyMessage="No audit log entries found"
          columns={[
            { key: 'created_at', label: 'Timestamp', render: (r) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{format(new Date(r.created_at || r.timestamp || Date.now()), 'MMM d, HH:mm:ss')}</span> },
            { key: 'admin_name', label: 'Admin', render: (r) => r.admin_name || r.admin_user_id || '—' },
            {
              key: 'action_type', label: 'Action',
              render: (r) => <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand-accent)', letterSpacing: '0.03em' }}>{(r.action_type || r.action || '').replace(/_/g, ' ')}</span>
            },
            { key: 'resource_type', label: 'Resource', render: (r) => r.resource_type || r.resource || '—' },
            { key: 'affected_resource_id', label: 'Resource ID', render: (r) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{(r.affected_resource_id || '').slice(0, 8)}…</span> },
            {
              key: 'changed_fields', label: 'Changes',
              render: (r) => (
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  {expanded === r.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  Details
                </button>
              )
            },
          ]}
        />
      </div>

      {/* Expanded changes */}
      {expanded && data.find((d: any) => d.id === expanded) && (
        <div className="card" style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Changed Fields</div>
          <pre style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: 12, borderRadius: 8, overflow: 'auto' }}>
            {JSON.stringify(data.find((d: any) => d.id === expanded)?.changed_fields || data.find((d: any) => d.id === expanded)?.request_body, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
