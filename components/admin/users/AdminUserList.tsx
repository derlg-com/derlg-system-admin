'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Power } from 'lucide-react'
import { adminUsersApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, StatusBadge, Modal, FormField, ConfirmDialog } from '@/components/shared'
import { format } from 'date-fns'

const ROLES = ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT', 'FLEET_MANAGER']

export function AdminUserList() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<any>(null)
  const [form, setForm] = useState({ email: '', name: '', admin_role: 'SUPPORT_AGENT', password: '' })

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminUsersApi.list().then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: (d: any) => editing ? adminUsersApi.update(editing.id, d) : adminUsersApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setShowForm(false); setEditing(null); setForm({ email: '', name: '', admin_role: 'SUPPORT_AGENT', password: '' }) },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => adminUsersApi.update(id, { is_active: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setDeactivateTarget(null) },
  })

  const openEdit = (u: any) => {
    setEditing(u)
    setForm({ email: u.email, name: u.name, admin_role: u.admin_role, password: '' })
    setShowForm(true)
  }

  return (
    <div>
      <PageHeader title="Admin Users" subtitle={`${data.length} administrators`} actions={<button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}><Plus size={15} /> Add Admin</button>} />
      <div className="card" style={{ padding: 0 }}>
        <DataTable data={data} loading={isLoading} rowKey="id" emptyMessage="No admin users found"
          columns={[
            { key: 'name', label: 'Name', sortable: true },
            { key: 'email', label: 'Email' },
            { key: 'admin_role', label: 'Admin Role', render: (r) => (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, background: 'var(--brand-primary-muted)', color: 'var(--brand-primary)', fontSize: 12, fontWeight: 500 }}>
                {(r.admin_role || '').replace(/_/g, ' ')}
              </span>
            )},
            { key: 'is_active', label: 'Status', render: (r) => <StatusBadge status={r.is_active !== false ? 'ACTIVE' : 'OFFLINE'} /> },
            { key: 'created_at', label: 'Added', render: (r) => format(new Date(r.created_at || Date.now()), 'MMM d, yyyy') },
          ]}
          actions={(row) => (
            <>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(row)} title="Edit Role"><Edit2 size={13} /></button>
              {row.is_active !== false && (
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeactivateTarget(row)} title="Deactivate"><Power size={13} color="var(--danger)" /></button>
              )}
            </>
          )}
        />
      </div>

      <Modal open={showForm} title={editing ? 'Edit Admin User' : 'Add Admin User'} onClose={() => { setShowForm(false); setEditing(null) }}
        footer={<><button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="btn btn-primary" form="admin-user-form" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : editing ? 'Save' : 'Create'}</button></>}>
        <form id="admin-user-form" onSubmit={(e) => { e.preventDefault(); mutation.mutate(form) }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Full Name" required><input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></FormField>
            <FormField label="Email" required><input className="form-input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required disabled={!!editing} /></FormField>
          </div>
          <FormField label="Admin Role">
            <select className="form-select" value={form.admin_role} onChange={(e) => setForm((f) => ({ ...f, admin_role: e.target.value }))}>
              {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
          </FormField>
          {!editing && (
            <FormField label="Temporary Password" required>
              <input className="form-input" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required={!editing} />
            </FormField>
          )}
          <div style={{ marginTop: 8, padding: 12, background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            <strong>Role Permissions:</strong><br />
            • SUPER_ADMIN: Full access to all features<br />
            • OPERATIONS_MANAGER: Bookings, hotels, guides, drivers, analytics<br />
            • SUPPORT_AGENT: Customers and bookings (read/modify only)<br />
            • FLEET_MANAGER: Drivers and vehicles only
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deactivateTarget} title="Deactivate Admin Account"
        message={`Are you sure you want to deactivate ${deactivateTarget?.name}'s admin account? This will revoke all their active tokens.`}
        confirmLabel="Deactivate" onConfirm={() => deactivateMutation.mutate(deactivateTarget?.id)}
        onCancel={() => setDeactivateTarget(null)} loading={deactivateMutation.isPending} />
    </div>
  )
}
