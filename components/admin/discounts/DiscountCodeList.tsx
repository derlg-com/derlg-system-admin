'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ToggleLeft, ToggleRight, Edit2 } from 'lucide-react'
import { discountsApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, StatusBadge, ConfirmDialog } from '@/components/shared'
import { DiscountCodeForm, type DiscountCodeFormData } from './DiscountCodeForm'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface DiscountCode {
  id: string
  code: string
  discount_type: string
  discount_percentage?: number
  discount_value?: number
  valid_from: string
  valid_until: string
  usage_count?: number
  current_uses?: number
  max_usage?: number
  max_uses?: number
  is_active: boolean
  created_at: string
}

export function DiscountCodeList() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<DiscountCode | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<DiscountCode | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-discounts'],
    queryFn: () => discountsApi.list().then((r) => r.data as DiscountCode[]),
    staleTime: 30000,
  })

  const createMutation = useMutation({
    mutationFn: (d: DiscountCodeFormData) => discountsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-discounts'] })
      setShowForm(false)
      toast.success('Discount code created')
    },
    onError: () => toast.error('Failed to create discount code'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DiscountCodeFormData> }) =>
      discountsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-discounts'] })
      setShowForm(false)
      setEditing(null)
      toast.success('Discount code updated')
    },
    onError: () => toast.error('Failed to update discount code'),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => discountsApi.update(id, { is_active: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-discounts'] })
      setDeactivateTarget(null)
      toast.success('Discount code deactivated')
    },
    onError: () => toast.error('Failed to deactivate discount code'),
  })

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (code: DiscountCode) => {
    setEditing(code)
    setShowForm(true)
  }

  const handleSubmit = (formData: DiscountCodeFormData) => {
    if (editing) {
      const { code, ...updateData } = formData
      void code
      updateMutation.mutate({ id: editing.id, data: updateData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditing(null)
  }

  const defaultFormValues: Partial<DiscountCodeFormData> | undefined = editing
    ? {
        code: editing.code,
        discount_type: editing.discount_type === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
        value: editing.discount_percentage ?? editing.discount_value ?? 0,
        valid_from: editing.valid_from ? format(new Date(editing.valid_from), "yyyy-MM-dd'T'HH:mm") : '',
        valid_until: editing.valid_until ? format(new Date(editing.valid_until), "yyyy-MM-dd'T'HH:mm") : '',
        max_uses: editing.max_usage ?? editing.max_uses,
      }
    : undefined

  return (
    <div>
      <PageHeader
        title="Discount Codes"
        subtitle={`${data.length} codes`}
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} /> Create Code
          </button>
        }
      />

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          data={data}
          loading={isLoading}
          rowKey="id"
          emptyMessage="No discount codes found"
          columns={[
            {
              key: 'code',
              label: <span style={{ display: 'inline-block', paddingLeft: 32 }}>Code</span>,
              sortable: true,
              render: (r: DiscountCode) => (
                <div style={{ paddingLeft: 32 }}>
                  <span className="font-mono font-semibold text-primary">
                    {r.code}
                  </span>
                </div>
              ),
            },
            {
              key: 'discount_percentage',
              label: 'Discount',
              render: (r: DiscountCode) =>
                r.discount_percentage != null
                  ? `${r.discount_percentage}%`
                  : r.discount_value != null
                  ? `$${r.discount_value}`
                  : '—',
            },
            {
              key: 'valid_from',
              label: 'Valid From',
              render: (r: DiscountCode) =>
                r.valid_from
                  ? format(new Date(r.valid_from), 'MMM d, yyyy')
                  : '—',
            },
            {
              key: 'valid_until',
              label: 'Valid Until',
              render: (r: DiscountCode) =>
                r.valid_until
                  ? format(new Date(r.valid_until), 'MMM d, yyyy')
                  : '—',
            },
            {
              key: 'usage',
              label: 'Usage',
              render: (r: DiscountCode) => {
                const used = r.usage_count ?? r.current_uses ?? 0
                const max = r.max_usage ?? r.max_uses
                return (
                  <span className="text-sm">
                    {used}
                    {max ? ` / ${max}` : ''}
                  </span>
                )
              },
            },
            {
              key: 'is_active',
              label: 'Active',
              render: (r: DiscountCode) => (
                <StatusBadge
                  status={r.is_active ? 'ACTIVE' : 'OFFLINE'}
                />
              ),
            },
          ]}
          actions={(row: DiscountCode) => (
            <div className="flex items-center gap-1">
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => openEdit(row)}
                title="Edit"
              >
                <Edit2 size={13} />
              </button>
              {row.is_active ? (
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  title="Deactivate"
                  onClick={() => setDeactivateTarget(row)}
                >
                  <ToggleLeft size={15} className="text-success" />
                </button>
              ) : (
                <ToggleRight size={15} className="text-muted-foreground" />
              )}
            </div>
          )}
        />
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent
          className="w-full max-w-2xl sm:max-w-2xl overflow-hidden p-0 rounded-2xl"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-xl)' }}
        >
          <DialogHeader
            className="px-6 py-5"
            style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 20, paddingBottom: 20, borderBottom: '1px solid var(--border-default)' }}
          >
            <DialogTitle>
              {editing ? 'Edit Discount Code' : 'Create Discount Code'}
            </DialogTitle>
          </DialogHeader>
          <DiscountCodeForm
            defaultValues={defaultFormValues}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={createMutation.isPending || updateMutation.isPending}
            isEditing={!!editing}
          />
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        open={!!deactivateTarget}
        title="Deactivate Discount Code"
        message={`Are you sure you want to deactivate code "${deactivateTarget?.code}"?`}
        confirmLabel="Deactivate"
        variant="danger"
        onConfirm={() =>
          deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)
        }
        onCancel={() => setDeactivateTarget(null)}
        loading={deactivateMutation.isPending}
      />
    </div>
  )
}
