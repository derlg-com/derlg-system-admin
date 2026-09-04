'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Plus, Edit2, Eye, Trash2, Star, MapPin } from 'lucide-react'
import { guidesApi, unwrapList } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput, FilterDropdown, PageHeader, ConfirmDialog } from '@/components/shared'
import {
  GuideForm,
  type GuideFormData,
  GUIDE_LANGUAGES,
  GUIDE_SPECIALTIES,
} from './GuideForm'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface Guide {
  id: string
  userId?: string
  name?: string
  user?: { fullName?: string; name?: string; email?: string }
  bio?: string
  avatarUrl?: string
  languages?: string[]
  specialties?: string[]
  province?: string
  pricePerDayUsd?: number
  avg_rating?: number
  average_rating?: number
  assignmentCount?: number
  isVerified?: boolean
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

const LANG_MAP = new Map<string, string>(
  GUIDE_LANGUAGES.map((l) => [l.code, l.label]),
)
const SPEC_MAP = new Map<string, string>(
  GUIDE_SPECIALTIES.map((s) => [s.code, s.label]),
)
const LANG_OPTIONS = GUIDE_LANGUAGES.map((l) => ({
  label: l.label,
  value: l.code,
}))
const SPEC_OPTIONS = GUIDE_SPECIALTIES.map((s) => ({
  label: s.label,
  value: s.code,
}))

export function GuideList() {
  const qc = useQueryClient()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Guide | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Guide | null>(null)
  const [langFilter, setLangFilter] = useState<string[]>([])
  const [specFilter, setSpecFilter] = useState<string[]>([])

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-guides'],
    queryFn: () => guidesApi.list().then((r) => unwrapList<Guide>(r).items),
    staleTime: 30000,
  })

  const createMutation = useMutation({
    mutationFn: (d: GuideFormData) => guidesApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-guides'] })
      setShowForm(false)
      toast.success('Guide created successfully')
    },
    onError: () => toast.error('Failed to create guide'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: GuideFormData }) =>
      guidesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-guides'] })
      setShowForm(false)
      setEditing(null)
      toast.success('Guide updated successfully')
    },
    onError: () => toast.error('Failed to update guide'),
  })

  /*
   * Deactivate, not delete.
   *
   * This called `guidesApi.delete(id)`, which existed on neither the API client
   * nor the backend — there is no DELETE /admin/guides/:id — so the button threw
   * a TypeError instead of doing anything. Guides are referenced by bookings and
   * trips, so hard deletion would orphan history; `isActive: false` is the
   * supported way to retire one and is what the update DTO exposes.
   */
  const deleteMutation = useMutation({
    mutationFn: (id: string) => guidesApi.update(id, { isActive: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-guides'] })
      setDeleteTarget(null)
      toast.success('Guide deactivated successfully')
    },
    onError: () => toast.error('Failed to deactivate guide'),
  })

  const filtered = useMemo(() => {
    return data.filter((g: Guide) => {
      if (!search) return true
      const term = search.toLowerCase()
      const name = g.name || g.user?.fullName || g.user?.name || ''
      const langs = (g.languages || []).map((l) => LANG_MAP.get(l) || l).join(' ')
      const specs = (g.specialties || []).map((s) => SPEC_MAP.get(s) || s).join(' ')
      return (
        name.toLowerCase().includes(term) ||
        (g.bio ? g.bio.toLowerCase().includes(term) : false) ||
        (g.province ? g.province.toLowerCase().includes(term) : false) ||
        langs.toLowerCase().includes(term) ||
        specs.toLowerCase().includes(term)
      )
    }).filter((g: Guide) => {
      if (langFilter.length === 0) return true
      return langFilter.every((l) => g.languages?.includes(l))
    }).filter((g: Guide) => {
      if (specFilter.length === 0) return true
      return specFilter.some((s) => g.specialties?.includes(s))
    })
  }, [data, search, langFilter, specFilter])

  const openEdit = (g: Guide) => {
    setEditing(g)
    setShowForm(true)
  }

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }

  const handleSubmit = (formData: GuideFormData) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditing(null)
  }

  const defaultFormValues: Partial<GuideFormData> | undefined = editing
    ? {
        userId: editing.userId || '',
        bio: editing.bio || '',
        avatarUrl: editing.avatarUrl || '',
        languages: editing.languages || [],
        specialties: editing.specialties || [],
        province: editing.province || '',
        pricePerDayUsd: editing.pricePerDayUsd || 0,
        isVerified: editing.isVerified ?? false,
        isActive: editing.isActive ?? true,
      }
    : undefined

  const toggleLangFilter = (lang: string) => {
    setLangFilter((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    )
  }

  const toggleSpecFilter = (spec: string) => {
    setSpecFilter((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]
    )
  }

  return (
    <div>
      <PageHeader
        title="Tour Guides"
        subtitle={`${data.length} guides`}
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} /> Add Guide
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or specialty..."
            style={{ minWidth: 260, maxWidth: 360, flex: '1 1 260px' }}
          />
          <FilterDropdown
            label="Languages"
            placeholder="All Languages"
            options={LANG_OPTIONS}
            value={langFilter}
            onChange={setLangFilter}
          />
          <FilterDropdown
            label="Specialties"
            placeholder="All Specialties"
            options={SPEC_OPTIONS}
            value={specFilter}
            onChange={setSpecFilter}
          />
          {(langFilter.length > 0 || specFilter.length > 0) && (
            <button
              className="text-sm font-medium px-3 h-10 rounded-lg transition-colors"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)' }}
              onClick={() => { setLangFilter([]); setSpecFilter([]) }}
            >
              Clear all
            </button>
          )}
        </div>
        {(langFilter.length > 0 || specFilter.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Active:</span>
            {langFilter.map((lang) => (
              <span
                key={lang}
                onClick={() => toggleLangFilter(lang)}
                className="inline-flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-full cursor-pointer select-none"
                style={{ background: 'var(--brand-primary)', color: '#fff' }}
                title="Click to remove"
              >
                {LANG_MAP.get(lang) || lang}
                <span style={{ opacity: 0.8, marginLeft: 2 }}>×</span>
              </span>
            ))}
            {specFilter.map((spec) => (
              <span
                key={spec}
                onClick={() => toggleSpecFilter(spec)}
                className="inline-flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-full cursor-pointer select-none"
                style={{ background: 'var(--brand-secondary)', color: '#fff' }}
                title="Click to remove"
              >
                {SPEC_MAP.get(spec) || spec}
                <span style={{ opacity: 0.8, marginLeft: 2 }}>×</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          data={filtered}
          loading={isLoading}
          rowKey="id"
          emptyMessage="No guides found"
          columns={[
            {
              key: 'name',
              label: <span style={{ display: 'inline-block', paddingLeft: 32 }}>Name</span>,
              sortable: true,
              render: (r: Guide) => (
                <div style={{ paddingLeft: 32 }} className="flex items-center gap-2">
                  {r.avatarUrl ? (
                    <img
                      src={r.avatarUrl}
                      alt={r.name || r.user?.fullName || r.user?.name || ''}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <MapPin size={14} className="text-muted-foreground" />
                    </div>
                  )}
                  <span className="font-medium">{r.name || r.user?.fullName || r.user?.name || '—'}</span>
                </div>
              ),
            },
            {
              key: 'languages',
              label: 'Languages',
              render: (r: Guide) => {
                const langs = r.languages || []
                return (
                  <div className="flex flex-wrap gap-1">
                    {langs.slice(0, 3).map((l) => (
                      <span
                        key={l}
                        className="text-xs px-1.5 py-0.5 rounded bg-muted cursor-pointer hover:bg-primary/20"
                        onClick={(e) => { e.stopPropagation(); toggleLangFilter(l) }}
                      >
                        {LANG_MAP.get(l) || l}
                      </span>
                    ))}
                    {langs.length > 3 && (
                      <span className="text-xs text-muted-foreground">+{langs.length - 3}</span>
                    )}
                  </div>
                )
              },
            },
            {
              key: 'specialties',
              label: 'Specialties',
              render: (r: Guide) => {
                const specs = r.specialties || []
                return (
                  <div className="flex flex-wrap gap-1">
                    {specs.slice(0, 2).map((s) => (
                      <span
                        key={s}
                        className="text-xs px-1.5 py-0.5 rounded bg-muted cursor-pointer hover:bg-primary/20"
                        onClick={(e) => { e.stopPropagation(); toggleSpecFilter(s) }}
                      >
                        {SPEC_MAP.get(s) || s}
                      </span>
                    ))}
                    {specs.length > 2 && (
                      <span className="text-xs text-muted-foreground">+{specs.length - 2}</span>
                    )}
                  </div>
                )
              },
            },
            {
              key: 'province',
              label: 'Province',
              render: (r: Guide) => r.province || '—',
            },
            {
              key: 'rating',
              label: 'Rating',
              render: (r: Guide) => {
                const rating = r.avg_rating || r.average_rating || 0
                return rating > 0 ? (
                  <span className="flex items-center gap-0.5 text-amber-400">
                    <Star className="size-3.5 fill-amber-400" />
                    {Number(rating).toFixed(1)}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )
              },
            },
            {
              key: 'price',
              label: 'Price',
              render: (r: Guide) => (
                <div className="text-sm">
                  {r.pricePerDayUsd ? `$${Number(r.pricePerDayUsd).toFixed(2)}/day` : '—'}
                </div>
              ),
            },
          ]}
          actions={(row: Guide) => (
            <div className="flex items-center gap-1">
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => router.push(`/admin/guides/${row.id}`)}
                title="View Details"
              >
                <Eye size={13} />
              </button>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => openEdit(row)}
                title="Edit"
              >
                <Edit2 size={13} />
              </button>
              <button
                className="btn btn-ghost btn-icon btn-sm text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(row)}
                title="Deactivate"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        />
      </div>

      {/* Guide Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-8 pb-5" style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 32 }}>
            <DialogTitle>{editing ? 'Edit Guide' : 'Create Guide'}</DialogTitle>
          </DialogHeader>
          <GuideForm
            defaultValues={defaultFormValues}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={createMutation.isPending || updateMutation.isPending}
            isEditing={!!editing}
          />
        </DialogContent>
      </Dialog>

      {/* Deactivation Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Deactivate Guide"
        message={`Deactivate "${deleteTarget?.name || deleteTarget?.user?.name}"? They will stop appearing in search and cannot be booked. Existing bookings are unaffected, and you can reactivate them later.`}
        confirmLabel="Deactivate"
        variant="danger"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
