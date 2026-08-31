import type { Metadata } from 'next'
import { VehicleList } from '@/components/admin/vehicles/VehicleList'
export const metadata: Metadata = { title: 'Vehicles — DerLg Admin' }
export default function VehiclesPage() { return <VehicleList /> }
