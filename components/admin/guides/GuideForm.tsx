'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Loader2 } from 'lucide-react'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ImageUpload } from '@/components/shared/ImageUpload'

const LABEL = { color: 'var(--text-secondary)' } as const

export const GUIDE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'km', label: 'Khmer' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'th', label: 'Thai' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
] as const

export const GUIDE_SPECIALTIES = [
  { code: 'culture_history', label: 'Culture & History' },
  { code: 'food_tours', label: 'Food Tours' },
  { code: 'nature_trekking', label: 'Nature & Trekking' },
  { code: 'photography', label: 'Photography' },
  { code: 'family_friendly', label: 'Family Friendly' },
  { code: 'business', label: 'Business' },
  { code: 'luxury', label: 'Luxury' },
  { code: 'adventure', label: 'Adventure' },
] as const

const guideSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  bio: z.string().optional(),
  avatarUrl: z.string().optional(),
  languages: z.array(z.string()).optional(),
  specialties: z.array(z.string()).optional(),
  province: z.string().min(1, 'Province is required'),
  pricePerDayUsd: z.number().min(0, 'Price must be 0 or more'),
  isVerified: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export type GuideFormData = z.infer<typeof guideSchema>

interface GuideFormProps {
  defaultValues?: Partial<GuideFormData> & Record<string, unknown>
  onSubmit: (data: GuideFormData) => void
  onCancel: () => void
  loading?: boolean
  isEditing?: boolean
}

export function GuideForm({ defaultValues, onSubmit, onCancel, loading = false, isEditing = false }: GuideFormProps) {
  const initialAvatar = (defaultValues?.avatarUrl as string) || (defaultValues?.profile_picture as string) || ''
  const [imageUrl, setImageUrl] = useState<string>(initialAvatar)

  const form = useForm<GuideFormData>({
    resolver: zodResolver(guideSchema),
    defaultValues: {
      userId: defaultValues?.userId || (defaultValues?.user_id as string) || '',
      bio: defaultValues?.bio || '',
      avatarUrl: initialAvatar,
      languages: defaultValues?.languages || [],
      specialties: defaultValues?.specialties || [],
      province: defaultValues?.province || '',
      pricePerDayUsd: defaultValues?.pricePerDayUsd ?? (defaultValues?.price_per_day_usd as number) ?? 0,
      isVerified: defaultValues?.isVerified ?? (defaultValues?.is_verified as boolean) ?? false,
      isActive: defaultValues?.isActive ?? (defaultValues?.is_active as boolean) ?? true,
    },
  })

  const selectedLanguages = form.watch('languages') || []
  const selectedSpecialties = form.watch('specialties') || []

  const handleFormSubmit = (data: GuideFormData) => {
    onSubmit({
      ...data,
      avatarUrl: imageUrl || data.avatarUrl || undefined,
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="px-6 pb-6 space-y-5" style={{ paddingLeft: 24, paddingRight: 24, paddingBottom: 24 }}>

        {/* Basic Info */}
        <div className="rounded-xl space-y-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', padding: '16px 20px' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Basic Information</p>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="userId" render={({ field }) => (
              <FormItem>
                <FormLabel style={LABEL}>User ID *</FormLabel>
                <FormControl><Input placeholder="UUID of existing user" {...field} style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} disabled={isEditing} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="province" render={({ field }) => (
              <FormItem>
                <FormLabel style={LABEL}>Province *</FormLabel>
                <FormControl><Input placeholder="e.g. Siem Reap" {...field} style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="pricePerDayUsd" render={({ field }) => (
              <FormItem>
                <FormLabel style={LABEL}>Price/Day (USD) *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    {...field}
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <FormField control={form.control} name="bio" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>Bio</FormLabel>
              <FormControl>
                <textarea className="w-full rounded-lg text-sm p-3 resize-none" rows={3} placeholder="Brief bio..."
                  {...field} value={field.value || ''}
                  style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Languages */}
        <div className="rounded-xl space-y-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', padding: '16px 20px' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Languages</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {GUIDE_LANGUAGES.map((lang) => (
              <label key={lang.code} className="flex items-center gap-2 rounded-lg p-2.5 cursor-pointer transition-colors"
                style={{ background: 'var(--bg-overlay)', border: `1px solid ${selectedLanguages.includes(lang.code) ? 'var(--brand-primary)' : 'var(--border-strong)'}` }}>
                <Checkbox checked={selectedLanguages.includes(lang.code)}
                  onCheckedChange={(checked) => {
                    const cur = form.getValues('languages') || []
                    form.setValue('languages', checked === true ? [...cur, lang.code] : cur.filter(l => l !== lang.code))
                  }} />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{lang.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Specialties */}
        <div className="rounded-xl space-y-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', padding: '16px 20px' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Specialties</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {GUIDE_SPECIALTIES.map((spec) => (
              <label key={spec.code} className="flex items-center gap-2 rounded-lg p-2.5 cursor-pointer transition-colors"
                style={{ background: 'var(--bg-overlay)', border: `1px solid ${selectedSpecialties.includes(spec.code) ? 'var(--brand-secondary)' : 'var(--border-strong)'}` }}>
                <Checkbox checked={selectedSpecialties.includes(spec.code)}
                  onCheckedChange={(checked) => {
                    const cur = form.getValues('specialties') || []
                    form.setValue('specialties', checked === true ? [...cur, spec.code] : cur.filter(s => s !== spec.code))
                  }} />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{spec.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Profile Picture */}
        <div className="rounded-xl space-y-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', padding: '16px 20px' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Profile Picture</p>
          <ImageUpload onUpload={(urls) => { setImageUrl(urls[0] || ''); form.setValue('avatarUrl', urls[0] || '') }} maxFiles={1} />
          {imageUrl && (
            <div className="relative group rounded-lg overflow-hidden w-24 aspect-square" style={{ border: '1px solid var(--border-strong)' }}>
              <img src={imageUrl} alt="Profile" className="w-full h-full object-cover" />
              <button type="button" onClick={() => { setImageUrl(''); form.setValue('avatarUrl', '') }}
                className="absolute top-1 right-1 size-5 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="size-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} style={{ background: 'var(--brand-primary)', color: '#fff' }}>
            {loading && <Loader2 className="size-4 animate-spin mr-1" />}
            {isEditing ? 'Save Changes' : 'Create Guide'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
