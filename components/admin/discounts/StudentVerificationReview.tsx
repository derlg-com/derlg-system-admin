'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Loader2, User, GraduationCap, Calendar } from 'lucide-react'
import { discountsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'

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

interface StudentVerificationReviewProps {
  verification: Verification
  onClose: () => void
}

export function StudentVerificationReview({
  verification,
  onClose,
}: StudentVerificationReviewProps) {
  const qc = useQueryClient()
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectConfirm, setShowRejectConfirm] = useState(false)

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: { status: string; rejection_reason?: string }
    }) => discountsApi.reviewStudentVerification(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-student-verifications'] })
      toast.success('Verification reviewed')
      onClose()
    },
    onError: () => toast.error('Failed to review verification'),
  })

  const handleApprove = () => {
    reviewMutation.mutate({
      id: verification.id,
      payload: { status: 'APPROVED' },
    })
  }

  const handleReject = () => {
    if (!rejectReason.trim()) {
      setShowRejectConfirm(true)
      return
    }
    reviewMutation.mutate({
      id: verification.id,
      payload: { status: 'REJECTED', rejection_reason: rejectReason },
    })
  }

  return (
    <div className="space-y-6">
      {/* Student info */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
          <User size={20} className="text-muted-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">
            {verification.user?.name || 'Unknown Student'}
          </h3>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <GraduationCap className="size-3.5" />
              {verification.institution_name}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3.5" />
              Submitted{' '}
              {formatDistanceToNow(new Date(verification.created_at), {
                addSuffix: true,
              })}
            </span>
            <Badge
              variant={
                verification.status === 'APPROVED'
                  ? 'default'
                  : verification.status === 'REJECTED'
                  ? 'destructive'
                  : 'secondary'
              }
              className="text-xs"
            >
              {verification.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Images comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Student ID</span>
            <span className="text-xs text-muted-foreground">Official document</span>
          </div>
          <div className="rounded-lg overflow-hidden border border-border-default aspect-[4/3] bg-muted">
            {verification.student_id_image_url ? (
              <img
                src={verification.student_id_image_url}
                alt="Student ID"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                No image available
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Selfie</span>
            <span className="text-xs text-muted-foreground">For comparison</span>
          </div>
          <div className="rounded-lg overflow-hidden border border-border-default aspect-[4/3] bg-muted">
            {verification.face_selfie_url ? (
              <img
                src={verification.face_selfie_url}
                alt="Selfie"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                No selfie uploaded
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rejection reason */}
      {verification.status === 'PENDING' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Rejection Reason{' '}
            <span className="text-muted-foreground font-normal">(required if rejecting)</span>
          </label>
          <textarea
            className="form-textarea w-full"
            rows={2}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g., Image unclear, ID expired, name mismatch..."
          />
        </div>
      )}

      {verification.rejection_reason && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm font-medium text-destructive">Rejection Reason</p>
          <p className="text-sm text-muted-foreground mt-1">
            {verification.rejection_reason}
          </p>
        </div>
      )}

      {/* Actions */}
      {verification.status === 'PENDING' && (
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={reviewMutation.isPending}
          >
            {reviewMutation.isPending && (
              <Loader2 className="size-4 animate-spin mr-1.5" />
            )}
            <XCircle className="size-4 mr-1.5" />
            Reject
          </Button>
          <Button
            onClick={handleApprove}
            disabled={reviewMutation.isPending}
          >
            {reviewMutation.isPending && (
              <Loader2 className="size-4 animate-spin mr-1.5" />
            )}
            <CheckCircle className="size-4 mr-1.5" />
            Approve
          </Button>
        </div>
      )}

      {verification.status !== 'PENDING' && (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      )}

      {/* Reject confirmation */}
      {showRejectConfirm && (
        <div className="p-4 rounded-lg border border-warning/30 bg-warning/10">
          <p className="text-sm text-warning">
            Please provide a rejection reason before rejecting.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setShowRejectConfirm(false)}
          >
            Dismiss
          </Button>
        </div>
      )}
    </div>
  )
}
