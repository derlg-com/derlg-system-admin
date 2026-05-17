'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
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

const hotelSchema = z.object({
  name: z.string().min(1, 'Hotel name is required').max(255),
  description: z.string().optional(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  images: z.array(z.string()).optional(),
  rating: z.number().min(0).max(5).optional(),
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
  'WiFi',
  'Swimming Pool',
  'Spa',
  'Gym',
  'Restaurant',
  'Bar',
  'Parking',
  'Airport Shuttle',
  'Room Service',
  'Laundry',
  'Business Center',
  'Conference Room',
  'Pet Friendly',
  'Beach Access',
  'Rooftop Terrace',
]

export function HotelForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading = false,
  isEditing = false,
}: HotelFormProps) {
  const [imageUrls, setImageUrls] = useState<string[]>(defaultValues?.images || [])

  const form = useForm<HotelFormData>({
    resolver: zodResolver(hotelSchema),
    defaultValues: {
      name: '',
      description: '',
      location: { lat: 11.5564, lng: 104.9282 },
      images: [],
      rating: 0,
      amenities: [],
      check_in_time: '14:00',
      check_out_time: '12:00',
      cancellation_policy: '',
      ...defaultValues,
    },
  })

  const selectedAmenities = form.watch('amenities') || []
  const rating = form.watch('rating') || 0

  const toggleAmenity = (amenity: string) => {
    const current = form.getValues('amenities') || []
    if (current.includes(amenity)) {
      form.setValue('amenities', current.filter((a) => a !== amenity))
    } else {
      form.setValue('amenities', [...current, amenity])
    }
  }

  const handleImagesUploaded = (urls: string[]) => {
    setImageUrls(urls)
    form.setValue('images', urls)
  }

  const handleRemoveImage = (url: string) => {
    const updated = imageUrls.filter((u) => u !== url)
    setImageUrls(updated)
    form.setValue('images', updated)
  }

  const handleFormSubmit = (data: HotelFormData) => {
    onSubmit({ ...data, images: imageUrls })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hotel Name *</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Sokha Phnom Penh" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input placeholder="Brief description of the hotel..." {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Location Picker */}
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
              <FormControl>
                <LocationPicker
                  lat={field.value?.lat}
                  lng={field.value?.lng}
                  onChange={(lat, lng) => field.onChange({ lat, lng })}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="check_in_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Check-in Time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="check_out_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Check-out Time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Rating */}
        <FormField
          control={form.control}
          name="rating"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Star Rating</FormLabel>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => field.onChange(star)}
                    className="p-1 transition-colors"
                  >
                    <Star
                      className={`size-6 ${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'}`}
                    />
                  </button>
                ))}
                <span className="ml-2 text-sm text-muted-foreground">{rating > 0 ? `${rating} stars` : 'No rating'}</span>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="cancellation_policy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cancellation Policy</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Free cancellation up to 24 hours before check-in" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Amenities */}
        <FormField
          control={form.control}
          name="amenities"
          render={() => (
            <FormItem>
              <FormLabel>Amenities</FormLabel>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-1">
                {HOTEL_AMENITIES.map((amenity) => (
                  <div
                    key={amenity}
                    className="flex items-center gap-2 rounded-md border border-border-default p-2 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleAmenity(amenity)}
                  >
                    <Checkbox
                      checked={selectedAmenities.includes(amenity)}
                      onCheckedChange={() => toggleAmenity(amenity)}
                    />
                    <span className="text-sm">{amenity}</span>
                  </div>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Images */}
        <div className="space-y-2">
          <FormLabel>Images</FormLabel>
          <ImageUpload onUpload={handleImagesUploaded} multiple maxFiles={5} />
          {imageUrls.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-2">
              {imageUrls.map((url) => (
                <div key={url} className="relative group rounded-md overflow-hidden border aspect-video">
                  <img src={url} alt="Hotel" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(url)}
                    className="absolute top-1 right-1 size-5 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin mr-1" />}
            {isEditing ? 'Save Changes' : 'Create Hotel'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
