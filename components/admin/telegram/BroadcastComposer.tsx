'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { telegramApi } from '@/lib/api'
import { getApiErrorMessage } from '@/lib/utils'
import { ImageUpload } from '@/components/shared/ImageUpload'
import { toast } from 'sonner'
import { Send, Eye, Users, Car, Bus, Truck } from 'lucide-react'

interface BroadcastComposerProps {
  onSent?: () => void
}

/*
 * Audience options mirror what the backend can actually filter on.
 *
 * `BroadcastTargetFilterDto` accepts `{ status?, province? }` where status is a
 * DriverStatus (AVAILABLE | BUSY | OFFLINE). This component previously offered
 * "By Vehicle Type" and posted `vehicle_types`, which the backend has no support
 * for — and because validation runs with `forbidNonWhitelisted`, that request was
 * rejected outright rather than silently ignoring the filter. The unsupported
 * option is gone and the remaining ones are named after the statuses they send.
 */
type TargetType = 'all' | 'AVAILABLE' | 'BUSY' | 'OFFLINE'

const TARGET_OPTIONS: { value: TargetType; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All Drivers', icon: <Users size={14} /> },
  { value: 'AVAILABLE', label: 'Available', icon: <Car size={14} /> },
  { value: 'BUSY', label: 'Busy', icon: <Bus size={14} /> },
  { value: 'OFFLINE', label: 'Offline', icon: <Truck size={14} /> },
]

export function BroadcastComposer({ onSent }: BroadcastComposerProps) {
  const qc = useQueryClient()
  const [message, setMessage] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [targetType, setTargetType] = useState<TargetType>('all')
  const [showPreview, setShowPreview] = useState(false)

  const sendMutation = useMutation({
    mutationFn: () =>
      // camelCase, matching AdminBroadcastDto. The previous snake_case
      // `image_url` / `target_filter` were silently dropped by class-transformer
      // and then rejected by forbidNonWhitelisted.
      telegramApi.broadcast({
        message,
        ...(imageUrl ? { imageUrl } : {}),
        // 'all' means no filter at all — omit the key rather than sending a
        // status the enum does not contain.
        ...(targetType === 'all' ? {} : { targetFilter: { status: targetType } }),
      }),
    onSuccess: () => {
      toast.success('Broadcast message sent successfully')
      setMessage('')
      setImageUrl('')
      setTargetType('all')
      setShowPreview(false)
      qc.invalidateQueries({ queryKey: ['telegram-broadcast-history'] })
      onSent?.()
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to send broadcast'))
    },
  })

  const canSend = message.trim().length > 0

  const getTargetLabel = () =>
    TARGET_OPTIONS.find((o) => o.value === targetType)?.label ?? 'All Drivers'

  return (
    <div className="card space-y-4">
      <div className="card-header">
        <span className="card-title">Compose Broadcast</span>
      </div>

      {/* Message Editor */}
      <div>
        <label className="form-label">Message</label>
        <textarea
          className="form-input"
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your broadcast message here..."
          maxLength={4096}
        />
        <div className="flex justify-end mt-1">
          <span className="text-xs text-muted-foreground">{message.length}/4096</span>
        </div>
      </div>

      {/* Image Upload */}
      <div>
        <label className="form-label">Image (optional)</label>
        <ImageUpload
          onUpload={(urls) => setImageUrl(urls[0] || '')}
          maxFiles={1}
          multiple={false}
        />
      </div>

      {/* Audience Selector */}
      <div>
        <label className="form-label">Target Audience</label>
        <div className="flex flex-wrap gap-2">
          {TARGET_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`btn btn-sm gap-1.5 ${targetType === option.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTargetType(option.value)}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>

      </div>

      {/* Preview */}
      {showPreview && (
        <div className="rounded-lg border p-4 space-y-3"
          style={{ background: 'var(--bg-muted)', borderColor: 'var(--border-default)' }}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Eye size={14} />
            Preview
          </div>
          <div className="rounded-lg border p-3 bg-background"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <p className="text-sm whitespace-pre-wrap">{message || 'No message'}</p>
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Broadcast"
                className="mt-2 rounded-md max-h-48 object-cover"
              />
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Target: <span className="font-medium text-foreground">{getTargetLabel()}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end pt-2">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowPreview(!showPreview)}
          disabled={!message.trim()}
        >
          <Eye size={14} />
          {showPreview ? 'Hide Preview' : 'Preview'}
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => sendMutation.mutate()}
          disabled={!canSend || sendMutation.isPending}
        >
          {sendMutation.isPending ? (
            <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
          ) : (
            <Send size={14} />
          )}
          Send Broadcast
        </button>
      </div>
    </div>
  )
}
