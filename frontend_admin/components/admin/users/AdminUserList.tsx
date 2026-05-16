'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Power } from 'lucide-react'
import { adminUsersApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, StatusBadge, ConfirmDialog } from '@/components/shared'
import { AdminUserForm, type AdminUserFormData } from './AdminUserForm'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface AdminUser {
  id: string
  email: string
  name: string
  admin_role: string
  permissions?: Record<string, boolean>
  is_active: boolean
  created_at: string
}

export function AdminUserList() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<AdminUser | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminUsersApi.list().then((r) => r.data as AdminUser[]),
    staleTime: 30000,
  })

  const createMutation = useMutation({
    mutationFn: (d: AdminUserFormData) => adminUsersApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setShowForm(false)
      toast.success('Admin user created')
    },
    onError: () => toast.error('Failed to create admin user'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AdminUserFormData> }) =>
      adminUsersApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setShowForm(false)
      setEditing(null)
      toast.success('Admin user updated')
    },
    onError: () => toast.error('Failed to update admin user'),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => adminUsersApi.update(id, { is_active: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setDeactivateTarget(null)
      toast.success('Admin user deactivated')
    },
    onError: () => toast.error('Failed to deactivate admin user'),
  })

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (user: AdminUser) => {
    setEditing(user)
    setShowForm(true)
  }

  const handleSubmit = (formData: AdminUserFormData) => {
    if (editing) {
      const { email, password, ...updateData } = formData
      void email
      void password
      updateMutation.mutate({ id: editing.id, data: updateData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditing(null)
  }

  const defaultFormValues: Partial<AdminUserFormData> | undefined = editing
    ? {
        email: editing.email,
        name: editing.name,
        admin_role: editing.admin_role as any,
        permissions: editing.permissions || {},
      }
    : undefined

  const permissionCount = (user: AdminUser) => {
    if (!user.permissions) return 0
    return Object.values(user.permissions).filter(Boolean).length
  }

  return (
    <div>
      <PageHeader
        title="Admin Users"
        subtitle={`${data.length} administrators`}
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} /> Add Admin
          </button>
        }
      />

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          data={data}
          loading={isLoading}
          rowKey="id"
          emptyMessage="No admin users found"
          columns={[
            {
              key: 'name',
              label: 'Name',
              sortable: true,
              render: (r: AdminUser) => (
                <span className="font-medium">{r.name}</span>
              ),
            },
            {
              key: 'email',
              label: 'Email',
              render: (r: AdminUser) => (
                <span className="text-sm text-muted-foreground">{r.email}</span>
              ),
            },
            {
              key: 'admin_role',
              label: 'Role',
              render: (r: AdminUser) => (
                <Badge
                  variant={
                    r.admin_role === 'SUPER_ADMIN'
                      ? 'default'
                      : r.admin_role === 'OPERATIONS_MANAGER'
                      ? 'secondary'
                      : 'outline'
                  }
                  className="text-xs"
                >
                  {r.admin_role.replace(/_/g, ' ')}
                </Badge>
              ),
            },
            {
              key: 'permissions',
              label: 'Permissions',
              render: (r: AdminUser) => (
                <span className="text-sm text-muted-foreground">
                  {permissionCount(r)} granted
                </span>
              ),
            },
            {
              key: 'is_active',
              label: 'Status',
              render: (r: AdminUser) => (
                <StatusBadge
                  status={r.is_active !== false ? 'ACTIVE' : 'OFFLINE'}
                />
              ),
            },
            {
              key: 'created_at',
              label: 'Added',
              render: (r: AdminUser) =>
                format(new Date(r.created_at || Date.now()), 'MMM d, yyyy'),
            },
          ]}
          actions={(row: AdminUser) => (
            <div className="flex items-center gap-1">
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => openEdit(row)}
                title="Edit Role"
              >
                <Edit2 size={13} />
              </button>
              {row.is_active !== false && (
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => setDeactivateTarget(row)}
                  title="Deactivate"
                >
                  <Power size={13} className="text-destructive" />
                </button>
              )}
            </div>
          )}
        />
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit Admin User' : 'Add Admin User'}
            </DialogTitle>
          </DialogHeader>
          <AdminUserForm
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
        title="Deactivate Admin Account"
        message={`Are you sure you want to deactivate ${deactivateTarget?.name}'s admin account? This will revoke all their active tokens.`}
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
