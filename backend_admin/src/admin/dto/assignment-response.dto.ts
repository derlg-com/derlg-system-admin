import { AssignmentStatus } from '@prisma/client';

export class AssignmentResponseDto {
  id: string;
  driverId: string;
  bookingId: string;
  vehicleId: string;
  status: AssignmentStatus;
  assignmentTimestamp: Date;
  responseTimestamp: Date | null;
  tripStartTime: Date | null;
  completionTimestamp: Date | null;
  rejectionReason: string | null;
  telegramNotified: boolean;
  createdAt: Date;
  updatedAt: Date;
  driver?: {
    id: string;
    driverName: string;
    driverId: string;
    phone: string;
    status: string;
  } | null;
  booking?: {
    id: string;
    reference: string;
    passenger_count: number;
    status: string;
    start_date: Date;
  } | null;
  vehicle?: {
    id: string;
    name: string;
    vehicle_type: string;
    capacity: number;
    license_plate: string | null;
  } | null;
}
