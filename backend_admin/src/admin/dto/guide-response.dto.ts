export class GuideResponseDto {
  id: string;
  user_id: string;
  user?: {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
  } | null;
  bio: string | null;
  avatar_url: string | null;
  images: string[];
  price_per_day_usd: number;
  is_verified: boolean;
  province: string;
  provinces: string[];
  is_active: boolean;
  languages: string[];
  specialties: string[];
  assignment_count: number;
  review_count: number;
  average_rating: number | null;
  created_at: Date;
  updated_at: Date;
}
