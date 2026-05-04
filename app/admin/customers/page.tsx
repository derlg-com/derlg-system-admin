import type { Metadata } from 'next'
import { CustomerList } from '@/components/admin/customers/CustomerList'
export const metadata: Metadata = { title: 'Customers — DerLg Admin' }
export default function CustomersPage() { return <CustomerList /> }
