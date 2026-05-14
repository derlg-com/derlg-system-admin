import { DriverStatus } from '@prisma/client';

export class DriverResponseDto {
  id: string;
  driverName: string;
  driverId: string;
  telegramId: bigint | null;
  phone: string;
  vehicleId: string | null;
  status: DriverStatus;
  preferredLanguage: string;
  lastStatusUpdate: Date;
  lastTelegramActivity: Date | null;
  createdAt: Date;
  updatedAt: Date;
  vehicle?: {
    id: string;
    name: string;
    vehicle_type: string;
    capacity: number;
    license_plate: string | null;
  } | null;
  assignmentCount: number;
}
