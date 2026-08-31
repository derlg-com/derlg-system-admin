'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { toast } from 'sonner'

import { customersApi, extractErrorMessage } from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { FormField, Modal } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { Customer } from './CustomerList'

/**
 * Profile editor.
 *
 * Email is absent on purpose — it is the login identity, and changing it belongs
 * in an account-recovery flow rather than an admin edit form. The API rejects it
 * too.
 *
 * Numbers would use plain `z.number()` with `valueAsNumber`; `z.coerce.number()`
 * makes the schema's input type `unknown` and breaks the resolver's generics.
 * Every field here is a string, so it does not arise.
 */
const schema = z.object({
  fullName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(32).optional(),
  preferredLanguage: z.enum(['en', 'zh', 'km']),
  emergencyContactName: z.string().trim().max(120).optional(),
  emergencyContactPhone: z.string().trim().max(32).optional(),
})

type FormData = z.infer<typeof schema>

/** Only non-admin roles. Granting an admin role requires a matching
 *  `admin_users` record, which is what the Admin Users screen creates; the API
 *  refuses admin roles on this route for exactly that reason. */
const ASSIGNABLE_ROLES = ['user', 'guide', 'student'] as const

export function CustomerEditDialog({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer | null
  onClose: () => void
  onSaved: () => void
}) {
  const { isSuperAdmin } = usePermission()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { preferredLanguage: 'en' },
  })

  // Reload the form whenever a different customer is opened, otherwise the
  // previous customer's values would be submitted against the new one.
  useEffect(() => {
    if (customer) {
      reset({
        fullName: customer.fullName ?? '',
        phone: customer.phone ?? '',
        preferredLanguage: 'en',
        emergencyContactName: '',
        emergencyContactPhone: '',
      })
    }
  }, [customer, reset])

  const saveMutation = useMutation({
    mutationFn: (data: FormData) => {
      if (!customer) throw new Error('No customer selected')
      // Send only fields that carry a value: an empty string would overwrite a
      // stored name or phone with blank.
      const patch: Record<string, unknown> = {
        preferredLanguage: data.preferredLanguage,
      }
      if (data.fullName) patch.fullName = data.fullName
      if (data.phone) patch.phone = data.phone
      if (data.emergencyContactName)
        patch.emergencyContactName = data.emergencyContactName
      if (data.emergencyContactPhone)
        patch.emergencyContactPhone = data.emergencyContactPhone
      return customersApi.update(customer.id, patch)
    },
    onSuccess: () => {
      toast.success('Customer updated')
      onSaved()
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Failed to update customer')),
  })

  const roleMutation = useMutation({
    mutationFn: (role: string) => {
      if (!customer) throw new Error('No customer selected')
      return customersApi.setRole(customer.id, role)
    },
    onSuccess: () => {
      toast.success('Role updated')
      onSaved()
    },
    // Surfaces the API's explanatory 403 (admin role refused / own account) and
    // 400 verbatim, since both are actionable.
    onError: (err) => toast.error(extractErrorMessage(err, 'Failed to change role')),
  })

  if (!customer) return null

  return (
    <Modal
      open={!!customer}
      title="Edit Customer"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit((data) => saveMutation.mutate(data))}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-slate-500">
        {customer.email} — email cannot be changed here.
      </p>

      <FormField label="Full name" error={errors.fullName?.message}>
        <Input {...register('fullName')} />
      </FormField>

      <FormField label="Phone" error={errors.phone?.message}>
        <Input {...register('phone')} placeholder="+855 12 345 678" />
      </FormField>

      <FormField label="Preferred language" error={errors.preferredLanguage?.message}>
        <select className="form-input" {...register('preferredLanguage')}>
          <option value="en">English</option>
          <option value="zh">Chinese</option>
          <option value="km">Khmer</option>
        </select>
      </FormField>

      <FormField label="Emergency contact name" error={errors.emergencyContactName?.message}>
        <Input {...register('emergencyContactName')} />
      </FormField>

      <FormField label="Emergency contact phone" error={errors.emergencyContactPhone?.message}>
        <Input {...register('emergencyContactPhone')} />
      </FormField>

      {/*
        Hidden, not disabled, for anyone below SUPER_ADMIN — the same convention
        AdminSidebar uses. The API enforces this independently; hiding it only
        avoids offering a control that would answer 403.
      */}
      {isSuperAdmin ? (
        <FormField
          label="Role"
          hint="Applies immediately, separately from the fields above. Admin roles are granted on the Admin Users screen."
        >
          <div className="flex items-center gap-2">
            <select
              className="form-input"
              defaultValue={customer.role}
              onChange={(e) => {
                if (e.target.value !== customer.role) {
                  roleMutation.mutate(e.target.value)
                }
              }}
              disabled={roleMutation.isPending}
            >
              {/* Include the current role even when it is an admin role, so the
                  select shows the truth rather than silently misrepresenting it. */}
              {!ASSIGNABLE_ROLES.includes(
                customer.role as (typeof ASSIGNABLE_ROLES)[number],
              ) ? (
                <option value={customer.role}>{customer.role} (current)</option>
              ) : null}
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {roleMutation.isPending ? (
              <span className="text-xs text-slate-500">Saving…</span>
            ) : null}
          </div>
        </FormField>
      ) : null}
    </Modal>
  )
}
