'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2 } from 'lucide-react'
import { vehiclesApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput, FilterDropdown, StatusBadge, PageHeader, Modal, FormField } from '@/components/shared'

interface VehicleFormData {
  model: string
  category: string
  tier: string
  seat_capacity: number
  price_per_day_usd: number
  price_per_km_usd: number
  features: string
}

const EMPTY: VehicleFormData = { model: '', category: 'VAN', tier: 'STANDARD', seat_capacity: 4, price_per_day_usd: 0, price_per_km_usd: 0, features: '' }

export function VehicleList() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<VehicleFormData>(EMPTY)

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-vehicles', catFilter, tierFilter],
    queryFn: () => vehiclesApi.list({ category: catFilter || undefined, tier: tierFilter || undefined }).then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: (d: any) => editing ? vehiclesApi.update(editing.id, d) : vehiclesApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-vehicles'] }); setShowForm(false); setEditing(null); setForm(EMPTY) },
  })

  const filtered = data.filter((v: any) => !search || v.model?.toLowerCase().includes(search.toLowerCase()))

  const openEdit = (v: any) => {
    setEditing(v)
    setForm({ model: v.model, category: v.category, tier: v.tier, seat_capacity: v.seat_capacity, price_per_day_usd: Number(v.price_per_day_usd), price_per_km_usd: Number(v.price_per_km_usd), features: (v.features || []).join(', ') })
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({ ...form, features: form.features.split(',').map((f) => f.trim()).filter(Boolean) })
  }

  return (
    <div>
      <PageHeader
        title="Vehicle Fleet"
        subtitle={`${data.length} vehicles`}
        actions={<button className="btn btn-primary" onClick={() => { setEditing(null); setForm(EMPTY); setShowForm(true) }}><Plus size={15} /> Add Vehicle</button>}
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by model…" />
        <FilterDropdown value={catFilter} onChange={setCatFilter} options={[{ label: 'Van', value: 'VAN' }, { label: 'Bus', value: 'BUS' }, { label: 'Tuk-Tuk', value: 'TUK_TUK' }]} placeholder="All Categories" />
        <FilterDropdown value={tierFilter} onChange={setTierFilter} options={[{ label: 'Standard', value: 'STANDARD' }, { label: 'VIP', value: 'VIP' }]} placeholder="All Tiers" />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          data={filtered}
          loading={isLoading}
          rowKey="id"
          emptyMessage="No vehicles found"
          columns={[
            { key: 'model', label: 'Model', sortable: true },
            { key: 'category', label: 'Category', render: (r) => <StatusBadge status={r.category} /> },
            { key: 'tier', label: 'Tier', render: (r) => <StatusBadge status={r.tier} /> },
            { key: 'seat_capacity', label: 'Seats' },
            { key: 'price_per_day_usd', label: 'Price/Day', render: (r) => `$${Number(r.price_per_day_usd).toFixed(2)}` },
            { key: 'price_per_km_usd', label: 'Price/km', render: (r) => r.price_per_km_usd ? `$${Number(r.price_per_km_usd).toFixed(4)}` : '—' },
          ]}
          actions={(row) => (
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(row)} title="Edit"><Edit2 size={13} /></button>
          )}
        />
      </div>

      <Modal open={showForm} title={editing ? 'Edit Vehicle' : 'Add Vehicle'} onClose={() => { setShowForm(false); setEditing(null) }}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          <button className="btn btn-primary" form="vehicle-form" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : editing ? 'Save' : 'Create'}</button>
        </>}>
        <form id="vehicle-form" onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Model / Name" required>
              <input className="form-input" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} required />
            </FormField>
            <FormField label="Seats" required>
              <input className="form-input" type="number" value={form.seat_capacity} onChange={(e) => setForm((f) => ({ ...f, seat_capacity: +e.target.value }))} required min={1} />
            </FormField>
            <FormField label="Category" required>
              <select className="form-select" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                <option value="VAN">Van</option><option value="BUS">Bus</option><option value="TUK_TUK">Tuk-Tuk</option>
              </select>
            </FormField>
            <FormField label="Tier">
              <select className="form-select" value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}>
                <option value="STANDARD">Standard</option><option value="VIP">VIP</option>
              </select>
            </FormField>
            <FormField label="Price/Day (USD)">
              <input className="form-input" type="number" value={form.price_per_day_usd} onChange={(e) => setForm((f) => ({ ...f, price_per_day_usd: +e.target.value }))} min={0} step="0.01" />
            </FormField>
            <FormField label="Price/km (USD)">
              <input className="form-input" type="number" value={form.price_per_km_usd} onChange={(e) => setForm((f) => ({ ...f, price_per_km_usd: +e.target.value }))} min={0} step="0.0001" />
            </FormField>
          </div>
          <FormField label="Features" hint="Comma-separated: WiFi, A/C, GPS">
            <input className="form-input" value={form.features} onChange={(e) => setForm((f) => ({ ...f, features: e.target.value }))} placeholder="WiFi, A/C, GPS" />
          </FormField>
        </form>
      </Modal>
    </div>
  )
}
