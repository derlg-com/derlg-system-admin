'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ToggleLeft, ToggleRight } from 'lucide-react'
import { discountsApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, StatusBadge, Modal, FormField, ConfirmDialog } from '@/components/shared'
import { format } from 'date-fns'

export function DiscountCodeList() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<any>(null)
  const [form, setForm] = useState({ code: '', discount_type: 'PERCENTAGE', discount_value: '', valid_from: '', valid_until: '', max_uses: '' })

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-discounts'],
    queryFn: () => discountsApi.list().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (d: any) => discountsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-discounts'] }); setShowForm(false); setForm({ code: '', discount_type: 'PERCENTAGE', discount_value: '', valid_from: '', valid_until: '', max_uses: '' }) },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => discountsApi.update(id, { is_active: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-discounts'] }); setDeactivateTarget(null) },
  })

  return (
    <div>
      <PageHeader title="Discount Codes" subtitle={`${data.length} codes`} actions={<button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={15} /> Create Code</button>} />
      <div className="card" style={{ padding: 0 }}>
        <DataTable data={data} loading={isLoading} rowKey="id" emptyMessage="No discount codes found"
          columns={[
            { key: 'code', label: 'Code', render: (r) => <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--brand-primary)' }}>{r.code}</span> },
            { key: 'discount_type', label: 'Type' },
            { key: 'discount_value', label: 'Value', render: (r) => r.discount_type === 'PERCENTAGE' ? `${r.discount_value}%` : `$${r.discount_value}` },
            { key: 'valid_from', label: 'Valid From', render: (r) => format(new Date(r.valid_from), 'MMM d, yyyy') },
            { key: 'valid_until', label: 'Valid Until', render: (r) => format(new Date(r.valid_until), 'MMM d, yyyy') },
            { key: 'current_uses', label: 'Uses', render: (r) => `${r.current_uses}${r.max_uses ? ` / ${r.max_uses}` : ''}` },
            { key: 'is_active', label: 'Active', render: (r) => <StatusBadge status={r.is_active ? 'ACTIVE' : 'OFFLINE'} /> },
          ]}
          actions={(row) => (
            row.is_active ? (
              <button className="btn btn-ghost btn-icon btn-sm" title="Deactivate" onClick={() => setDeactivateTarget(row)}>
                <ToggleRight size={15} color="var(--success)" />
              </button>
            ) : (
              <ToggleLeft size={15} color="var(--text-muted)" />
            )
          )}
        />
      </div>

      <Modal open={showForm} title="Create Discount Code" onClose={() => setShowForm(false)}
        footer={<><button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="btn btn-primary" form="discount-form" type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating…' : 'Create'}</button></>}>
        <form id="discount-form" onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ ...form, discount_value: +form.discount_value, max_uses: form.max_uses ? +form.max_uses : undefined }) }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Code" required><input className="form-input" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="SUMMER20" required /></FormField>
            <FormField label="Type"><select className="form-select" value={form.discount_type} onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value }))}><option value="PERCENTAGE">Percentage</option><option value="FIXED_AMOUNT">Fixed Amount</option></select></FormField>
            <FormField label="Value" required><input className="form-input" type="number" min={0} step="0.01" value={form.discount_value} onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))} required /></FormField>
            <FormField label="Max Uses"><input className="form-input" type="number" min={1} value={form.max_uses} onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))} placeholder="Unlimited" /></FormField>
            <FormField label="Valid From" required><input className="form-input" type="datetime-local" value={form.valid_from} onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))} required /></FormField>
            <FormField label="Valid Until" required><input className="form-input" type="datetime-local" value={form.valid_until} onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))} required /></FormField>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deactivateTarget} title="Deactivate Discount Code"
        message={`Are you sure you want to deactivate code "${deactivateTarget?.code}"?`}
        confirmLabel="Deactivate" onConfirm={() => deactivateMutation.mutate(deactivateTarget?.id)}
        onCancel={() => setDeactivateTarget(null)} loading={deactivateMutation.isPending} />
    </div>
  )
}
