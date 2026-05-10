import type { Metadata } from 'next'
import { AdminUserList } from '@/components/admin/users/AdminUserList'
export const metadata: Metadata = { title: 'Admin Users — DerLg Admin' }
export default function UsersPage() { return <AdminUserList /> }
