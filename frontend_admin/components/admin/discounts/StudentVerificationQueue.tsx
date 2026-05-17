'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { discountsApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, StatusBadge } from '@/components/shared'
import { StudentVerificationReview } from './StudentVerificationReview'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDistanceToNow } from 'date-fns'

interface Verification {
  id: string
  user_id: string
  user?: { name: string; email?: string }
  institution_name: string
  student_id_image_url: string
  face_selfie_url?: string
  status: string
  rejection_reason?: string
  created_at: string
  reviewed_at?: string
}

export function StudentVerificationQueue() {
  const [selected, setSelected] = useState<Verification | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-student-verifications'],
    queryFn: () =>
      discountsApi
        .getStudentVerifications({ status: 'PENDING' })
        .then((r) => r.data as Verification[]),
    staleTime: 30000,
  })

  return (
    <div>
      <PageHeader
        title="Student Verifications"
        subtitle={`${data.length} pending reviews`}
      />

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          data={data}
          loading={isLoading}
          rowKey="id"
          emptyMessage="No pending verifications"
          columns={[
            {
              key: 'student_name',
              label: 'Student',
              render: (r: Verification) => r.user?.name || r.user_id,
            },
            {
              key: 'institution_name',
              label: 'Institution',
            },
            {
              key: 'status',
              label: 'Status',
              render: (r: Verification) => <StatusBadge status={r.status} />,
            },
            {
              key: 'submitted_at',
              label: 'Submitted',
              render: (r: Verification) =>
                formatDistanceToNow(new Date(r.created_at), {
                  addSuffix: true,
                }),
            },
          ]}
          actions={(row: Verification) => (
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => setSelected(row)}
              title="Review"
            >
              <Eye size={14} />
            </button>
          )}
        />
      </div>

      {/* Review Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Verification Review</DialogTitle>
          </DialogHeader>
          {selected && (
            <StudentVerificationReview
              verification={selected}
              onClose={() => setSelected(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
