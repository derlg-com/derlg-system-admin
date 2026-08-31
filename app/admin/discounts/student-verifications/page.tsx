import type { Metadata } from 'next'
import { StudentVerificationQueue } from '@/components/admin/discounts/StudentVerificationQueue'

export const metadata: Metadata = {
  title: 'Student Verifications',
}

export default function StudentVerificationsPage() {
  return <StudentVerificationQueue />
}
