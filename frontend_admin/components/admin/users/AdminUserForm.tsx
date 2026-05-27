'use client'

import { useEffect } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'

const S = { background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' } as const
const LABEL = { color: 'var(--text-secondary)' } as const

const ROLES = ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'FLEET_MANAGER', 'SUPPORT_AGENT'] as const

const ALL_PERMISSIONS = [
  { key: 'MANAGE_DRIVERS', label: 'Manage Drivers' },
  { key: 'MANAGE_VEHICLES', label: 'Manage Vehicles' },
  { key: 'MANAGE_BOOKINGS', label: 'Manage Bookings' },
  { key: 'MANAGE_HOTELS', label: 'Manage Hotels' },
  { key: 'MANAGE_GUIDES', label: 'Manage Guides' },
  { key: 'MANAGE_CUSTOMERS', label: 'Manage Customers' },
  { key: 'MANAGE_EMERGENCY', label: 'Manage Emergency' },
  { key: 'MANAGE_DISCOUNTS', label: 'Manage Discounts' },
  { key: 'VIEW_ANALYTICS', label: 'View Analytics' },
  { key: 'MANAGE_ADMIN_USERS', label: 'Manage Admin Users' },
  { key: 'VIEW_AUDIT_LOGS', label: 'View Audit Logs' },
] as const

const ROLE_PRESETS: Record<string, string[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS.map(p => p.key),
  OPERATIONS_MANAGER: ALL_PERMISSIONS.map(p => p.key).filter(k => k !== 'MANAGE_ADMIN_USERS' && k !== 'VIEW_AUDIT_LOGS'),
  FLEET_MANAGER: ['MANAGE_DRIVERS', 'MANAGE_VEHICLES'],
  SUPPORT_AGENT: ['MANAGE_BOOKINGS', 'MANAGE_CUSTOMERS'],
}

const adminUserSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  full_name: z.string().min(1, 'Name is required'),
  admin_role: z.enum(ROLES),
  permissions: z.record(z.string(), z.boolean()).optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
})

export type AdminUserFormData = z.infer<typeof adminUserSchema>

interface AdminUserFormProps {
  defaultValues?: Partial<AdminUserFormData>
  onSubmit: (data: AdminUserFormData) => void
  onCancel: () => void
  loading?: boolean
  isEditing?: boolean
}

export function AdminUserForm({ defaultValues, onSubmit, onCancel, loading = false, isEditing = false }: AdminUserFormProps) {
  const form = useForm<AdminUserFormData>({
    resolver: zodResolver(adminUserSchema),
    defaultValues: {
      email: '', full_name: '', admin_role: 'SUPPORT_AGENT', permissions: {},
      ...defaultValues,
    },
  })

  const watchedRole = form.watch('admin_role')
  const watchedPermissions = form.watch('permissions')

  useEffect(() => {
    const current = form.getValues('permissions') || {}
    const hasCustom = Object.values(current).some(v => v)
    if (!hasCustom && watchedRole) {
      const preset = ROLE_PRESETS[watchedRole] || []
      const newPerms: Record<string, boolean> = {}
      preset.forEach(k => { newPerms[k] = true })
      form.setValue('permissions', newPerms, { shouldValidate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedRole])

  const togglePermission = (key: string) => {
    const current = form.getValues('permissions') || {}
    form.setValue('permissions', { ...current, [key]: !current[key] }, { shouldValidate: false })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="px-6 pb-6 space-y-5" style={{ paddingLeft: 24, paddingRight: 24, paddingBottom: 24 }}>

        {/* Top fields — plain grid like Driver */}
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="full_name" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>Full Name *</FormLabel>
              <FormControl>
                <Input placeholder="e.g. John Doe" {...field}
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>Email *</FormLabel>
              <FormControl>
                <Input type="email" placeholder="john@derlg.com" {...field} disabled={isEditing}
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', opacity: isEditing ? 0.6 : 1 }} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="admin_role" render={({ field }) => (
            <FormItem>
              <FormLabel style={LABEL}>Admin Role *</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} className="w-full h-10">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="z-[1100] min-w-[200px]">
                  {ROLES.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          {!isEditing ? (
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel style={LABEL}>Temporary Password *</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Min 6 characters" {...field}
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          ) : <div />}
        </div>

        {/* Permissions section — wrapped like Driver's Telegram Integration */}
        <div className="rounded-xl space-y-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', padding: '16px 20px' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Permissions</p>
          <div className="grid grid-cols-2 gap-2">
            {ALL_PERMISSIONS.map((perm) => (
              <label key={perm.key} className="flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-colors"
                style={{ background: 'var(--bg-overlay)', border: `1px solid ${watchedPermissions?.[perm.key] ? 'var(--brand-primary)' : 'var(--border-strong)'}` }}>
                <Checkbox checked={!!watchedPermissions?.[perm.key]} onCheckedChange={() => togglePermission(perm.key)} />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{perm.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} style={{ background: 'var(--brand-primary)', color: '#fff' }}>
            {loading && <Loader2 className="size-4 animate-spin mr-1" />}
            {isEditing ? 'Save Changes' : 'Create Admin'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
