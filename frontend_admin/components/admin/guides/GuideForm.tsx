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

const S = { background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' } as const
const LABEL = { color: 'var(--text-secondary)' } as const

const guideSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
  bio: z.string().optional(),
  profile_picture: z.string().optional(),
  languages: z.array(z.string()).optional(),
  specialties: z.array(z.string()).optional(),
  province: z.string().min(1, 'Province is required'),
  price_per_day_usd: z.number().min(0),
  experience_years: z.number().min(0).max(50).optional(),
  certifications: z.array(z.string()).optional(),
  is_verified: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

export type GuideFormData = z.infer<typeof guideSchema>

interface GuideFormProps {
  defaultValues?: Partial<GuideFormData>
  onSubmit: (data: GuideFormData) => void
  onCancel: () => void
  loading?: boolean
  isEditing?: boolean
}

const COMMON_LANGUAGES = ['English', 'Khmer', 'Chinese', 'Japanese', 'Korean', 'Thai', 'Vietnamese', 'French', 'German', 'Spanish']
const COMMON_SPECIALTIES = ['Temples', 'History', 'Culture', 'Nature', 'Food', 'Adventure', 'Photography', 'Architecture', 'Archaeology', 'Local Markets', 'Nightlife', 'Wellness']
const COMMON_CERTIFICATIONS = ['Licensed Tour Guide', 'First Aid Certified', 'Wilderness First Aid', 'Temple Authority License', 'Museum Guide License', 'National Park Guide']

export function GuideForm({ defaultValues, onSubmit, onCancel, loading = false, isEditing = false }: GuideFormProps) {
  const [imageUrl, setImageUrl] = useState<string>(defaultValues?.profile_picture || '')

  const form = useForm<GuideFormData>({
    resolver: zodResolver(guideSchema),
    defaultValues: {
      user_id: '', bio: '', profile_picture: '', languages: [], specialties: [],
      province: '', price_per_day_usd: 0, experience_years: 0, certifications: [],
      is_verified: false, is_active: true,
      ...defaultValues,
    },
  })

  const selectedLanguages = form.watch('languages') || []
  const selectedSpecialties = form.watch('specialties') || []
  const selectedCertifications = form.watch('certifications') || []

  const handleFormSubmit = (data: GuideFormData) => onSubmit({ ...data, profile_picture: imageUrl })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-5">

        {/* Basic Info */}
        <div className="rounded-xl space-y-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', padding: '16px 20px' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Basic Information</p>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="user_id" render={({ field }) => (
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

            <FormField control={form.control} name="price_per_day_usd" render={({ field }) => (
              <FormItem>
                <FormLabel style={LABEL}>Price/Day (USD) *</FormLabel>
                <FormControl><Input type="number" min={0} step={0.01} {...field} style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="experience_years" render={({ field }) => (
              <FormItem>
                <FormLabel style={LABEL}>Experience (years)</FormLabel>
                <FormControl><Input type="number" min={0} max={50} {...field} style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} /></FormControl>
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
            {COMMON_LANGUAGES.map((lang) => (
              <label key={lang} className="flex items-center gap-2 rounded-lg p-2.5 cursor-pointer transition-colors"
                style={{ background: 'var(--bg-overlay)', border: `1px solid ${selectedLanguages.includes(lang) ? 'var(--brand-primary)' : 'var(--border-strong)'}` }}>
                <Checkbox checked={selectedLanguages.includes(lang)}
                  onCheckedChange={(checked) => {
                    const cur = form.getValues('languages') || []
                    form.setValue('languages', checked === true ? [...cur, lang] : cur.filter(l => l !== lang))
                  }} />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{lang}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Specialties */}
        <div className="rounded-xl space-y-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', padding: '16px 20px' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Specialties</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {COMMON_SPECIALTIES.map((spec) => (
              <label key={spec} className="flex items-center gap-2 rounded-lg p-2.5 cursor-pointer transition-colors"
                style={{ background: 'var(--bg-overlay)', border: `1px solid ${selectedSpecialties.includes(spec) ? 'var(--brand-secondary)' : 'var(--border-strong)'}` }}>
                <Checkbox checked={selectedSpecialties.includes(spec)}
                  onCheckedChange={(checked) => {
                    const cur = form.getValues('specialties') || []
                    form.setValue('specialties', checked === true ? [...cur, spec] : cur.filter(s => s !== spec))
                  }} />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{spec}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Certifications */}
        <div className="rounded-xl space-y-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', padding: '16px 20px' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Certifications</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {COMMON_CERTIFICATIONS.map((cert) => (
              <label key={cert} className="flex items-center gap-2 rounded-lg p-2.5 cursor-pointer transition-colors"
                style={{ background: 'var(--bg-overlay)', border: `1px solid ${selectedCertifications.includes(cert) ? 'var(--brand-primary)' : 'var(--border-strong)'}` }}>
                <Checkbox checked={selectedCertifications.includes(cert)}
                  onCheckedChange={(checked) => {
                    const cur = form.getValues('certifications') || []
                    form.setValue('certifications', checked === true ? [...cur, cert] : cur.filter(c => c !== cert))
                  }} />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{cert}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Profile Picture */}
        <div className="rounded-xl space-y-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', padding: '16px 20px' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Profile Picture</p>
          <ImageUpload onUpload={(urls) => { setImageUrl(urls[0] || ''); form.setValue('profile_picture', urls[0] || '') }} maxFiles={1} />
          {imageUrl && (
            <div className="relative group rounded-lg overflow-hidden w-24 aspect-square" style={{ border: '1px solid var(--border-strong)' }}>
              <img src={imageUrl} alt="Profile" className="w-full h-full object-cover" />
              <button type="button" onClick={() => { setImageUrl(''); form.setValue('profile_picture', '') }}
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
