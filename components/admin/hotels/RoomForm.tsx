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

const roomSchema = z.object({
  name: z.string().min(1, 'Room name is required').max(255),
  description: z.string().optional(),
  capacity: z.number().min(1, 'Capacity must be at least 1').max(20),
  price_per_night: z.number().min(0, 'Price must be positive'),
  images: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
})

export type RoomFormData = z.infer<typeof roomSchema>

interface RoomFormProps {
  defaultValues?: Partial<RoomFormData>
  onSubmit: (data: RoomFormData) => void
  onCancel: () => void
  loading?: boolean
  isEditing?: boolean
}

const ROOM_AMENITIES = [
  'Air Conditioning',
  'WiFi',
  'TV',
  'Mini Bar',
  'Safe',
  'Balcony',
  'Sea View',
  'King Bed',
  'Twin Beds',
  'Bathtub',
  'Rain Shower',
  'Work Desk',
  'Coffee Maker',
  'Iron',
]

export function RoomForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading = false,
  isEditing = false,
}: RoomFormProps) {
  const [imageUrls, setImageUrls] = useState<string[]>(defaultValues?.images || [])

  const form = useForm<RoomFormData>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      name: '',
      description: '',
      capacity: 2,
      price_per_night: 0,
      images: [],
      amenities: [],
      ...defaultValues,
    },
  })

  const selectedAmenities = form.watch('amenities') || []

  const handleImagesUploaded = (urls: string[]) => {
    setImageUrls(urls)
    form.setValue('images', urls)
  }

  const handleRemoveImage = (url: string) => {
    const updated = imageUrls.filter((u) => u !== url)
    setImageUrls(updated)
    form.setValue('images', updated)
  }

  const handleFormSubmit = (data: RoomFormData) => {
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
              <FormLabel>Room Name *</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Deluxe King Room" {...field} />
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
                <Input placeholder="Brief description..." {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capacity (guests) *</FormLabel>
                <FormControl>
                  <Input type="number" min={1} max={20} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price_per_night"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price per Night ($) *</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step={0.01} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Amenities */}
        <FormField
          control={form.control}
          name="amenities"
          render={() => (
            <FormItem>
              <FormLabel>Amenities</FormLabel>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                {ROOM_AMENITIES.map((amenity) => {
                  const isSelected = selectedAmenities.includes(amenity)
                  return (
                    <label
                      key={amenity}
                      className="flex items-center gap-2 rounded-md border border-border-default p-2 hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          const current = form.getValues('amenities') || []
                          if (checked === true) {
                            form.setValue('amenities', [...current, amenity])
                          } else {
                            form.setValue('amenities', current.filter((a) => a !== amenity))
                          }
                        }}
                      />
                      <span className="text-sm">{amenity}</span>
                    </label>
                  )
                })}
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
                  <img src={url} alt="Room" className="w-full h-full object-cover" />
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
            {isEditing ? 'Save Changes' : 'Create Room'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
