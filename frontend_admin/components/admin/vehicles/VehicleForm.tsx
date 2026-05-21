'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
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

const S = { background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' } as const
const LABEL = { color: 'var(--text-secondary)' } as const

const vehicleSchema = z.object({
  name: z.string().min(1, 'Vehicle name is required').max(255),
  vehicle_type: z.enum(['VAN', 'BUS', 'TUK_TUK']),
  license_plate: z.string().optional(),
  capacity: z.number().min(1).max(100),
  pricing_model: z.enum(['PER_DAY', 'PER_KM', 'FIXED']),
  price_usd: z.number().min(0),
  province: z.string().min(1, 'Province is required'),
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
  'Air Conditioning', 'WiFi', 'USB Charging', 'Reclining Seats',
  'Entertainment System', 'Luggage Space', 'Child Seat', 'Wheelchair Accessible',
  'GPS Tracking', 'Bottle Water', 'Snacks', 'First Aid Kit',
]

export function VehicleForm({ defaultValues, onSubmit, onCancel, loading = false, isEditing = false }: VehicleFormProps) {
  const [imageUrls, setImageUrls] = useState<string[]>(defaultValues?.images || [])

  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      name: '', vehicle_type: 'VAN', license_plate: '', capacity: 4,
      pricing_model: 'PER_DAY', price_usd: 0, province: '', features: [], images: [],
      ...defaultValues,
    },
  })

  const selectedFeatures = form.watch('features') || []

  const handleFormSubmit = (data: VehicleFormData) => onSubmit({ ...data, images: imageUrls })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel style={LABEL}>Vehicle Name *</FormLabel>
              <FormControl><Input placeholder="e.g. Toyota Hiace 2023" {...field} style={S} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="vehicle_type" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>Category *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger style={S} className="w-full h-10"><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                <SelectContent className="z-[1100] min-w-[200px]">
                  <SelectItem value="VAN">Van</SelectItem>
                  <SelectItem value="BUS">Bus</SelectItem>
                  <SelectItem value="TUK_TUK">Tuk Tuk</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="pricing_model" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>Pricing Model *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger style={S} className="w-full h-10"><SelectValue placeholder="Select pricing" /></SelectTrigger></FormControl>
                <SelectContent className="z-[1100] min-w-[200px]">
                  <SelectItem value="PER_DAY">Per Day</SelectItem>
                  <SelectItem value="PER_KM">Per KM</SelectItem>
                  <SelectItem value="FIXED">Fixed</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="capacity" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>Capacity *</FormLabel>
              <FormControl><Input type="number" min={1} max={100} {...field} style={S} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="price_usd" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>Price (USD) *</FormLabel>
              <FormControl><Input type="number" min={0} step={0.01} {...field} style={S} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="province" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>Province *</FormLabel>
              <FormControl><Input placeholder="e.g. Phnom Penh" {...field} style={S} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="license_plate" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>License Plate</FormLabel>
              <FormControl><Input placeholder="e.g. 2A-1234" {...field} value={field.value || ''} style={S} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Features */}
        <FormField control={form.control} name="features" render={() => (
          <FormItem>
            <FormLabel style={LABEL}>Features</FormLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
              {VEHICLE_FEATURES.map((feature) => (
                <label key={feature} className="flex items-center gap-2 rounded-lg p-2.5 cursor-pointer transition-colors"
                  style={{ background: 'var(--bg-elevated)', border: `1px solid ${selectedFeatures.includes(feature) ? 'var(--brand-primary)' : 'var(--border-strong)'}` }}>
                  <Checkbox checked={selectedFeatures.includes(feature)}
                    onCheckedChange={(checked) => {
                      const cur = form.getValues('features') || []
                      form.setValue('features', checked === true ? [...cur, feature] : cur.filter(f => f !== feature))
                    }} />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{feature}</span>
                </label>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        )} />

        {/* Images */}
        <div className="space-y-2">
          <FormLabel style={LABEL}>Images</FormLabel>
          <ImageUpload onUpload={(urls) => { setImageUrls(urls); form.setValue('images', urls) }} multiple maxFiles={5} />
          {imageUrls.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-2">
              {imageUrls.map((url) => (
                <div key={url} className="relative group rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-strong)' }}>
                  <img src={url} alt="Vehicle" className="w-full h-20 object-cover" />
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
            {isEditing ? 'Save Changes' : 'Create Vehicle'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
