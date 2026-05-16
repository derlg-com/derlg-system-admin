'use client'

import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Copy, RefreshCw, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { vehiclesApi } from '@/lib/api'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const driverSchema = z.object({
  driver_name: z.string().min(1, 'Driver name is required').max(255),
  driver_id: z.string().min(1, 'Driver ID is required').max(50),
  phone: z.string().min(1, 'Phone number is required').max(20),
  telegram_id: z.string().optional(),
  vehicle_id: z.string().optional(),
  auth_pin: z.string().length(4, 'PIN must be exactly 4 digits').optional(),
  admin_role: z.enum(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'FLEET_MANAGER', 'SUPPORT_AGENT']).optional(),
})

export type DriverFormData = z.infer<typeof driverSchema>

interface DriverFormProps {
  defaultValues?: Partial<DriverFormData>
  onSubmit: (data: DriverFormData) => void
  onCancel: () => void
  loading?: boolean
  isEditing?: boolean
}

function generateAuthPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export function DriverForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading = false,
  isEditing = false,
}: DriverFormProps) {
  const form = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      driver_name: '',
      driver_id: '',
      phone: '',
      telegram_id: '',
      vehicle_id: '',
      auth_pin: generateAuthPin(),
      admin_role: undefined,
      ...defaultValues,
    },
  })

  const { data: vehicles } = useQuery({
    queryKey: ['admin-vehicles', 'all'],
    queryFn: () => vehiclesApi.list({ limit: 999 }).then((r) => r.data),
    staleTime: 60000,
  })

  const authPin = form.watch('auth_pin')
  const telegramId = form.watch('telegram_id')
  const driverId = form.watch('driver_id')

  const regeneratePin = () => {
    form.setValue('auth_pin', generateAuthPin())
  }

  const copyCredentials = async () => {
    const text = [
      `Driver ID: ${driverId}`,
      `Telegram ID: ${telegramId || 'Not set'}`,
      `Auth PIN: ${authPin}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Credentials copied to clipboard')
    } catch {
      toast.error('Failed to copy credentials')
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="driver_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Sokha Chan" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="driver_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Driver ID *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. DLG-DRV-001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone *</FormLabel>
                <FormControl>
                  <Input placeholder="+855 12 345 678" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="vehicle_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assigned Vehicle</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a vehicle" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {vehicles?.map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} ({v.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Telegram section */}
        <div className="rounded-lg border border-border-default p-4 space-y-4">
          <p className="text-sm font-medium text-text-secondary">Telegram Integration</p>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="telegram_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telegram ID</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="@username or numeric ID"
                      {...field}
                      value={field.value || ''}
                      readOnly={isEditing}
                      className={isEditing ? 'opacity-60' : ''}
                    />
                  </FormControl>
                  <FormMessage />
                  {isEditing && (
                    <p className="text-xs text-muted-foreground">Read-only after registration</p>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="auth_pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Auth PIN</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        maxLength={4}
                        className="font-mono tracking-widest"
                        placeholder="4-digit PIN"
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={regeneratePin}
                      title="Regenerate PIN"
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="admin_role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Admin Role (Telegram Bot)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                      <SelectItem value="OPERATIONS_MANAGER">Operations Manager</SelectItem>
                      <SelectItem value="FLEET_MANAGER">Fleet Manager</SelectItem>
                      <SelectItem value="SUPPORT_AGENT">Support Agent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyCredentials}
            className="gap-1.5"
          >
            <Copy className="size-3.5" />
            Copy Credentials
          </Button>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin mr-1" />}
            {isEditing ? 'Save Changes' : 'Create Driver'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
