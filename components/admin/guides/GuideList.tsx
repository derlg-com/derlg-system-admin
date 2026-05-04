'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2 } from 'lucide-react'
import { guidesApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput, PageHeader, Modal, FormField } from '@/components/shared'

interface GuideFormData {
  languages: string; specialties: string; bio: string; price_per_day_usd: number; years_experience: number; certifications: string
}
const EMPTY: GuideFormData = { languages: '', specialties: '', bio: '', price_per_day_usd: 0, years_experience: 0, certifications: '' }

export function GuideList() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<GuideFormData>(EMPTY)

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-guides'],
    queryFn: () => guidesApi.list().then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: (d: any) => editing ? guidesApi.update(editing.id, d) : guidesApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-guides'] }); setShowForm(false); setEditing(null); setForm(EMPTY) },
  })

  const filtered = data.filter((g: any) =>
    !search || g.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.specialties?.some((s: string) => s.toLowerCase().includes(search.toLowerCase()))
  )

  const openEdit = (g: any) => {
    setEditing(g)
    setForm({ languages: (g.languages || []).join(', '), specialties: (g.specialties || []).join(', '), bio: g.bio || '', price_per_day_usd: Number(g.price_per_day_usd), years_experience: g.years_experience, certifications: (g.certifications || []).join(', ') })
    setShowForm(true)
  }

  const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

  return (
    <div>
      <PageHeader title="Tour Guides" subtitle={`${data.length} guides`} actions={<button className="btn btn-primary" onClick={() => { setEditing(null); setForm(EMPTY); setShowForm(true) }}><Plus size={15} /> Add Guide</button>} />
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or specialty…" />
      </div>
      <div className="card" style={{ padding: 0 }}>
        <DataTable data={filtered} loading={isLoading} rowKey="id" emptyMessage="No guides found"
          columns={[
            { key: 'user', label: 'Name', render: (r) => r.user?.name || '—' },
            { key: 'languages', label: 'Languages', render: (r) => (r.languages || []).join(', ') },
            { key: 'specialties', label: 'Specialties', render: (r) => (r.specialties || []).slice(0, 2).join(', ') },
            { key: 'years_experience', label: 'Experience', render: (r) => `${r.years_experience}y` },
            { key: 'avg_rating', label: 'Rating', render: (r) => r.avg_rating ? `★ ${Number(r.avg_rating).toFixed(1)}` : '—' },
            { key: 'price_per_day_usd', label: 'Price/Day', render: (r) => `$${Number(r.price_per_day_usd).toFixed(2)}` },
          ]}
          actions={(row) => <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(row)}><Edit2 size={13} /></button>}
        />
      </div>
      <Modal open={showForm} title={editing ? 'Edit Guide' : 'Add Guide'} onClose={() => { setShowForm(false); setEditing(null) }}
        footer={<><button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="btn btn-primary" form="guide-form" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : editing ? 'Save' : 'Create'}</button></>}>
        <form id="guide-form" onSubmit={(e) => { e.preventDefault(); mutation.mutate({ ...form, languages: split(form.languages), specialties: split(form.specialties), certifications: split(form.certifications) }) }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Languages" hint="Comma-separated"><input className="form-input" value={form.languages} onChange={(e) => setForm((f) => ({ ...f, languages: e.target.value }))} placeholder="English, Khmer" /></FormField>
            <FormField label="Specialties"><input className="form-input" value={form.specialties} onChange={(e) => setForm((f) => ({ ...f, specialties: e.target.value }))} placeholder="Temples, History" /></FormField>
            <FormField label="Price/Day (USD)"><input className="form-input" type="number" min={0} step="0.01" value={form.price_per_day_usd} onChange={(e) => setForm((f) => ({ ...f, price_per_day_usd: +e.target.value }))} /></FormField>
            <FormField label="Years Experience"><input className="form-input" type="number" min={0} value={form.years_experience} onChange={(e) => setForm((f) => ({ ...f, years_experience: +e.target.value }))} /></FormField>
          </div>
          <FormField label="Bio"><textarea className="form-textarea" rows={3} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} /></FormField>
          <FormField label="Certifications"><input className="form-input" value={form.certifications} onChange={(e) => setForm((f) => ({ ...f, certifications: e.target.value }))} placeholder="Licensed Guide, First Aid" /></FormField>
        </form>
      </Modal>
    </div>
  )
}
