'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Eye } from 'lucide-react'
import { driversApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput, FilterDropdown, StatusBadge, PageHeader, Modal, FormField } from '@/components/shared'
import { formatDistanceToNow } from 'date-fns'

function DriverStatusBadge({ status }: { status: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: status === 'AVAILABLE' ? 'var(--success)' : status === 'BUSY' ? 'var(--warning)' : 'var(--text-muted)',
        animation: status === 'AVAILABLE' ? 'pulse-dot 2s ease-in-out infinite' : 'none',
      }} />
      <StatusBadge status={status} />
    </div>
  )
}

interface DriverFormData {
  driver_name: string
  driver_id: string
  telegram_id: string
  phone: string
  vehicle_id: string
}

const EMPTY_FORM: DriverFormData = { driver_name: '', driver_id: '', telegram_id: '', phone: '', vehicle_id: '' }

export function DriverList() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<DriverFormData>(EMPTY_FORM)

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-drivers', statusFilter],
    queryFn: () => driversApi.list(statusFilter ? { status: statusFilter } : {}).then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: (d: any) =>
      editing ? driversApi.update(editing.id, d) : driversApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-drivers'] })
      setShowForm(false)
      setEditing(null)
      setForm(EMPTY_FORM)
    },
  })

  const filtered = data.filter((d: any) =>
    !search || d.driver_name?.toLowerCase().includes(search.toLowerCase()) || d.driver_id?.toLowerCase().includes(search.toLowerCase()),
  )

  const openEdit = (driver: any) => {
    setEditing(driver)
    setForm({
      driver_name: driver.driver_name,
      driver_id: driver.driver_id,
      telegram_id: driver.telegram_id || '',
      phone: driver.phone || '',
      vehicle_id: driver.vehicle_id || '',
    })
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(form)
  }

  return (
    <div>
      <PageHeader
        title="Drivers"
        subtitle={`${data.length} total drivers`}
        actions={
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true) }}>
            <Plus size={15} /> Add Driver
          </button>
        }
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or ID…" />
        <FilterDropdown
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { label: 'Available', value: 'AVAILABLE' },
            { label: 'Busy', value: 'BUSY' },
            { label: 'Offline', value: 'OFFLINE' },
          ]}
          placeholder="All Statuses"
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          data={filtered}
          loading={isLoading}
          rowKey="id"
          emptyMessage="No drivers found"
          columns={[
            { key: 'driver_name', label: 'Name', sortable: true },
            { key: 'driver_id', label: 'Driver ID' },
            { key: 'phone', label: 'Phone' },
            { key: 'telegram_id', label: 'Telegram ID' },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <DriverStatusBadge status={r.status} />,
            },
            {
              key: 'last_status_update',
              label: 'Last Update',
              render: (r) =>
                r.last_status_update
                  ? formatDistanceToNow(new Date(r.last_status_update), { addSuffix: true })
                  : '—',
            },
          ]}
          actions={(row) => (
            <>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(row)} title="Edit">
                <Edit2 size={13} />
              </button>
            </>
          )}
        />
      </div>

      {/* Form Modal */}
      <Modal
        open={showForm}
        title={editing ? 'Edit Driver' : 'Add Driver'}
        onClose={() => { setShowForm(false); setEditing(null); setForm(EMPTY_FORM) }}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" form="driver-form" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Driver'}
            </button>
          </>
        }
      >
        <form id="driver-form" onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Full Name" required>
              <input className="form-input" value={form.driver_name} onChange={(e) => setForm((f) => ({ ...f, driver_name: e.target.value }))} required />
            </FormField>
            <FormField label="Driver ID" required>
              <input className="form-input" value={form.driver_id} onChange={(e) => setForm((f) => ({ ...f, driver_id: e.target.value }))} required />
            </FormField>
            <FormField label="Telegram ID">
              <input className="form-input" value={form.telegram_id} onChange={(e) => setForm((f) => ({ ...f, telegram_id: e.target.value }))} placeholder="@username or ID" />
            </FormField>
            <FormField label="Phone">
              <input className="form-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Vehicle ID" hint="Link to a transportation vehicle">
            <input className="form-input" value={form.vehicle_id} onChange={(e) => setForm((f) => ({ ...f, vehicle_id: e.target.value }))} />
          </FormField>
          {mutation.isError && (
            <div className="alert alert-danger" style={{ marginTop: 12, fontSize: 12 }}>Failed to save driver. Please try again.</div>
          )}
        </form>
      </Modal>
    </div>
  )
}
