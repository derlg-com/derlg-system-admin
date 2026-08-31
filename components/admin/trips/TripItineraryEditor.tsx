'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { extractErrorMessage, tripsApi } from '@/lib/api'
import { ConfirmDialog, FormField, Modal } from '@/components/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export interface ItineraryItem {
  id: string
  dayNumber: number
  sortOrder: number
  placeId: string | null
  hotelId: string | null
  translations: {
    language: string
    title: string
    description: string | null
  }[]
}

function englishTitle(item: ItineraryItem): string {
  return (
    item.translations.find((t) => t.language === 'en')?.title ??
    item.translations[0]?.title ??
    '(untitled stop)'
  )
}

/**
 * Day-grouped itinerary editor.
 *
 * Reordering sends ONE batched request rather than a call per row: moving a stop
 * shifts its siblings' sortOrder too, so per-row updates would leave the
 * itinerary transiently inconsistent and cost a round trip each.
 */
export function TripItineraryEditor({
  tripId,
  durationDays,
  items,
}: {
  tripId: string
  durationDays: number
  items: ItineraryItem[]
}) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ItineraryItem | null>(null)
  const [newDay, setNewDay] = useState(1)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-trip', tripId] })
    qc.invalidateQueries({ queryKey: ['admin-trips'] })
  }

  const addMutation = useMutation({
    mutationFn: () =>
      tripsApi.createItineraryItem(tripId, {
        dayNumber: newDay,
        // Append within the day.
        sortOrder: items.filter((i) => i.dayNumber === newDay).length,
        translations: [
          {
            language: 'en',
            title: newTitle.trim(),
            ...(newDescription.trim() ? { description: newDescription.trim() } : {}),
          },
        ],
      }),
    onSuccess: () => {
      invalidate()
      setShowAdd(false)
      setNewTitle('')
      setNewDescription('')
      toast.success('Itinerary stop added')
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Failed to add stop')),
  })

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => tripsApi.deleteItineraryItem(tripId, itemId),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
      toast.success('Stop removed')
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Failed to remove stop')),
  })

  const reorderMutation = useMutation({
    mutationFn: (payload: { itemId: string; dayNumber: number; sortOrder: number }[]) =>
      tripsApi.reorderItinerary(tripId, payload),
    onSuccess: () => {
      invalidate()
      toast.success('Itinerary reordered')
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Failed to reorder')),
  })

  /** Swaps a stop with its neighbour and re-numbers that whole day in one call. */
  const move = (item: ItineraryItem, direction: -1 | 1) => {
    const sameDay = items
      .filter((i) => i.dayNumber === item.dayNumber)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const index = sameDay.findIndex((i) => i.id === item.id)
    const target = index + direction
    if (target < 0 || target >= sameDay.length) return

    const reordered = [...sameDay]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]

    reorderMutation.mutate(
      reordered.map((i, position) => ({
        itemId: i.id,
        dayNumber: i.dayNumber,
        sortOrder: position,
      })),
    )
  }

  const days = Array.from({ length: durationDays }, (_, i) => i + 1)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {items.length} stop(s) across {durationDays} day(s)
        </p>
        <Button
          size="sm"
          onClick={() => {
            setNewDay(1)
            setShowAdd(true)
          }}
        >
          <Plus size={14} /> Add stop
        </Button>
      </div>

      {days.map((day) => {
        const dayItems = items
          .filter((i) => i.dayNumber === day)
          .sort((a, b) => a.sortOrder - b.sortOrder)

        return (
          <div key={day} className="rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline">Day {day}</Badge>
              <span className="text-xs text-slate-500">
                {dayItems.length} stop(s)
              </span>
            </div>

            {dayItems.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing planned for this day.</p>
            ) : (
              <ul className="space-y-2">
                {dayItems.map((item, index) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-md bg-slate-50 p-2"
                  >
                    <div>
                      <div className="text-sm font-medium">{englishTitle(item)}</div>
                      <div className="text-xs text-slate-500">
                        {item.translations.map((t) => t.language).join(', ')}
                        {item.placeId ? ' · linked place' : ''}
                        {item.hotelId ? ' · linked hotel' : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Move up"
                        disabled={index === 0 || reorderMutation.isPending}
                        onClick={() => move(item, -1)}
                      >
                        <ArrowUp size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Move down"
                        disabled={
                          index === dayItems.length - 1 || reorderMutation.isPending
                        }
                        onClick={() => move(item, 1)}
                      >
                        <ArrowDown size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Remove"
                        onClick={() => setDeleteTarget(item)}
                      >
                        <Trash2 size={14} className="text-rose-600" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}

      <Modal
        open={showAdd}
        title="Add Itinerary Stop"
        onClose={() => setShowAdd(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || newTitle.trim() === ''}
            >
              {addMutation.isPending ? 'Adding…' : 'Add stop'}
            </Button>
          </>
        }
      >
        <FormField
          label="Day"
          required
          hint={`This trip runs ${durationDays} day(s); stops cannot go beyond that.`}
        >
          <select
            className="form-input"
            value={newDay}
            onChange={(e) => setNewDay(Number(e.target.value))}
          >
            {days.map((d) => (
              <option key={d} value={d}>
                Day {d}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="English title" required>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Sunrise at Angkor Wat"
          />
        </FormField>

        <FormField label="Description">
          <Textarea
            rows={3}
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
        </FormField>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Stop"
        message={`Remove "${deleteTarget ? englishTitle(deleteTarget) : ''}" from the itinerary? Its translations are removed with it.`}
        confirmLabel="Remove"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  )
}
