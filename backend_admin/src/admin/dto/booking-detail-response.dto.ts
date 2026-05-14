import { booking_status } from '@prisma/client';

export class BookingDetailResponseDto {
  id: string;
  userId: string;
  reference: string;
  start_date: Date;
  end_date: Date | null;
  status: booking_status;
  expires_at: Date;
  subtotal_usd: number;
  discount_usd: number;
  loyalty_discount_usd: number;
  totalUsd: number;
  cancelled_at: Date | null;
  cancel_reason: string | null;
  refund_percentage: number | null;
  passenger_count: number;
  room_count: number;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
  } | null;
  payments?: Array<{
    id: string;
    amount_usd: number;
    status: string;
    refunded_amount_usd: number;
    paid_at: Date | null;
  }>;
  booking_items?: Array<{
    id: string;
    booking_type: string;
    trip_id: string | null;
    hotel_room_id: string | null;
    vehicle_id: string | null;
    guide_id: string | null;
    date: Date;
    quantity: number;
    unit_price_usd: number;
    subtotal_usd: number;
  }>;
  driver_assignment?: {
    id: string;
    driverId: string;
    vehicleId: string;
    status: string;
    assignmentTimestamp: Date;
  } | null;
}
