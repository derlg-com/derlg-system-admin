'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
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
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const modificationSchema = z.object({
  travel_date: z.date(),
  end_date: z.date().optional(),
  num_adults: z.number().min(1),
  num_children: z.number().min(0),
  customizations: z.string().optional(),
})

export type BookingModificationData = z.infer<typeof modificationSchema>

interface BookingModificationFormProps {
  defaultValues?: Partial<BookingModificationData>
  onSubmit: (data: BookingModificationData) => void
  onCancel: () => void
  loading?: boolean
}

export function BookingModificationForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading = false,
}: BookingModificationFormProps) {
  const [travelDateOpen, setTravelDateOpen] = useState(false)
  const [endDateOpen, setEndDateOpen] = useState(false)

  const form = useForm<BookingModificationData>({
    resolver: zodResolver(modificationSchema),
    defaultValues: {
      travel_date: new Date(),
      num_adults: 1,
      num_children: 0,
      customizations: '',
      ...defaultValues,
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="travel_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Travel Date *</FormLabel>
                <Popover open={travelDateOpen} onOpenChange={setTravelDateOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(date) => {
                        field.onChange(date)
                        setTravelDateOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date</FormLabel>
                <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(date) => {
                        field.onChange(date)
                        setEndDateOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="num_adults"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Adults *</FormLabel>
                <FormControl>
                  <Input type="number" min={1} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="num_children"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Children</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="customizations"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customizations / Special Requests</FormLabel>
              <FormControl>
                <Input placeholder="Any special requirements..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin mr-1" />}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  )
}
