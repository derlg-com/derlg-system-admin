'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Loader2, Star } from 'lucide-react'
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
import { LocationPicker } from './LocationPicker'

const S = { background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' } as const
const LABEL = { color: 'var(--text-secondary)' } as const

const hotelSchema = z.object({
  name: z.string().min(1, 'Hotel name is required').max(255),
  description: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  images: z.array(z.string()).optional(),
  star_rating: z.number().min(0).max(5).optional(),
  amenities: z.array(z.string()).optional(),
  check_in_time: z.string().optional(),
  check_out_time: z.string().optional(),
  cancellation_policy: z.string().optional(),
})

export type HotelFormData = z.infer<typeof hotelSchema>

interface HotelFormProps {
  defaultValues?: Partial<HotelFormData>
  onSubmit: (data: HotelFormData) => void
  onCancel: () => void
  loading?: boolean
  isEditing?: boolean
}

const HOTEL_AMENITIES = [
  'WiFi', 'Swimming Pool', 'Spa', 'Gym', 'Restaurant', 'Bar',
  'Parking', 'Airport Shuttle', 'Room Service', 'Laundry',
  'Business Center', 'Conference Room', 'Pet Friendly', 'Beach Access', 'Rooftop Terrace',
]

export function HotelForm({ defaultValues, onSubmit, onCancel, loading = false, isEditing = false }: HotelFormProps) {
  const [imageUrls, setImageUrls] = useState<string[]>(defaultValues?.images || [])

  const form = useForm<HotelFormData>({
    resolver: zodResolver(hotelSchema),
    defaultValues: {
      name: '', description: '', latitude: 11.5564, longitude: 104.9282,
      images: [], star_rating: 0, amenities: [],
      check_in_time: '14:00', check_out_time: '12:00', cancellation_policy: '',
      ...defaultValues,
    },
  })

  const selectedAmenities = form.watch('amenities') || []
  const starRating = form.watch('star_rating') || 0

  const handleFormSubmit = (data: HotelFormData) => onSubmit({ ...data, images: imageUrls })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="px-6 pb-6 space-y-5" style={{ paddingLeft: 24, paddingRight: 24, paddingBottom: 24 }}>

        {/* Basic Info */}
        <div className="rounded-xl space-y-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', padding: '16px 20px' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Basic Information</p>

          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>Hotel Name *</FormLabel>
              <FormControl><Input placeholder="e.g. Sokha Phnom Penh" {...field} style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>Description</FormLabel>
              <FormControl>
                <textarea className="w-full rounded-lg text-sm p-3 resize-none" rows={3} placeholder="Brief description of the hotel..."
                  {...field} value={field.value || ''}
                  style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="check_in_time" render={({ field }) => (
              <FormItem>
                <FormLabel style={LABEL}>Check-in Time</FormLabel>
                <FormControl><Input type="time" {...field} value={field.value || ''} style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="check_out_time" render={({ field }) => (
              <FormItem>
                <FormLabel style={LABEL}>Check-out Time</FormLabel>
                <FormControl><Input type="time" {...field} value={field.value || ''} style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <FormField control={form.control} name="star_rating" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>Star Rating</FormLabel>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button" onClick={() => field.onChange(star)} className="p-1 transition-colors">
                    <Star className={`size-6 ${star <= starRating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'}`} />
                  </button>
                ))}
                <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>{starRating > 0 ? `${starRating} stars` : 'No rating'}</span>
              </div>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="cancellation_policy" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>Cancellation Policy</FormLabel>
              <FormControl><Input placeholder="e.g. Free cancellation up to 24 hours before check-in" {...field} value={field.value || ''} style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Location */}
        <div className="rounded-xl space-y-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', padding: '16px 20px' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Location</p>
          <LocationPicker
            lat={form.watch('latitude')}
            lng={form.watch('longitude')}
            onChange={(lat, lng) => { form.setValue('latitude', lat); form.setValue('longitude', lng) }}
          />
        </div>

        {/* Amenities */}
        <div className="rounded-xl space-y-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', padding: '16px 20px' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Amenities</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {HOTEL_AMENITIES.map((amenity) => (
              <label key={amenity} className="flex items-center gap-2 rounded-lg p-2.5 cursor-pointer transition-colors"
                style={{ background: 'var(--bg-overlay)', border: `1px solid ${selectedAmenities.includes(amenity) ? 'var(--brand-primary)' : 'var(--border-strong)'}` }}>
                <Checkbox checked={selectedAmenities.includes(amenity)}
                  onCheckedChange={(checked) => {
                    const cur = form.getValues('amenities') || []
                    form.setValue('amenities', checked === true ? [...cur, amenity] : cur.filter(a => a !== amenity))
                  }} />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{amenity}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Images */}
        <div className="rounded-xl space-y-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', padding: '16px 20px' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Images</p>
          <ImageUpload onUpload={(urls) => { setImageUrls(urls); form.setValue('images', urls) }} multiple maxFiles={5} />
          {imageUrls.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {imageUrls.map((url) => (
                <div key={url} className="relative group rounded-lg overflow-hidden aspect-video" style={{ border: '1px solid var(--border-strong)' }}>
                  <img src={url} alt="Hotel" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => { const u = imageUrls.filter(u => u !== url); setImageUrls(u); form.setValue('images', u) }}
                    className="absolute top-1 right-1 size-5 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="size-3" />
                  </button>
                </div>
              ))}
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
            {isEditing ? 'Save Changes' : 'Create Hotel'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
