'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { emergencyApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { FilterDropdown, StatusBadge, PageHeader, Modal, FormField } from '@/components/shared'
import { formatDistanceToNow } from 'date-fns'

const ALERT_COLORS: Record<string, string> = { SOS: 'var(--danger)', MEDICAL: 'var(--warning)', THEFT: 'var(--warning)', LOST: 'var(--info)' }

export function EmergencyAlertList() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [notes, setNotes] = useState('')

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-emergency', statusFilter],
    queryFn: () => emergencyApi.list(statusFilter ? { status: statusFilter } : {}).then((r) => r.data),
    refetchInterval: 15_000,
  })

  const mutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => emergencyApi.update(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-emergency'] }); setSelected(null) },
  })

  const hasSentAlerts = data.some((a: any) => a.status === 'SENT')

  return (
    <div>
      <PageHeader
        title="Emergency Alerts"
        subtitle={hasSentAlerts ? '🚨 Active emergencies require attention' : `${data.length} total alerts`}
        actions={
          <FilterDropdown value={statusFilter} onChange={setStatusFilter} placeholder="All Statuses" options={[
            { label: 'Sent (Open)', value: 'SENT' }, { label: 'Acknowledged', value: 'ACKNOWLEDGED' }, { label: 'Resolved', value: 'RESOLVED' },
          ]} />
        }
      />

      {hasSentAlerts && (
        <div className="alert alert-danger" style={{ marginBottom: 16, animation: 'pulse-dot 2s ease-in-out infinite' }}>
          <AlertTriangle size={16} />
          <span>There are active emergency alerts requiring immediate attention!</span>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <DataTable data={data} loading={isLoading} rowKey="id" emptyMessage="No emergency alerts"
          onRowClick={(row) => { setSelected(row); setNotes('') }}
          columns={[
            {
              key: 'alert_type', label: 'Type',
              render: (r) => <span style={{ color: ALERT_COLORS[r.alert_type] || 'var(--text-primary)', fontWeight: 600 }}>⚠ {r.alert_type}</span>
            },
            { key: 'user', label: 'Customer', render: (r) => r.user?.name || r.user_id },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'message', label: 'Message', render: (r) => <span style={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.message || '—'}</span> },
            { key: 'created_at', label: 'Time', render: (r) => formatDistanceToNow(new Date(r.created_at), { addSuffix: true }) },
          ]}
        />
      </div>

      {/* Detail & Action Modal */}
      {selected && (
        <Modal open={!!selected} title={`${selected.alert_type} Alert`} onClose={() => setSelected(null)} maxWidth={560}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
            {selected.status === 'SENT' && (
              <button className="btn btn-primary" disabled={mutation.isPending}
                onClick={() => mutation.mutate({ id: selected.id, payload: { status: 'ACKNOWLEDGED' } })}>
                <CheckCircle size={14} /> Acknowledge
              </button>
            )}
            {selected.status === 'ACKNOWLEDGED' && (
              <button className="btn btn-primary" disabled={mutation.isPending}
                onClick={() => mutation.mutate({ id: selected.id, payload: { status: 'RESOLVED', resolution_notes: notes } })}>
                <XCircle size={14} /> Mark Resolved
              </button>
            )}
          </>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[
              ['Alert Type', selected.alert_type], ['Status', selected.status],
              ['Customer', selected.user?.name], ['Phone', selected.user?.phone],
              ['Latitude', selected.latitude], ['Longitude', selected.longitude],
            ].map(([label, value]) => (
              <div key={label as string}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{String(value ?? '—')}</div>
              </div>
            ))}
          </div>
          {selected.message && (
            <div style={{ padding: 12, background: 'var(--danger-muted)', borderRadius: 8, marginBottom: 16, border: '1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Message</div>
              <div style={{ fontSize: 13 }}>{selected.message}</div>
            </div>
          )}
          {selected.status === 'ACKNOWLEDGED' && (
            <FormField label="Resolution Notes">
              <textarea className="form-textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Describe how the emergency was resolved…" />
            </FormField>
          )}
          {selected.latitude && selected.longitude && (
            <div style={{ marginTop: 12 }}>
              <a
                href={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                📍 View on Map
              </a>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
