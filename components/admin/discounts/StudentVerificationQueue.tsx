'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle } from 'lucide-react'
import { discountsApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared'
import { format } from 'date-fns'
import { useState } from 'react'

export function StudentVerificationQueue() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState('')

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-student-verifications'],
    queryFn: () => discountsApi.getStudentVerifications({ status: 'PENDING' }).then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => discountsApi.reviewStudentVerification(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-student-verifications'] }); setSelected(null); setRejectReason('') },
  })

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Student Verifications</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{data.length} pending reviews</p>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <DataTable data={data} loading={isLoading} rowKey="id" emptyMessage="No pending verifications"
          onRowClick={(row) => setSelected(row)}
          columns={[
            { key: 'user', label: 'Student', render: (r) => r.user?.name || r.user_id },
            { key: 'institution_name', label: 'Institution' },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'created_at', label: 'Submitted', render: (r) => format(new Date(r.created_at), 'MMM d, yyyy') },
          ]}
        />
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Student Verification Review</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Student ID</div>
                  <img src={selected.student_id_image_url} alt="Student ID" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border-default)' }} />
                </div>
                {selected.face_selfie_url && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Selfie</div>
                    <img src={selected.face_selfie_url} alt="Selfie" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border-default)' }} />
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <strong>Institution:</strong> {selected.institution_name}
              </div>
              <div>
                <label className="form-label">Rejection Reason (required when rejecting)</label>
                <input className="form-input" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g., Image unclear, ID expired" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={mutation.isPending}
                onClick={() => mutation.mutate({ id: selected.id, payload: { status: 'REJECTED', rejection_reason: rejectReason } })}>
                <XCircle size={14} /> Reject
              </button>
              <button className="btn btn-primary" disabled={mutation.isPending}
                onClick={() => mutation.mutate({ id: selected.id, payload: { status: 'APPROVED' } })}>
                <CheckCircle size={14} /> Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
