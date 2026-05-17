'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, X } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ImageUpload } from '@/components/shared/ImageUpload'

const vehicleSchema = z.object({
  name: z.string().min(1, 'Vehicle name is required').max(255),
  category: z.enum(['VAN', 'BUS', 'TUK_TUK']),
  capacity: z.number().min(1, 'Capacity must be at least 1').max(100),
  tier: z.enum(['STANDARD', 'VIP']),
  price_per_day: z.number().min(0, 'Price must be positive'),
  price_per_km: z.number().min(0, 'Price must be positive').optional(),
  features: z.array(z.string()),
  images: z.array(z.string()),
})

export type VehicleFormData = z.infer<typeof vehicleSchema>

interface VehicleFormProps {
  defaultValues?: Partial<VehicleFormData>
  onSubmit: (data: VehicleFormData) => void
  onCancel: () => void
  loading?: boolean
  isEditing?: boolean
}

const VEHICLE_FEATURES = [
  'Air Conditioning',
  'WiFi',
  'USB Charging',
  'Reclining Seats',
  'Entertainment System',
  'Luggage Space',
  'Child Seat',
  'Wheelchair Accessible',
  'GPS Tracking',
  'Bottle Water',
  'Snacks',
  'First Aid Kit',
]

export function VehicleForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading = false,
  isEditing = false,
}: VehicleFormProps) {
  const [imageUrls, setImageUrls] = useState<string[]>(defaultValues?.images || [])

  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      name: '',
      category: 'VAN',
      capacity: 4,
      tier: 'STANDARD',
      price_per_day: 0,
      price_per_km: 0,
      features: [],
      images: [],
      ...defaultValues,
    },
  })

  const selectedFeatures = form.watch('features') || []

  const toggleFeature = (feature: string) => {
    const current = form.getValues('features') || []
    if (current.includes(feature)) {
      form.setValue(
        'features',
        current.filter((f) => f !== feature)
      )
    } else {
      form.setValue('features', [...current, feature])
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

  const handleFormSubmit = (data: VehicleFormData) => {
    onSubmit({ ...data, images: imageUrls })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Vehicle Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Toyota Hiace 2023" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="VAN">Van</SelectItem>
                    <SelectItem value="BUS">Bus</SelectItem>
                    <SelectItem value="TUK_TUK">Tuk Tuk</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tier *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tier" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="STANDARD">Standard</SelectItem>
                    <SelectItem value="VIP">VIP</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capacity (passengers) *</FormLabel>
                <FormControl>
                  <Input type="number" min={1} max={100} {...field} />
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
                <FormLabel>Price per Day ($) *</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step={0.01} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price_per_km"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price per KM ($)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step={0.01} {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Features */}
        <FormField
          control={form.control}
          name="features"
          render={() => (
            <FormItem>
              <FormLabel>Features</FormLabel>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                {VEHICLE_FEATURES.map((feature) => (
                  <div
                    key={feature}
                    className="flex items-center gap-2 rounded-md border border-border-default p-2 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleFeature(feature)}
                  >
                    <Checkbox
                      checked={selectedFeatures.includes(feature)}
                      onCheckedChange={() => toggleFeature(feature)}
                    />
                    <span className="text-sm">{feature}</span>
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
          <ImageUpload
            onUpload={handleImagesUploaded}
            multiple
            maxFiles={5}
          />
          {imageUrls.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-2">
              {imageUrls.map((url) => (
                <div key={url} className="relative group rounded-md overflow-hidden border">
                  <img src={url} alt="Vehicle" className="w-full h-20 object-cover" />
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
            {isEditing ? 'Save Changes' : 'Create Vehicle'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
