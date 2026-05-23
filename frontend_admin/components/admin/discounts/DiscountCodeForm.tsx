'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
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

const S = { background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' } as const
const LABEL = { color: 'var(--text-secondary)' } as const

const discountSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50),
  discount_type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.number().min(0, 'Must be at least 0'),
  valid_from: z.string().min(1, 'Start date is required'),
  valid_until: z.string().min(1, 'End date is required'),
  max_uses: z.number().min(1).optional(),
  min_booking_usd: z.number().min(0).optional(),
  is_active: z.boolean().optional(),
})

export type DiscountCodeFormData = z.infer<typeof discountSchema>

interface DiscountCodeFormProps {
  defaultValues?: Partial<DiscountCodeFormData>
  onSubmit: (data: DiscountCodeFormData) => void
  onCancel: () => void
  loading?: boolean
  isEditing?: boolean
}

export function DiscountCodeForm({ defaultValues, onSubmit, onCancel, loading = false, isEditing = false }: DiscountCodeFormProps) {
  const form = useForm<DiscountCodeFormData>({
    resolver: zodResolver(discountSchema),
    defaultValues: {
      code: '', discount_type: 'PERCENTAGE', value: 10,
      valid_from: '', valid_until: '', max_uses: undefined,
      min_booking_usd: undefined, is_active: true,
      ...defaultValues,
    },
  })

  const validFrom = form.watch('valid_from')
  const validUntil = form.watch('valid_until')
  const discountType = form.watch('discount_type')

  const dateError = validFrom && validUntil && new Date(validFrom) >= new Date(validUntil)
    ? 'End date must be after start date' : undefined

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="code" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>Code *</FormLabel>
              <FormControl>
                <Input placeholder="e.g. SUMMER20" {...field}
                  value={field.value.toUpperCase()}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  disabled={isEditing} style={S} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="discount_type" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>Discount Type *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger style={S} className="w-full h-10"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                <SelectContent className="z-[1100] min-w-[200px]">
                  <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                  <SelectItem value="FIXED">Fixed Amount ($)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="value" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>{discountType === 'PERCENTAGE' ? 'Discount (%)' : 'Discount ($)'} *</FormLabel>
              <FormControl>
                <Input type="number" min={0} max={discountType === 'PERCENTAGE' ? 100 : undefined}
                  step={0.01} placeholder={discountType === 'PERCENTAGE' ? 'e.g. 20' : 'e.g. 5.00'}
                  {...field} style={S} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="max_uses" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>Max Uses</FormLabel>
              <FormControl>
                <Input type="number" min={1} placeholder="Unlimited" {...field}
                  value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                  style={S} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="valid_from" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>Valid From *</FormLabel>
              <FormControl><Input type="datetime-local" {...field} style={S} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="valid_until" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>Valid Until *</FormLabel>
              <FormControl><Input type="datetime-local" {...field} style={S} /></FormControl>
              <FormMessage />
              {dateError && <p className="text-xs text-destructive mt-1">{dateError}</p>}
            </FormItem>
          )} />

          <FormField control={form.control} name="min_booking_usd" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>Min Booking (USD)</FormLabel>
              <FormControl>
                <Input type="number" min={0} step={0.01} placeholder="No minimum" {...field}
                  value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                  style={S} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !!dateError} style={{ background: 'var(--brand-primary)', color: '#fff' }}>
            {loading && <Loader2 className="size-4 animate-spin mr-1" />}
            {isEditing ? 'Save Changes' : 'Create Code'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
