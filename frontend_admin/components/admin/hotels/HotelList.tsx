'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2 } from 'lucide-react'
import { hotelsApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput, PageHeader, Modal, FormField } from '@/components/shared'

interface HotelFormData {
  name: string; province: string; address: string; star_rating: number; check_in_time: string; check_out_time: string; amenities: string
}
const EMPTY: HotelFormData = { name: '', province: '', address: '', star_rating: 3, check_in_time: '14:00', check_out_time: '12:00', amenities: '' }

export function HotelList() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<HotelFormData>(EMPTY)

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-hotels'],
    queryFn: () => hotelsApi.list().then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: (d: any) => editing ? hotelsApi.update(editing.id, d) : hotelsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-hotels'] }); setShowForm(false); setEditing(null); setForm(EMPTY) },
  })

  const filtered = data.filter((h: any) => !search || h.name?.toLowerCase().includes(search.toLowerCase()) || h.province?.toLowerCase().includes(search.toLowerCase()))

  const openEdit = (h: any) => {
    setEditing(h)
    setForm({ name: h.name, province: h.province, address: h.address || '', star_rating: h.star_rating, check_in_time: h.check_in_time || '14:00', check_out_time: h.check_out_time || '12:00', amenities: (h.amenities || []).join(', ') })
    setShowForm(true)
  }

  return (
    <div>
      <PageHeader title="Hotels" subtitle={`${data.length} hotels`} actions={<button className="btn btn-primary" onClick={() => { setEditing(null); setForm(EMPTY); setShowForm(true) }}><Plus size={15} /> Add Hotel</button>} />
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or province…" />
      </div>
      <div className="card" style={{ padding: 0 }}>
        <DataTable data={filtered} loading={isLoading} rowKey="id" emptyMessage="No hotels found"
          columns={[
            { key: 'name', label: 'Hotel Name', sortable: true },
            { key: 'province', label: 'Province' },
            { key: 'star_rating', label: 'Stars', render: (r) => '★'.repeat(r.star_rating) },
            { key: 'check_in_time', label: 'Check-in' },
            { key: 'check_out_time', label: 'Check-out' },
            { key: 'isActive', label: 'Active', render: (r) => <span style={{ color: r.is_active ? 'var(--success)' : 'var(--text-muted)' }}>{r.is_active ? 'Yes' : 'No'}</span> },
          ]}
          actions={(row) => <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(row)}><Edit2 size={13} /></button>}
        />
      </div>
      <Modal open={showForm} title={editing ? 'Edit Hotel' : 'Add Hotel'} onClose={() => { setShowForm(false); setEditing(null) }} maxWidth={600}
        footer={<><button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="btn btn-primary" form="hotel-form" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : editing ? 'Save' : 'Create'}</button></>}>
        <form id="hotel-form" onSubmit={(e) => { e.preventDefault(); mutation.mutate({ ...form, amenities: form.amenities.split(',').map((a) => a.trim()).filter(Boolean) }) }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Hotel Name" required><input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></FormField>
            <FormField label="Province" required><input className="form-input" value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} required /></FormField>
            <FormField label="Star Rating"><input className="form-input" type="number" min={1} max={5} value={form.star_rating} onChange={(e) => setForm((f) => ({ ...f, star_rating: +e.target.value }))} /></FormField>
            <FormField label="Address"><input className="form-input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></FormField>
            <FormField label="Check-in Time"><input className="form-input" type="time" value={form.check_in_time} onChange={(e) => setForm((f) => ({ ...f, check_in_time: e.target.value }))} /></FormField>
            <FormField label="Check-out Time"><input className="form-input" type="time" value={form.check_out_time} onChange={(e) => setForm((f) => ({ ...f, check_out_time: e.target.value }))} /></FormField>
          </div>
          <FormField label="Amenities" hint="Comma-separated"><input className="form-input" value={form.amenities} onChange={(e) => setForm((f) => ({ ...f, amenities: e.target.value }))} placeholder="Pool, WiFi, Spa" /></FormField>
        </form>
      </Modal>
    </div>
  )
}
