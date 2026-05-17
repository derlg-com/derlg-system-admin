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

const discountCodeSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50),
  discount_percentage: z.number().min(0, 'Must be at least 0').max(100, 'Max 100%').optional(),
  valid_from: z.string().min(1, 'Start date is required'),
  valid_until: z.string().min(1, 'End date is required'),
  max_usage: z.number().min(1, 'Must be at least 1').optional(),
})

export type DiscountCodeFormData = z.infer<typeof discountCodeSchema>

interface DiscountCodeFormProps {
  defaultValues?: Partial<DiscountCodeFormData>
  onSubmit: (data: DiscountCodeFormData) => void
  onCancel: () => void
  loading?: boolean
  isEditing?: boolean
}

export function DiscountCodeForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading = false,
  isEditing = false,
}: DiscountCodeFormProps) {
  const form = useForm<DiscountCodeFormData>({
    resolver: zodResolver(discountCodeSchema),
    defaultValues: {
      code: '',
      discount_percentage: 10,
      valid_from: '',
      valid_until: '',
      max_usage: undefined,
      ...defaultValues,
    },
  })

  const validFrom = form.watch('valid_from')
  const validUntil = form.watch('valid_until')

  const dateError =
    validFrom && validUntil && new Date(validFrom) >= new Date(validUntil)
      ? 'End date must be after start date'
      : undefined

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code *</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. SUMMER20"
                  {...field}
                  value={field.value.toUpperCase()}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  disabled={isEditing}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="discount_percentage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Discount Percentage (%) *</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="e.g. 20"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="valid_from"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valid From *</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="valid_until"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valid Until *</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
                {dateError && (
                  <p className="text-xs text-destructive mt-1">{dateError}</p>
                )}
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="max_usage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Max Usage</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || !!dateError}
          >
            {loading && <Loader2 className="size-4 animate-spin mr-1" />}
            {isEditing ? 'Save Changes' : 'Create Code'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
