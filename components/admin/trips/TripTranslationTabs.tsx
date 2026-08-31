'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { extractErrorMessage, tripsApi } from '@/lib/api'
import { FormField } from '@/components/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

/**
 * Per-language copy editor.
 *
 * Every user-facing string on a trip lives on a translation row, not the trip, so
 * a language with no row shows nothing at all on the public site. English is
 * marked required because publishing is gated on it.
 */

export interface TripTranslation {
  language: string
  title: string
  subtitle: string | null
  description: string | null
  includedItems: string[]
  excludedItems: string[]
  cancellationPolicy: string | null
  meetingPoint: string | null
}

const LANGUAGES: { code: string; label: string; required?: boolean }[] = [
  { code: 'en', label: 'English', required: true },
  { code: 'zh', label: 'Chinese' },
  { code: 'km', label: 'Khmer' },
]

const EMPTY: TripTranslation = {
  language: 'en',
  title: '',
  subtitle: null,
  description: null,
  includedItems: [],
  excludedItems: [],
  cancellationPolicy: null,
  meetingPoint: null,
}

/** Textareas collect one item per line; the API takes a string array. */
function linesToArray(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

export function TripTranslationTabs({
  tripId,
  translations,
}: {
  tripId: string
  translations: TripTranslation[]
}) {
  const qc = useQueryClient()
  const [active, setActive] = useState('en')

  const existing =
    translations.find((t) => t.language === active) ?? { ...EMPTY, language: active }

  const [draft, setDraft] = useState<TripTranslation>(existing)
  const [dirtyFor, setDirtyFor] = useState<string | null>(null)

  // Switching tabs loads that language's stored copy. Tracked via dirtyFor rather
  // than an effect so an unsaved edit is not silently discarded on re-render.
  if (dirtyFor !== active) {
    setDraft(existing)
    setDirtyFor(active)
  }

  const saveMutation = useMutation({
    mutationFn: (payload: TripTranslation) =>
      // Only the edited language is sent. The backend upserts on
      // [tripId, language], so omitted languages are left untouched.
      tripsApi.update(tripId, {
        translations: [
          {
            language: payload.language,
            title: payload.title,
            ...(payload.subtitle ? { subtitle: payload.subtitle } : {}),
            ...(payload.description ? { description: payload.description } : {}),
            includedItems: payload.includedItems,
            excludedItems: payload.excludedItems,
            ...(payload.cancellationPolicy
              ? { cancellationPolicy: payload.cancellationPolicy }
              : {}),
            ...(payload.meetingPoint ? { meetingPoint: payload.meetingPoint } : {}),
          },
        ],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-trip', tripId] })
      qc.invalidateQueries({ queryKey: ['admin-trips'] })
      toast.success(`${active.toUpperCase()} translation saved`)
    },
    onError: (err) =>
      toast.error(extractErrorMessage(err, 'Failed to save translation')),
  })

  const titleMissing = draft.title.trim() === ''

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {LANGUAGES.map((lang) => {
          const has = translations.some(
            (t) => t.language === lang.code && t.title.trim() !== '',
          )
          return (
            <Button
              key={lang.code}
              variant={active === lang.code ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActive(lang.code)}
            >
              {lang.label}
              {has ? (
                <Badge className="ml-2 bg-emerald-100 text-emerald-800">set</Badge>
              ) : (
                <Badge className="ml-2 bg-slate-100 text-slate-600">empty</Badge>
              )}
            </Button>
          )
        })}
      </div>

      {active === 'en' && titleMissing ? (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          An English title is required before this trip can be published — it is
          the fallback used everywhere on the public site.
        </p>
      ) : null}

      <FormField
        label="Title"
        required={active === 'en'}
        error={active === 'en' && titleMissing ? 'Required for publishing' : undefined}
      >
        <Input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </FormField>

      <FormField label="Subtitle">
        <Input
          value={draft.subtitle ?? ''}
          onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
        />
      </FormField>

      <FormField label="Description">
        <Textarea
          rows={4}
          value={draft.description ?? ''}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </FormField>

      <FormField label="What's included" hint="One item per line">
        <Textarea
          rows={3}
          value={draft.includedItems.join('\n')}
          onChange={(e) =>
            setDraft({ ...draft, includedItems: linesToArray(e.target.value) })
          }
        />
      </FormField>

      <FormField label="What's excluded" hint="One item per line">
        <Textarea
          rows={3}
          value={draft.excludedItems.join('\n')}
          onChange={(e) =>
            setDraft({ ...draft, excludedItems: linesToArray(e.target.value) })
          }
        />
      </FormField>

      <FormField label="Meeting point">
        <Input
          value={draft.meetingPoint ?? ''}
          onChange={(e) => setDraft({ ...draft, meetingPoint: e.target.value })}
        />
      </FormField>

      <FormField label="Cancellation policy">
        <Textarea
          rows={3}
          value={draft.cancellationPolicy ?? ''}
          onChange={(e) =>
            setDraft({ ...draft, cancellationPolicy: e.target.value })
          }
        />
      </FormField>

      <Button
        onClick={() => saveMutation.mutate({ ...draft, language: active })}
        disabled={saveMutation.isPending || titleMissing}
      >
        {saveMutation.isPending ? 'Saving…' : `Save ${active.toUpperCase()}`}
      </Button>
    </div>
  )
}
