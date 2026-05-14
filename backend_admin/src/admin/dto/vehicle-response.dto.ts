import { vehicle_type, pricing_model } from '@prisma/client';

export class VehicleResponseDto {
  id: string;
  name: string;
  vehicle_type: vehicle_type;
  license_plate: string | null;
  capacity: number;
  pricing_model: pricing_model;
  price_usd: number;
  province: string;
  images: string[];
  is_active: boolean;
  createdAt: Date;
  updatedAt: Date;
  assignedDriver?: {
    id: string;
    driverName: string;
    driverId: string;
    status: string;
    phone: string;
  } | null;
  maintenanceStatus?: 'SCHEDULED' | 'IN_MAINTENANCE' | 'COMPLETED' | null;
  maintenanceHistory?: Array<{
    id: string;
    maintenanceType: string;
    scheduledDate: Date;
    status: string;
  }>;
}
