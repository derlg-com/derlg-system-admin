'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

import { extractErrorMessage, tripsApi } from '@/lib/api'
import { ConfirmDialog, FormField, PageHeader } from '@/components/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ImageUpload } from '@/components/shared/ImageUpload'

import { TRIP_CATEGORIES } from './TripList'
import { TripTranslationTabs, type TripTranslation } from './TripTranslationTabs'
import { TripItineraryEditor, type ItineraryItem } from './TripItineraryEditor'
import { TripGuideLinker, type LinkedGuide } from './TripGuideLinker'

interface TripDetail {
  id: string
  category: string
  durationDays: number
  basePriceUsd: number
  maxCapacity: number
  coverImage: string | null
  images: string[]
  isPublished: boolean
  translations: TripTranslation[]
  itineraryItems: ItineraryItem[]
  guides: LinkedGuide[]
  reviewCount: number
  bookingItemCount: number
}

type Tab = 'details' | 'translations' | 'itinerary' | 'guides' | 'media'

const TABS: { key: Tab; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'translations', label: 'Translations' },
  { key: 'itinerary', label: 'Itinerary' },
  { key: 'guides', label: 'Guides' },
  { key: 'media', label: 'Images' },
]

export function TripDetailView({ tripId }: { tripId: string }) {
  const router = useRouter()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('details')
  const [confirmPublish, setConfirmPublish] = useState(false)

  const tripQuery = useQuery({
    queryKey: ['admin-trip', tripId],
    queryFn: async () => {
      const res = await tripsApi.get(tripId)
      return res.data as TripDetail
    },
    staleTime: 60000,
  })

  const trip = tripQuery.data

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-trip', tripId] })
    qc.invalidateQueries({ queryKey: ['admin-trips'] })
  }

  const publishMutation = useMutation({
    mutationFn: (next: boolean) => tripsApi.setPublished(tripId, next),
    onSuccess: (_res, next) => {
      invalidate()
      setConfirmPublish(false)
      toast.success(next ? 'Trip published' : 'Trip unpublished')
    },
    // The 400 for a missing English title is actionable, so show it verbatim.
    onError: (err) =>
      toast.error(extractErrorMessage(err, 'Failed to change publish state')),
  })

  const detailsMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) => tripsApi.update(tripId, patch),
    onSuccess: () => {
      invalidate()
      toast.success('Trip updated')
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Failed to update trip')),
  })

  if (tripQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading trip…</p>
  }
  if (tripQuery.isError || !trip) {
    return <p className="text-sm text-rose-600">Could not load this trip.</p>
  }

  const englishTitle =
    trip.translations.find((t) => t.language === 'en')?.title ?? null
  const canPublish = !!englishTitle && englishTitle.trim() !== ''

  return (
    <div className="space-y-4">
      <PageHeader
        title={englishTitle ?? 'Untitled trip'}
        subtitle={`${trip.category} · ${trip.durationDays} day(s) · $${trip.basePriceUsd.toFixed(2)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => router.push('/admin/trips')}>
              <ArrowLeft size={15} /> Back
            </Button>
            {trip.isPublished ? (
              <Badge className="bg-emerald-100 text-emerald-800">Published</Badge>
            ) : (
              <Badge className="bg-slate-100 text-slate-700">Draft</Badge>
            )}
            <Button
              variant={trip.isPublished ? 'outline' : 'default'}
              disabled={!trip.isPublished && !canPublish}
              title={
                !trip.isPublished && !canPublish
                  ? 'Add an English title before publishing'
                  : undefined
              }
              onClick={() => setConfirmPublish(true)}
            >
              {trip.isPublished ? (
                <>
                  <EyeOff size={15} /> Unpublish
                </>
              ) : (
                <>
                  <Eye size={15} /> Publish
                </>
              )}
            </Button>
          </>
        }
      />

      {trip.bookingItemCount > 0 ? (
        <p className="rounded-md bg-sky-50 p-3 text-sm text-sky-900">
          This trip is referenced by {trip.bookingItemCount} booking item(s), so it
          cannot be deleted. Unpublish it instead to remove it from the catalogue.
        </p>
      ) : null}

      <div className="flex gap-2 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`px-3 py-2 text-sm ${
              tab === t.key
                ? 'border-b-2 border-emerald-600 font-medium text-emerald-700'
                : 'text-slate-500'
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'details' ? (
        <TripDetailsForm
          trip={trip}
          saving={detailsMutation.isPending}
          onSave={(patch) => detailsMutation.mutate(patch)}
        />
      ) : null}

      {tab === 'translations' ? (
        <TripTranslationTabs tripId={tripId} translations={trip.translations} />
      ) : null}

      {tab === 'itinerary' ? (
        <TripItineraryEditor
          tripId={tripId}
          durationDays={trip.durationDays}
          items={trip.itineraryItems}
        />
      ) : null}

      {tab === 'guides' ? (
        <TripGuideLinker tripId={tripId} linked={trip.guides} />
      ) : null}

      {tab === 'media' ? (
        <TripMediaPanel
          trip={trip}
          saving={detailsMutation.isPending}
          onSave={(patch) => detailsMutation.mutate(patch)}
        />
      ) : null}

      <ConfirmDialog
        open={confirmPublish}
        title={trip.isPublished ? 'Unpublish Trip' : 'Publish Trip'}
        message={
          trip.isPublished
            ? 'Hide this trip from the public catalogue? Existing bookings are unaffected.'
            : 'Make this trip visible on the public site? It will become bookable immediately.'
        }
        confirmLabel={trip.isPublished ? 'Unpublish' : 'Publish'}
        variant="primary"
        loading={publishMutation.isPending}
        onCancel={() => setConfirmPublish(false)}
        onConfirm={() => publishMutation.mutate(!trip.isPublished)}
      />
    </div>
  )
}

