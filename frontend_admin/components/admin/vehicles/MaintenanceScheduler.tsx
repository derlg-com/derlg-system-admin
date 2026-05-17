'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar as CalendarIcon, Wrench, Loader2, AlertTriangle } from 'lucide-react'
import { maintenanceApi } from '@/lib/api'
import { format, addDays, isBefore, isAfter, parseISO } from 'date-fns'
import { toast } from 'sonner'
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

const maintenanceSchema = z.object({
  vehicle_id: z.string().min(1, 'Vehicle is required'),
  maintenance_type: z.string().min(1, 'Maintenance type is required'),
  scheduled_date: z.date(),
  maintenance_notes: z.string().optional(),
})

export type MaintenanceFormData = z.infer<typeof maintenanceSchema>

interface MaintenanceSchedulerProps {
  vehicleId?: string
  onScheduled?: () => void
}

export function MaintenanceScheduler({ vehicleId, onScheduled }: MaintenanceSchedulerProps) {
  const qc = useQueryClient()
  const [calendarOpen, setCalendarOpen] = useState(false)

  const { data: upcomingRecords } = useQuery({
    queryKey: ['admin-maintenance', 'upcoming'],
    queryFn: () => maintenanceApi.list({ status: 'SCHEDULED' }).then((r) => r.data),
    staleTime: 30000,
  })

  const form = useForm<MaintenanceFormData>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: {
      vehicle_id: vehicleId || '',
      maintenance_type: '',
      maintenance_notes: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data: MaintenanceFormData) =>
      maintenanceApi.create({
        ...data,
        scheduled_date: format(data.scheduled_date, 'yyyy-MM-dd'),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-maintenance'] })
      toast.success('Maintenance scheduled successfully')
      form.reset()
      onScheduled?.()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to schedule maintenance')
    },
  })

  // Find records due within 3 days
  const now = new Date()
  const threeDaysFromNow = addDays(now, 3)
  const upcomingSoon = (upcomingRecords || []).filter((r: any) => {
    const date = parseISO(r.scheduled_date)
    return isAfter(date, now) && isBefore(date, threeDaysFromNow)
  })

  return (
    <div className="space-y-6">
      {/* Upcoming reminders */}
      {upcomingSoon.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="size-4" />
            <span className="text-sm font-medium">Upcoming Maintenance (within 3 days)</span>
          </div>
          <div className="space-y-1">
            {upcomingSoon.map((r: any) => (
              <div key={r.id} className="text-sm text-amber-200/80 flex items-center gap-2">
                <Wrench className="size-3" />
                <span>
                  {r.maintenance_type} — {format(parseISO(r.scheduled_date), 'MMM d, yyyy')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="vehicle_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vehicle ID *</FormLabel>
                  <FormControl>
                    <Input placeholder="Vehicle UUID" {...field} readOnly={!!vehicleId} className={vehicleId ? 'opacity-60' : ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="maintenance_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maintenance Type *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Oil Change, Tire Rotation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scheduled_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scheduled Date *</FormLabel>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
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
                          setCalendarOpen(false)
                        }}
                        disabled={(date) => isBefore(date, new Date())}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="maintenance_notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Input placeholder="Additional notes..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-3">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin mr-1" />}
              Schedule Maintenance
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
