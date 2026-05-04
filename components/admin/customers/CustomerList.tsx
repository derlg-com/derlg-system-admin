'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customersApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput, PageHeader, Modal, FormField } from '@/components/shared'
import { format } from 'date-fns'

export function CustomerList() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [adjustPoints, setAdjustPoints] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-customers', search],
    queryFn: () => customersApi.list(search ? { search } : {}).then((r) => r.data),
  })

  const { data: profile } = useQuery({
    queryKey: ['admin-customer', selected?.id],
    queryFn: () => customersApi.get(selected!.id).then((r) => r.data),
    enabled: !!selected,
  })

  const adjustMutation = useMutation({
    mutationFn: (d: any) => customersApi.adjustLoyalty(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-customer', selected?.id] }); setAdjustPoints(''); setAdjustReason('') },
  })

  return (
    <div>
      <PageHeader title="Customers" subtitle={`${data.length} customers`} />
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email, or phone…" style={{ flex: 1 }} />
      </div>
      <div className="card" style={{ padding: 0 }}>
        <DataTable data={data} loading={isLoading} rowKey="id" emptyMessage="No customers found"
          onRowClick={(row) => setSelected(row)}
          columns={[
            { key: 'name', label: 'Name', sortable: true },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
            { key: 'loyalty_points', label: 'Points', render: (r) => <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>{r.loyalty_points}</span> },
            { key: 'is_student', label: 'Student', render: (r) => r.is_student ? <span style={{ color: 'var(--success)' }}>✓</span> : '—' },
            { key: 'created_at', label: 'Joined', render: (r) => format(new Date(r.created_at), 'MMM d, yyyy') },
          ]}
        />
      </div>

      {/* Customer profile modal */}
      {selected && (
        <Modal open={!!selected} title={`Customer: ${selected.name}`} onClose={() => setSelected(null)} maxWidth={640}
          footer={<button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>}>
          {!profile ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></div>
          ) : (
            <div>
              {/* Info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[['Name', profile.name], ['Email', profile.email], ['Phone', profile.phone], ['Role', profile.role],
                  ['Loyalty Points', profile.loyalty_points], ['Student', profile.is_student ? 'Yes' : 'No'],
                  ['Joined', format(new Date(profile.created_at), 'MMM d, yyyy')],
                ].map(([l, v]) => (
                  <div key={l as string}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{String(v ?? '—')}</div>
                  </div>
                ))}
              </div>

              {/* Recent bookings */}
              {profile.bookings?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Recent Bookings</div>
                  {profile.bookings.slice(0, 5).map((b: any) => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--brand-primary)', background: 'var(--brand-primary-muted)', padding: '2px 6px', borderRadius: 4 }}>{b.booking_ref}</span>
                      <span style={{ flex: 1, fontSize: 12 }}>{b.booking_type}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>${Number(b.total_usd).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Loyalty adjustment */}
              <div style={{ padding: 16, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border-default)' }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Adjust Loyalty Points</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 8, alignItems: 'end' }}>
                  <FormField label="Points (±)">
                    <input className="form-input" type="number" value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)} placeholder="+100 or -50" />
                  </FormField>
                  <FormField label="Reason">
                    <input className="form-input" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Compensation, error correction…" />
                  </FormField>
                  <button className="btn btn-primary btn-sm" style={{ marginBottom: 0 }}
                    disabled={!adjustPoints || !adjustReason || adjustMutation.isPending}
                    onClick={() => adjustMutation.mutate({ user_id: selected.id, points: +adjustPoints, reason: adjustReason })}>
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