function TripDetailsForm({
  trip,
  saving,
  onSave,
}: {
  trip: TripDetail
  saving: boolean
  onSave: (patch: Record<string, unknown>) => void
}) {
  const [category, setCategory] = useState(trip.category)
  const [durationDays, setDurationDays] = useState(trip.durationDays)
  const [basePriceUsd, setBasePriceUsd] = useState(trip.basePriceUsd)
  const [maxCapacity, setMaxCapacity] = useState(trip.maxCapacity)

  const latestItineraryDay = trip.itineraryItems.reduce(
    (max, item) => Math.max(max, item.dayNumber),
    0,
  )

  return (
    <div className="max-w-lg space-y-1">
      <FormField label="Category" required>
        <select
          className="form-input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {TRIP_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label="Duration (days)"
        required
        hint={
          latestItineraryDay > 0
            ? `The itinerary currently reaches day ${latestItineraryDay}; shortening below that is rejected.`
            : undefined
        }
      >
        <Input
          type="number"
          min={1}
          max={60}
          value={durationDays}
          onChange={(e) => setDurationDays(Number(e.target.value))}
        />
      </FormField>

      <FormField label="Base price (USD)" required>
        <Input
          type="number"
          step="0.01"
          min={0}
          value={basePriceUsd}
          onChange={(e) => setBasePriceUsd(Number(e.target.value))}
        />
      </FormField>

      <FormField label="Max capacity" required>
        <Input
          type="number"
          min={1}
          max={200}
          value={maxCapacity}
          onChange={(e) => setMaxCapacity(Number(e.target.value))}
        />
      </FormField>

      <Button
        disabled={saving}
        onClick={() =>
          onSave({ category, durationDays, basePriceUsd, maxCapacity })
        }
      >
        {saving ? 'Saving…' : 'Save details'}
      </Button>
    </div>
  )
}

function TripMediaPanel({
  trip,
  saving,
  onSave,
}: {
  trip: TripDetail
  saving: boolean
  onSave: (patch: Record<string, unknown>) => void
}) {
  const [images, setImages] = useState<string[]>(trip.images)
  const [coverImage, setCoverImage] = useState<string | null>(trip.coverImage)

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Images upload straight to MinIO via a presigned URL — the browser never
        holds storage credentials.
      </p>

      <ImageUpload
        multiple
        maxFiles={10}
        // ImageUpload reports the finished object keys/URLs in one callback.
        // Appended rather than replaced so several uploads accumulate, and the
        // first upload becomes the cover when none is set yet.
        onUpload={(urls: string[]) => {
          if (urls.length === 0) return
          const next = [...images, ...urls.filter((u) => !images.includes(u))]
          setImages(next)
          if (!coverImage) setCoverImage(urls[0])
        }}
      />

      {images.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-medium">Gallery ({images.length})</p>
          <ul className="space-y-1">
            {images.map((key) => (
              <li
                key={key}
                className="flex items-center justify-between rounded-md bg-slate-50 p-2 text-sm"
              >
                <span className="truncate">{key}</span>
                <div className="flex items-center gap-2">
                  {coverImage === key ? (
                    <Badge className="bg-emerald-100 text-emerald-800">cover</Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCoverImage(key)}
                    >
                      Make cover
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setImages(images.filter((i) => i !== key))
                      if (coverImage === key) setCoverImage(null)
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Button
        disabled={saving}
        onClick={() => onSave({ images, coverImage: coverImage ?? undefined })}
      >
        {saving ? 'Saving…' : 'Save images'}
      </Button>
    </div>
  )
}
