export class CustomerResponseDto {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  loyalty_points: number;
  is_student_verified: boolean;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  booking_count?: number;
  review_count?: number;
  total_spent_usd?: number;
}
