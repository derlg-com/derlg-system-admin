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

const LABEL = { color: 'var(--text-secondary)' } as const

const discountSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50),
  // Keys and values mirror Create/UpdateDiscountCodeDto exactly (camelCase keys,
  // lowercase DiscountType enum) so the payload passes forbidNonWhitelisted + @IsEnum.
  discountType: z.enum(['percentage', 'fixed_amount']),
  value: z.number().min(0, 'Must be at least 0'),
  validFrom: z.string().min(1, 'Start date is required'),
  validUntil: z.string().min(1, 'End date is required'),
  maxUses: z.number().min(1).optional(),
  minBookingUsd: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
})

export type DiscountCodeFormData = z.infer<typeof discountSchema>

interface DiscountCodeFormProps {
  defaultValues?: Partial<DiscountCodeFormData>
  onSubmit: (data: DiscountCodeFormData) => void
  onCancel: () => void
  loading?: boolean
  isEditing?: boolean
}

function toDateTimeLocalString(val?: string): string {
  if (!val) return ''
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => n.toString().padStart(2, '0')
    const year = d.getFullYear()
    const month = pad(d.getMonth() + 1)
    const day = pad(d.getDate())
    const hours = pad(d.getHours())
    const minutes = pad(d.getMinutes())
    return `${year}-${month}-${day}T${hours}:${minutes}`
  } catch {
    return ''
  }
}

export function DiscountCodeForm({ defaultValues, onSubmit, onCancel, loading = false, isEditing = false }: DiscountCodeFormProps) {
  const form = useForm<DiscountCodeFormData>({
    resolver: zodResolver(discountSchema),
    defaultValues: {
      code: defaultValues?.code || '',
      discountType: defaultValues?.discountType || 'percentage',
      value: defaultValues?.value ?? 10,
      validFrom: toDateTimeLocalString(defaultValues?.validFrom),
      validUntil: toDateTimeLocalString(defaultValues?.validUntil),
      maxUses: defaultValues?.maxUses,
      minBookingUsd: defaultValues?.minBookingUsd,
      isActive: defaultValues?.isActive ?? true,
    },
  })

  const validFrom = form.watch('validFrom')
  const validUntil = form.watch('validUntil')
  const discountType = form.watch('discountType')

  const dateError = validFrom && validUntil && new Date(validFrom) >= new Date(validUntil)
    ? 'End date must be after start date' : undefined

  const handleFormSubmit = (data: DiscountCodeFormData) => {
    onSubmit({
      ...data,
      validFrom: new Date(data.validFrom).toISOString(),
      validUntil: new Date(data.validUntil).toISOString(),
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="px-6 pb-6 space-y-5" style={{ paddingLeft: 24, paddingRight: 24, paddingBottom: 24, paddingTop: 4 }}>

        {/* Discount Details */}
        <div className="rounded-xl space-y-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', padding: '16px 20px' }}>
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)', letterSpacing: 0.2 }}>Discount Details</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField control={form.control} name="code" render={({ field }) => (
              <FormItem>
                <FormLabel style={LABEL}>Code *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. SUMMER20" {...field}
                    value={field.value.toUpperCase()}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    disabled={isEditing} className="w-full" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="discountType" render={({ field }) => (
              <FormItem>
                <FormLabel style={LABEL}>Discount Type *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} className="w-full h-10"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                  <SelectContent className="z-[1100] min-w-[200px]">
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount ($)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="value" render={({ field }) => (
              <FormItem>
                <FormLabel style={LABEL}>{discountType === 'percentage' ? 'Discount (%)' : 'Discount ($)'} *</FormLabel>
                <FormControl>
                  <Input type="number" min={0} max={discountType === 'percentage' ? 100 : undefined}
                    step={0.01} placeholder={discountType === 'percentage' ? 'e.g. 20' : 'e.g. 5.00'}
                    {...field} className="w-full" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="minBookingUsd" render={({ field }) => (
              <FormItem>
                <FormLabel style={LABEL}>Min Booking (USD)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step={0.01} placeholder="No minimum" {...field}
                    value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        {/* Validity */}
        <div className="rounded-xl space-y-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', padding: '16px 20px' }}>
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)', letterSpacing: 0.2 }}>Validity</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField control={form.control} name="validFrom" render={({ field }) => (
              <FormItem>
                <FormLabel style={LABEL}>Valid From *</FormLabel>
                <FormControl><Input type="datetime-local" {...field} className="w-full" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="validUntil" render={({ field }) => (
              <FormItem>
                <FormLabel style={LABEL}>Valid Until *</FormLabel>
                <FormControl><Input type="datetime-local" {...field} className="w-full" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} /></FormControl>
                <FormMessage />
                {dateError && <p className="text-xs text-destructive mt-1">{dateError}</p>}
              </FormItem>
            )} />

            <FormField control={form.control} name="maxUses" render={({ field }) => (
              <FormItem>
                <FormLabel style={LABEL}>Max Uses</FormLabel>
                <FormControl>
                  <Input type="number" min={1} placeholder="Unlimited" {...field}
                    value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
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
