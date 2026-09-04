'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { discountsApi, unwrapList } from '@/lib/api'
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
  // Backend (admin-discounts.service getAllStudentVerifications) returns camelCase.
  userId?: string
  user?: { name: string; fullName?: string | null; email?: string }
  status: string
  createdAt: string
  // Legacy snake_case fields still read by StudentVerificationReview (a sibling
  // component not in this change set). The backend no longer emits these names;
  // they are kept so `selected` stays assignable to that component's props until
  // it is migrated too.
  user_id: string
  institution_name: string
  student_id_image_url: string
  face_selfie_url?: string
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
        .getStudentVerifications({ status: 'pending' })
        .then((r) => unwrapList<Verification>(r).items),
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
              render: (r: Verification) => r.user?.fullName || r.userId,
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
                formatDistanceToNow(new Date(r.createdAt), {
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
