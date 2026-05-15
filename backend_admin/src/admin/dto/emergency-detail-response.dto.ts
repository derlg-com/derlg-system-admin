import { emergency_alert_status, emergency_alert_type } from '@prisma/client';

export class EmergencyDetailResponseDto {
  id: string;
  userId: string;
  user?: {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
  } | null;
  alertType: emergency_alert_type;
  status: emergency_alert_status;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  acknowledged_at: Date | null;
  acknowledged_by: string | null;
  resolved_at: Date | null;
  notes: string | null;
  driver?: {
    id: string;
    driverName: string;
    phone: string;
    status: string;
  } | null;
  createdAt: Date;
}
