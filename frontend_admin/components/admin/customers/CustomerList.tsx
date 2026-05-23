'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Eye, GraduationCap, Award } from 'lucide-react'
import { customersApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput, PageHeader } from '@/components/shared'
import { format } from 'date-fns'

interface Customer {
  id: string
  name: string
  email: string
  phone?: string
  loyalty_points?: number
  is_student?: boolean
  role?: string
  created_at: string
}

export function CustomerList() {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-customers', search],
    queryFn: () =>
      customersApi.list(search ? { search } : {}).then((r) => r.data as Customer[]),
    staleTime: 30000,
  })

  const filtered = data.filter((c: Customer) => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      c.name?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      c.phone?.toLowerCase().includes(term)
    )
  })

  return (
    <div>
      <PageHeader title="Customers" subtitle={`${data.length} customers`} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name, email, or phone..."
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          data={filtered}
          loading={isLoading}
          rowKey="id"
          emptyMessage="No customers found"
          columns={[
            {
              key: 'name',
              label: 'Name',
              sortable: true,
              render: (r: Customer) => (
                <span className="font-medium">{r.name}</span>
              ),
            },
            { key: 'email', label: 'Email' },
            {
              key: 'phone',
              label: 'Phone',
              render: (r: Customer) => r.phone || '—',
            },
            {
              key: 'loyalty_points',
              label: 'Points',
              render: (r: Customer) => (
                <span className="inline-flex items-center gap-1 font-semibold text-primary">
                  <Award className="size-3.5" />
                  {r.loyalty_points ?? 0}
                </span>
              ),
            },
            {
              key: 'is_student',
              label: 'Student',
              render: (r: Customer) =>
                r.is_student ? (
                  <span className="inline-flex items-center gap-1 text-xs text-success">
                    <GraduationCap className="size-3.5" />
                    Yes
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                ),
            },
            {
              key: 'created_at',
              label: 'Joined',
              render: (r: Customer) =>
                r.created_at
                  ? format(new Date(r.created_at), 'MMM d, yyyy')
                  : '—',
            },
          ]}
          actions={(row: Customer) => (
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => router.push(`/admin/customers/${row.id}`)}
              title="View Profile"
            >
              <Eye size={13} />
            </button>
          )}
        />
      </div>
    </div>
  )
}
