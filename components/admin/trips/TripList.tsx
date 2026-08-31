'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { extractErrorMessage, tripsApi } from '@/lib/api'
import {
  ConfirmDialog,
  DataTable,
  PageHeader,
  SearchInput,
  type Column,
} from '@/components/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { TripFormDialog } from './TripFormDialog'

export interface TripRow {
  id: string
  title: string | null
  subtitle: string | null
  category: string
  durationDays: number
  basePriceUsd: number
  maxCapacity: number
  coverImage: string | null
  images: string[]
  isPublished: boolean
  itineraryCount: number
  guideCount: number
  reviewCount: number
  createdAt: string
  updatedAt: string
}

/** Mirrors the TripCategory enum in schema.prisma. */
export const TRIP_CATEGORIES = [
  'temples',
  'nature',
  'culture',
  'adventure',
  'food',
  'custom',
] as const

export function TripList() {
  const router = useRouter()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [published, setPublished] = useState('all')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TripRow | null>(null)

  const listQuery = useQuery({
    queryKey: ['admin-trips', { search, category, published, page }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 }
      if (search.trim()) params.search = search.trim()
      if (category !== 'all') params.category = category
      // Omit entirely for "all": the backend treats an absent isPublished as
      // "both", and forbidNonWhitelisted rejects unexpected values.
      if (published !== 'all') params.isPublished = published
      const res = await tripsApi.list(params)
      return res.data as { data: TripRow[]; meta: { total: number } }
    },
    staleTime: 30000,
  })

  const publishMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) =>
      tripsApi.setPublished(id, next),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-trips'] })
      toast.success(vars.next ? 'Trip published' : 'Trip unpublished')
    },
    // Publishing without an English title is a 400 with an explanatory message —
    // surface it rather than a generic failure, since it is actionable.
    onError: (err) =>
      toast.error(extractErrorMessage(err, 'Failed to change publish state')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tripsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-trips'] })
      setDeleteTarget(null)
      toast.success('Trip deleted')
    },
    // A booked trip answers 409 naming the reference count; that message tells
    // the admin to unpublish instead, so pass it through verbatim.
    onError: (err) => toast.error(extractErrorMessage(err, 'Failed to delete trip')),
  })

  const columns: Column<TripRow>[] = [
    {
      key: 'title',
      label: 'Trip',
      render: (row) => (
        <div>
          <div className="font-medium">
            {row.title ?? (
              <span className="text-amber-600">— no English title —</span>
            )}
          </div>
          {row.subtitle ? (
            <div className="text-xs text-slate-500">{row.subtitle}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (row) => <Badge variant="outline">{row.category}</Badge>,
    },
    {
      key: 'durationDays',
      label: 'Days',
      sortable: true,
      render: (row) => `${row.durationDays}d`,
    },
    {
      key: 'basePriceUsd',
      label: 'Price',
      sortable: true,
      render: (row) => `$${row.basePriceUsd.toFixed(2)}`,
    },
    {
      key: 'itineraryCount',
      label: 'Itinerary',
      render: (row) => `${row.itineraryCount} stop(s)`,
    },
    {
      key: 'guideCount',
      label: 'Guides',
      render: (row) => row.guideCount,
    },
    {
      key: 'isPublished',
      label: 'Status',
      render: (row) =>
        row.isPublished ? (
          <Badge className="bg-emerald-100 text-emerald-800">Published</Badge>
        ) : (
          <Badge className="bg-slate-100 text-slate-700">Draft</Badge>
        ),
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      sortable: true,
      render: (row) => format(new Date(row.updatedAt), 'dd MMM yyyy'),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Trip Packages"
        subtitle="Create, translate and publish the trip catalogue."
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={15} /> New Trip
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(v: string) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search trip titles (any language)"
        />
        <Select
          value={category}
          onValueChange={(v: string) => {
            setCategory(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {TRIP_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={published}
          onValueChange={(v: string) => {
            setPublished(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="true">Published</SelectItem>
            <SelectItem value="false">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={listQuery.data?.data ?? []}
        loading={listQuery.isLoading}
        rowKey="id"
        emptyMessage="No trip packages yet — create the first one."
        totalCount={listQuery.data?.meta.total ?? 0}
        currentPage={page}
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/admin/trips/${row.id}`)}
        actions={(row) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              title="Edit"
              onClick={() => router.push(`/admin/trips/${row.id}`)}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title={row.isPublished ? 'Unpublish' : 'Publish'}
              disabled={publishMutation.isPending}
              onClick={() =>
                publishMutation.mutate({ id: row.id, next: !row.isPublished })
              }
            >
              {row.isPublished ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="Delete"
              onClick={() => setDeleteTarget(row)}
            >
              <Trash2 size={14} className="text-rose-600" />
            </Button>
          </div>
        )}
      />

      <TripFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => {
          setShowCreate(false)
          qc.invalidateQueries({ queryKey: ['admin-trips'] })
          // Straight into the detail view: a new trip still needs an itinerary
          // and guides before it is worth publishing.
          router.push(`/admin/trips/${id}`)
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Trip"
        message={`Delete "${deleteTarget?.title ?? 'this trip'}"? This removes its translations and itinerary permanently. Trips referenced by bookings cannot be deleted — unpublish them instead.`}
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  )
}
