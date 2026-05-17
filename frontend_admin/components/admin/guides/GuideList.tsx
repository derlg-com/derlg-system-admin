'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Plus, Edit2, Eye, Trash2, Star, MapPin } from 'lucide-react'
import { guidesApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput, PageHeader, ConfirmDialog } from '@/components/shared'
import { GuideForm, type GuideFormData } from './GuideForm'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface Guide {
  id: string
  name?: string
  user?: { name: string }
  bio?: string
  profile_picture?: string
  languages?: string[]
  specialties?: string[]
  experience_years?: number
  certifications?: string[]
  price_per_hour?: number
  price_per_day?: number
  avg_rating?: number
  average_rating?: number
  total_assignments?: number
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

const ALL_LANGUAGES = [
  'English', 'Khmer', 'Chinese', 'Japanese', 'Korean',
  'Thai', 'Vietnamese', 'French', 'German', 'Spanish',
]

const ALL_SPECIALTIES = [
  'Temples', 'History', 'Culture', 'Nature', 'Food',
  'Adventure', 'Photography', 'Architecture', 'Archaeology',
  'Local Markets', 'Nightlife', 'Wellness',
]

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
    queryFn: () => guidesApi.list().then((r) => r.data as Guide[]),
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => guidesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-guides'] })
      setDeleteTarget(null)
      toast.success('Guide deleted successfully')
    },
    onError: () => toast.error('Failed to delete guide'),
  })

  const filtered = useMemo(() => {
    return data.filter((g: Guide) => {
      if (!search) return true
      const term = search.toLowerCase()
      const name = g.name || g.user?.name || ''
      return (
        name.toLowerCase().includes(term) ||
        g.bio?.toLowerCase().includes(term) ||
        g.specialties?.some((s) => s.toLowerCase().includes(term))
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
        name: editing.name || editing.user?.name,
        bio: editing.bio,
        profile_picture: editing.profile_picture,
        languages: editing.languages,
        specialties: editing.specialties,
        experience_years: editing.experience_years,
        certifications: editing.certifications,
        price_per_day: editing.price_per_day,
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name or specialty..."
        />
        {(langFilter.length > 0 || specFilter.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Filters:</span>
            {langFilter.map((lang) => (
              <span
                key={lang}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary cursor-pointer"
                onClick={() => toggleLangFilter(lang)}
              >
                {lang} ×
              </span>
            ))}
            {specFilter.map((spec) => (
              <span
                key={spec}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground cursor-pointer"
                onClick={() => toggleSpecFilter(spec)}
              >
                {spec} ×
              </span>
            ))}
            <button
              className="text-xs text-muted-foreground hover:text-primary"
              onClick={() => { setLangFilter([]); setSpecFilter([]) }}
            >
              Clear all
            </button>
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
              label: 'Name',
              sortable: true,
              render: (r: Guide) => (
                <div className="flex items-center gap-2">
                  {r.profile_picture ? (
                    <img
                      src={r.profile_picture}
                      alt={r.name || r.user?.name || ''}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <MapPin size={14} className="text-muted-foreground" />
                    </div>
                  )}
                  <span className="font-medium">{r.name || r.user?.name || '—'}</span>
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
                        {l}
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
                        {s}
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
                  {r.price_per_day ? `$${Number(r.price_per_day).toFixed(2)}/day` : '—'}
                </div>
              ),
            },
            {
              key: 'experience_years',
              label: 'Exp.',
              render: (r: Guide) => `${r.experience_years ?? 0}y`,
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
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        />
      </div>

      {/* Filter panels */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h4 className="text-sm font-medium mb-3">Filter by Language</h4>
          <div className="flex flex-wrap gap-2">
            {ALL_LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => toggleLangFilter(lang)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  langFilter.includes(lang)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-muted-foreground border-border-default hover:border-primary'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <h4 className="text-sm font-medium mb-3">Filter by Specialty</h4>
          <div className="flex flex-wrap gap-2">
            {ALL_SPECIALTIES.map((spec) => (
              <button
                key={spec}
                onClick={() => toggleSpecFilter(spec)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  specFilter.includes(spec)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-muted-foreground border-border-default hover:border-primary'
                }`}
              >
                {spec}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Guide Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
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

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Guide"
        message={`Are you sure you want to delete "${deleteTarget?.name || deleteTarget?.user?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
