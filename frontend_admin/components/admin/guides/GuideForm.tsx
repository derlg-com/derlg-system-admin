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

const guideSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  bio: z.string().optional(),
  profile_picture: z.string().optional(),
  languages: z.array(z.string()).optional(),
  specialties: z.array(z.string()).optional(),
  experience_years: z.number().min(0, 'Must be at least 0').max(50).optional(),
  certifications: z.array(z.string()).optional(),
  price_per_hour: z.number().min(0, 'Price must be positive').optional(),
  price_per_day: z.number().min(0, 'Price must be positive').optional(),
})

export type GuideFormData = z.infer<typeof guideSchema>

interface GuideFormProps {
  defaultValues?: Partial<GuideFormData>
  onSubmit: (data: GuideFormData) => void
  onCancel: () => void
  loading?: boolean
  isEditing?: boolean
}

const COMMON_LANGUAGES = [
  'English',
  'Khmer',
  'Chinese',
  'Japanese',
  'Korean',
  'Thai',
  'Vietnamese',
  'French',
  'German',
  'Spanish',
]

const COMMON_SPECIALTIES = [
  'Temples',
  'History',
  'Culture',
  'Nature',
  'Food',
  'Adventure',
  'Photography',
  'Architecture',
  'Archaeology',
  'Local Markets',
  'Nightlife',
  'Wellness',
]

const COMMON_CERTIFICATIONS = [
  'Licensed Tour Guide',
  'First Aid Certified',
  'Wilderness First Aid',
  'Temple Authority License',
  'Museum Guide License',
  'National Park Guide',
]

export function GuideForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading = false,
  isEditing = false,
}: GuideFormProps) {
  const [imageUrl, setImageUrl] = useState<string>(defaultValues?.profile_picture || '')

  const form = useForm<GuideFormData>({
    resolver: zodResolver(guideSchema),
    defaultValues: {
      name: '',
      bio: '',
      profile_picture: '',
      languages: [],
      specialties: [],
      experience_years: 0,
      certifications: [],
      price_per_hour: 0,
      price_per_day: 0,
      ...defaultValues,
    },
  })

  const selectedLanguages = form.watch('languages') || []
  const selectedSpecialties = form.watch('specialties') || []
  const selectedCertifications = form.watch('certifications') || []

  const toggleLanguage = (lang: string) => {
    const current = form.getValues('languages') || []
    if (current.includes(lang)) {
      form.setValue('languages', current.filter((l) => l !== lang))
    } else {
      form.setValue('languages', [...current, lang])
    }
  }

  const toggleSpecialty = (spec: string) => {
    const current = form.getValues('specialties') || []
    if (current.includes(spec)) {
      form.setValue('specialties', current.filter((s) => s !== spec))
    } else {
      form.setValue('specialties', [...current, spec])
    }
  }

  const toggleCertification = (cert: string) => {
    const current = form.getValues('certifications') || []
    if (current.includes(cert)) {
      form.setValue('certifications', current.filter((c) => c !== cert))
    } else {
      form.setValue('certifications', [...current, cert])
    }
  }

  const handleImageUploaded = (urls: string[]) => {
    const url = urls[0] || ''
    setImageUrl(url)
    form.setValue('profile_picture', url)
  }

  const handleRemoveImage = () => {
    setImageUrl('')
    form.setValue('profile_picture', '')
  }

  const handleFormSubmit = (data: GuideFormData) => {
    onSubmit({ ...data, profile_picture: imageUrl })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Guide Name *</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Sokha Kim" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <textarea
                  className="form-textarea w-full"
                  rows={3}
                  placeholder="Brief bio..."
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="experience_years"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Experience (years)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} max={50} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price_per_hour"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price/Hour ($)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step={0.01} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price_per_day"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price/Day ($)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step={0.01} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Languages */}
        <FormField
          control={form.control}
          name="languages"
          render={() => (
            <FormItem>
              <FormLabel>Languages</FormLabel>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-1">
                {COMMON_LANGUAGES.map((lang) => (
                  <div
                    key={lang}
                    className="flex items-center gap-2 rounded-md border border-border-default p-2 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleLanguage(lang)}
                  >
                    <Checkbox
                      checked={selectedLanguages.includes(lang)}
                      onCheckedChange={() => toggleLanguage(lang)}
                    />
                    <span className="text-sm">{lang}</span>
                  </div>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Specialties */}
        <FormField
          control={form.control}
          name="specialties"
          render={() => (
            <FormItem>
              <FormLabel>Specialties</FormLabel>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                {COMMON_SPECIALTIES.map((spec) => (
                  <div
                    key={spec}
                    className="flex items-center gap-2 rounded-md border border-border-default p-2 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleSpecialty(spec)}
                  >
                    <Checkbox
                      checked={selectedSpecialties.includes(spec)}
                      onCheckedChange={() => toggleSpecialty(spec)}
                    />
                    <span className="text-sm">{spec}</span>
                  </div>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Certifications */}
        <FormField
          control={form.control}
          name="certifications"
          render={() => (
            <FormItem>
              <FormLabel>Certifications</FormLabel>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                {COMMON_CERTIFICATIONS.map((cert) => (
                  <div
                    key={cert}
                    className="flex items-center gap-2 rounded-md border border-border-default p-2 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleCertification(cert)}
                  >
                    <Checkbox
                      checked={selectedCertifications.includes(cert)}
                      onCheckedChange={() => toggleCertification(cert)}
                    />
                    <span className="text-sm">{cert}</span>
                  </div>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Profile Picture */}
        <div className="space-y-2">
          <FormLabel>Profile Picture</FormLabel>
          <ImageUpload onUpload={handleImageUploaded} maxFiles={1} />
          {imageUrl && (
            <div className="relative group rounded-md overflow-hidden border aspect-square w-24 mt-2">
              <img
                src={imageUrl}
                alt="Profile"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-1 right-1 size-5 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="size-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin mr-1" />}
            {isEditing ? 'Save Changes' : 'Create Guide'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
