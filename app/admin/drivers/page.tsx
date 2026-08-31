import type { Metadata } from 'next'
import { DriverList } from '@/components/admin/drivers/DriverList'
export const metadata: Metadata = { title: 'Drivers — DerLg Admin' }
export default function DriversPage() { return <DriverList /> }
