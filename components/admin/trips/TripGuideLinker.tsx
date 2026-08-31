'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { extractErrorMessage, guidesApi, tripsApi } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

interface GuideOption {
  id: string
  name?: string | null
  fullName?: string | null
  province?: string | null
  isActive?: boolean
}

export interface LinkedGuide {
  id: string
  userId: string
  isActive: boolean
  province: string | null
  fullName: string | null
  email: string | null
}

/**
 * Assigns which guides can run this package.
 *
 * The backend uses Prisma `set`, so the submitted list REPLACES the existing one
 * — unchecking is how a guide is removed. Inactive guides are rejected server
 * side, so they are shown disabled rather than offered and then refused.
 */
export function TripGuideLinker({
  tripId,
  linked,
}: {
  tripId: string
  linked: LinkedGuide[]
}) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string[]>(linked.map((g) => g.id))

  const guidesQuery = useQuery({
    queryKey: ['admin-guides-options'],
    queryFn: async () => {
      const res = await guidesApi.list({ limit: 100 })
      const payload = res.data as GuideOption[] | { data: GuideOption[] }
      return Array.isArray(payload) ? payload : payload.data
    },
    staleTime: 60000,
  })

  const saveMutation = useMutation({
    mutationFn: () => tripsApi.setGuides(tripId, selected),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-trip', tripId] })
      qc.invalidateQueries({ queryKey: ['admin-trips'] })
      toast.success('Guides updated')
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Failed to update guides')),
  })

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    )
  }

  const guides = guidesQuery.data ?? []

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-500">
          {selected.length} guide(s) assigned. Submitting replaces the current
          assignment, so unchecking a guide removes them.
        </p>
      </div>

      {guidesQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading guides…</p>
      ) : guides.length === 0 ? (
        <p className="text-sm text-slate-500">No guides available.</p>
      ) : (
        <ul className="space-y-2">
          {guides.map((guide) => {
            const inactive = guide.isActive === false
            const label = guide.fullName ?? guide.name ?? guide.id
            return (
              <li
                key={guide.id}
                className="flex items-center gap-3 rounded-md border p-2"
              >
                <Checkbox
                  checked={selected.includes(guide.id)}
                  disabled={inactive}
                  onCheckedChange={() => toggle(guide.id)}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{label}</div>
                  {guide.province ? (
                    <div className="text-xs text-slate-500">{guide.province}</div>
                  ) : null}
                </div>
                {inactive ? (
                  <Badge className="bg-slate-100 text-slate-600">
                    inactive — cannot assign
                  </Badge>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending ? 'Saving…' : 'Save guide assignment'}
      </Button>
    </div>
  )
}
