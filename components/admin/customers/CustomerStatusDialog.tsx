'use client'

import { useState } from 'react'

import { FormField, Modal } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

import type { Customer } from './CustomerList'

/**
 * Suspend or reactivate, with a mandatory reason.
 *
 * A plain ConfirmDialog is not enough: the API requires a reason (min 3 chars)
 * and records it in the audit log, because suspension locks a paying customer out
 * of their own bookings and "who did this and why" is the first question asked
 * when they dispute it.
 */
export function CustomerStatusDialog({
  customer,
  saving,
  onClose,
  onConfirm,
}: {
  customer: Customer | null
  saving: boolean
  onClose: () => void
  onConfirm: (nextStatus: string, reason: string) => void
}) {
  const [reason, setReason] = useState('')

  if (!customer) return null

  const suspending = customer.status === 'active'
  const nextStatus = suspending ? 'suspended' : 'active'
  const reasonValid = reason.trim().length >= 3

  return (
    <Modal
      open={!!customer}
      title={suspending ? 'Suspend Customer' : 'Reactivate Customer'}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={suspending ? 'destructive' : 'default'}
            disabled={saving || !reasonValid}
            onClick={() => onConfirm(nextStatus, reason.trim())}
          >
            {saving ? 'Saving…' : suspending ? 'Suspend' : 'Reactivate'}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        {suspending ? (
          <>
            <strong>{customer.fullName ?? customer.email}</strong> will be signed
            out of every device immediately and blocked from signing in again.
            Existing bookings are not cancelled.
          </>
        ) : (
          <>
            <strong>{customer.fullName ?? customer.email}</strong> will be able to
            sign in again. They will need to log in fresh; other devices are not
            restored.
          </>
        )}
      </p>

      <FormField
        label="Reason"
        required
        hint="Recorded in the audit log against your account."
        error={
          reason.length > 0 && !reasonValid
            ? 'Please give at least 3 characters'
            : undefined
        }
      >
        <Textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={
            suspending
              ? 'e.g. Chargeback fraud investigation — ticket #1234'
              : 'e.g. Investigation closed, no wrongdoing found'
          }
        />
      </FormField>
    </Modal>
  )
}
