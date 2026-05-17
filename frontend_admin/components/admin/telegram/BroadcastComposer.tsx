'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { telegramApi } from '@/lib/api'
import { ImageUpload } from '@/components/shared/ImageUpload'
import { toast } from 'sonner'
import { Send, Eye, Users, Car, Bus, Truck } from 'lucide-react'

interface BroadcastComposerProps {
  onSent?: () => void
}

type TargetType = 'all' | 'online' | 'offline' | 'vehicle_type'
type VehicleType = 'VAN' | 'BUS' | 'TUK_TUK'

const TARGET_OPTIONS: { value: TargetType; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All Drivers', icon: <Users size={14} /> },
  { value: 'online', label: 'Online Only', icon: <Users size={14} /> },
  { value: 'offline', label: 'Offline Only', icon: <Users size={14} /> },
  { value: 'vehicle_type', label: 'By Vehicle Type', icon: <Car size={14} /> },
]

const VEHICLE_TYPES: { value: VehicleType; label: string; icon: React.ReactNode }[] = [
  { value: 'VAN', label: 'Van', icon: <Car size={14} /> },
  { value: 'BUS', label: 'Bus', icon: <Bus size={14} /> },
  { value: 'TUK_TUK', label: 'Tuk Tuk', icon: <Truck size={14} /> },
]

export function BroadcastComposer({ onSent }: BroadcastComposerProps) {
  const qc = useQueryClient()
  const [message, setMessage] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [targetType, setTargetType] = useState<TargetType>('all')
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [showPreview, setShowPreview] = useState(false)

  const sendMutation = useMutation({
    mutationFn: () => {
      const targetFilter: Record<string, any> = { type: targetType }
      if (targetType === 'vehicle_type') {
        targetFilter.vehicle_types = vehicleTypes
      }
      return telegramApi.broadcast({
        message,
        image_url: imageUrl || undefined,
        target_filter: targetFilter,
      })
    },
    onSuccess: () => {
      toast.success('Broadcast message sent successfully')
      setMessage('')
      setImageUrl('')
      setTargetType('all')
      setVehicleTypes([])
      setShowPreview(false)
      qc.invalidateQueries({ queryKey: ['telegram-broadcast-history'] })
      onSent?.()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to send broadcast')
    },
  })

  const canSend = message.trim().length > 0 && (targetType !== 'vehicle_type' || vehicleTypes.length > 0)

  const getTargetLabel = () => {
    const option = TARGET_OPTIONS.find((o) => o.value === targetType)
    if (targetType === 'vehicle_type') {
      const types = vehicleTypes.map((v) => VEHICLE_TYPES.find((t) => t.value === v)?.label || v)
      return types.length > 0 ? types.join(', ') : 'Select vehicle types'
    }
    return option?.label || 'All Drivers'
  }

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

        {/* Vehicle type selector */}
        {targetType === 'vehicle_type' && (
          <div className="flex flex-wrap gap-2 mt-3">
            {VEHICLE_TYPES.map((vt) => {
              const selected = vehicleTypes.includes(vt.value)
              return (
                <button
                  key={vt.value}
                  className={`btn btn-sm gap-1.5 ${selected ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setVehicleTypes((prev) =>
                      selected
                        ? prev.filter((v) => v !== vt.value)
                        : [...prev, vt.value]
                    )
                  }}
                >
                  {vt.icon}
                  {vt.label}
                </button>
              )
            })}
          </div>
        )}
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
