'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { toast } from 'sonner'

import { extractErrorMessage, tripsApi } from '@/lib/api'
import { FormField, Modal } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { TRIP_CATEGORIES } from './TripList'

/**
 * Creation dialog for a trip package.
 *
 * Only the English translation is collected here. A trip is worthless without a
 * non-blank English title — the backend refuses to publish without one, since
 * English is the public site's fallback locale — while Chinese and Khmer are
 * genuinely optional and are added from the detail view's translation tabs.
 */
/*
 * Numbers are plain `z.number()`, not `z.coerce.number()`.
 *
 * Coercion makes the schema's INPUT type `unknown`, which no longer matches the
 * resolver's output type and fails to compile against react-hook-form's generics.
 * The conversion is done at the field instead, via `valueAsNumber` on register —
 * which is what RHF provides for exactly this case.
 */
const schema = z.object({
  title: z.string().trim().min(1, 'An English title is required'),
  subtitle: z.string().trim().optional(),
  category: z.enum(TRIP_CATEGORIES),
  durationDays: z.number().int().min(1, 'At least 1 day').max(60),
  basePriceUsd: z.number().min(0, 'Price cannot be negative').max(1_000_000),
  maxCapacity: z.number().int().min(1).max(200),
})

type FormData = z.infer<typeof schema>

export function TripFormDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: 'temples',
      durationDays: 1,
      basePriceUsd: 0,
      maxCapacity: 10,
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      tripsApi.create({
        category: data.category,
        durationDays: data.durationDays,
        basePriceUsd: data.basePriceUsd,
        maxCapacity: data.maxCapacity,
        // Always a draft: an itinerary and guides come next, and publishing
        // before those exist would put an empty package on the public site.
        isPublished: false,
        translations: [
          {
            language: 'en',
            title: data.title,
            ...(data.subtitle ? { subtitle: data.subtitle } : {}),
          },
        ],
      }),
    onSuccess: (res) => {
      const trip = res.data as { id: string }
      reset()
      toast.success('Trip created as a draft')
      onCreated(trip.id)
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Failed to create trip')),
  })

  return (
    <Modal
      open={open}
      title="New Trip Package"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit((data) => createMutation.mutate(data))}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating…' : 'Create Draft'}
          </Button>
        </>
      }
    >
      <FormField label="English title" required error={errors.title?.message}>
        <Input {...register('title')} placeholder="e.g. Angkor Sunrise Discovery" />
      </FormField>

      <FormField label="Subtitle" error={errors.subtitle?.message}>
        <Input {...register('subtitle')} placeholder="Short tagline (optional)" />
      </FormField>

      <FormField label="Category" required error={errors.category?.message}>
        <select className="form-input" {...register('category')}>
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
        error={errors.durationDays?.message}
        hint="Itinerary stops cannot be placed on a day beyond this."
      >
        <Input type="number" min={1} max={60} {...register('durationDays', { valueAsNumber: true })} />
      </FormField>

      <FormField label="Base price (USD)" required error={errors.basePriceUsd?.message}>
        <Input type="number" step="0.01" min={0} {...register('basePriceUsd', { valueAsNumber: true })} />
      </FormField>

      <FormField label="Max capacity" required error={errors.maxCapacity?.message}>
        <Input type="number" min={1} max={200} {...register('maxCapacity', { valueAsNumber: true })} />
      </FormField>
    </Modal>
  )
}
