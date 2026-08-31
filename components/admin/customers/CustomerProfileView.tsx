'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  GraduationCap,
  Award,
  Calendar,
  Star,
  AlertTriangle,
  BookOpen,
  Loader2,
  MessageSquare,
} from 'lucide-react'
import { customersApi, bookingsApi, emergencyApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'

interface CustomerProfileViewProps {
  customerId: string
}

interface Customer {
  id: string
  name: string
  email: string
  phone?: string
  avatar_url?: string
  loyalty_points?: number
  is_student?: boolean
  role?: string
  created_at: string
  updated_at?: string
}

interface Booking {
  id: string
  booking_ref: string
  booking_type: string
  status: string
  total_usd: number
  travel_date?: string
  created_at: string
}

interface EmergencyAlert {
  id: string
  alert_type: string
  status: string
  message?: string
  created_at: string
}

interface Review {
  id: string
  rating: number
  comment: string
  created_at: string
  target_type: string
  target_name: string
}

interface LoyaltyTransaction {
  id: string
  points: number
  reason: string
  created_at: string
}

export function CustomerProfileView({ customerId }: CustomerProfileViewProps) {
  const router = useRouter()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<
    'profile' | 'bookings' | 'loyalty' | 'reviews' | 'emergency'
  >('profile')
  const [adjustPoints, setAdjustPoints] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['admin-customer', customerId],
    queryFn: () =>
      customersApi.get(customerId).then((r) => r.data as Customer),
    staleTime: 30000,
  })

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['admin-customer-bookings', customerId],
    queryFn: () =>
      bookingsApi
        .list({ user_id: customerId })
        .then((r) => r.data as Booking[]),
    enabled: !!customerId,
    staleTime: 30000,
  })

  const { data: emergencies = [], isLoading: emergenciesLoading } = useQuery({
    queryKey: ['admin-customer-emergencies', customerId],
    queryFn: () =>
      emergencyApi
        .list({ user_id: customerId })
        .then((r) => r.data as EmergencyAlert[]),
    enabled: !!customerId,
    staleTime: 60000,
  })

  const adjustMutation = useMutation({
    mutationFn: (data: {
      user_id: string
      points: number
      reason: string
    }) => customersApi.adjustLoyalty(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-customer', customerId] })
      setAdjustPoints('')
      setAdjustReason('')
      toast.success('Loyalty points adjusted')
    },
    onError: () => toast.error('Failed to adjust loyalty points'),
  })

  // Mock data for reviews and loyalty transactions
  const mockReviews: Review[] = customer
    ? [
        {
          id: 'r1',
          rating: 5,
          comment: 'Excellent service and friendly guide!',
          created_at: customer.created_at,
          target_type: 'guide',
          target_name: 'Sokha Kim',
        },
        {
          id: 'r2',
          rating: 4,
          comment: 'Great hotel, but check-in was slow.',
          created_at: customer.created_at,
          target_type: 'hotel',
          target_name: 'Grand Riverside Hotel',
        },
      ]
    : []

  const mockTransactions: LoyaltyTransaction[] = customer
    ? [
        {
          id: 't1',
          points: +(customer.loyalty_points || 0),
          reason: 'Current balance',
          created_at: customer.updated_at || customer.created_at,
        },
        {
          id: 't2',
          points: 150,
          reason: 'Booking reward',
          created_at: customer.created_at,
        },
        {
          id: 't3',
          points: 50,
          reason: 'Referral bonus',
          created_at: customer.created_at,
        },
      ]
    : []

  if (customerLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <User className="size-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">Customer not found</h2>
        <p className="text-muted-foreground mt-1">
          The customer you are looking for does not exist.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/admin/customers')}
        >
          <ArrowLeft className="size-4 mr-1" /> Back to Customers
        </Button>
      </div>
    )
  }

  const bookingColumns = [
    { key: 'booking_ref', label: 'Ref', sortable: true },
    {
      key: 'booking_type',
      label: 'Type',
      render: (r: Booking) => (
        <Badge variant="secondary" className="text-xs capitalize">
          {r.booking_type}
        </Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: Booking) => (
        <span
          className={`text-xs font-medium ${
            r.status === 'COMPLETED'
              ? 'text-emerald-400'
              : r.status === 'CONFIRMED'
              ? 'text-blue-400'
              : r.status === 'CANCELLED'
              ? 'text-red-400'
              : 'text-amber-400'
          }`}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: 'travel_date',
      label: 'Travel Date',
      render: (r: Booking) =>
        r.travel_date ? format(new Date(r.travel_date), 'PP') : '—',
    },
    {
      key: 'total_usd',
      label: 'Total',
      render: (r: Booking) => `$${Number(r.total_usd).toFixed(2)}`,
    },
  ]

  const emergencyColumns = [
    {
      key: 'alert_type',
      label: 'Type',
      render: (r: EmergencyAlert) => (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive">
          <AlertTriangle className="size-3.5" />
          {r.alert_type}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: EmergencyAlert) => (
        <Badge
          variant={
            r.status === 'RESOLVED'
              ? 'default'
              : r.status === 'ACKNOWLEDGED'
              ? 'secondary'
              : 'destructive'
          }
          className="text-xs"
        >
          {r.status}
        </Badge>
      ),
    },
    {
      key: 'message',
      label: 'Message',
      render: (r: EmergencyAlert) => (
        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
          {r.message || '—'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Time',
      render: (r: EmergencyAlert) =>
        formatDistanceToNow(new Date(r.created_at), { addSuffix: true }),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push('/admin/customers')}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex items-center gap-3">
          {customer.avatar_url ? (
            <img
              src={customer.avatar_url}
              alt={customer.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <User size={20} className="text-muted-foreground" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">{customer.name}</h1>
            <p className="text-sm text-muted-foreground">
              {customer.email}
              {customer.is_student && (
                <Badge variant="outline" className="ml-2 text-xs">
                  <GraduationCap className="size-3 mr-1" />
                  Student
                </Badge>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Award className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {customer.loyalty_points ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Loyalty Points</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-emerald-400/10 flex items-center justify-center">
              <BookOpen className="size-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{bookings.length}</p>
              <p className="text-xs text-muted-foreground">Bookings</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-amber-400/10 flex items-center justify-center">
              <Star className="size-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockReviews.length}</p>
              <p className="text-xs text-muted-foreground">Reviews</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="size-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{emergencies.length}</p>
              <p className="text-xs text-muted-foreground">Emergencies</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
        <button
          className={`tab ${activeTab === 'bookings' ? 'active' : ''}`}
          onClick={() => setActiveTab('bookings')}
        >
          Bookings ({bookings.length})
        </button>
        <button
          className={`tab ${activeTab === 'loyalty' ? 'active' : ''}`}
          onClick={() => setActiveTab('loyalty')}
        >
          Loyalty
        </button>
        <button
          className={`tab ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          Reviews
        </button>
        <button
          className={`tab ${activeTab === 'emergency' ? 'active' : ''}`}
          onClick={() => setActiveTab('emergency')}
        >
          Emergencies ({emergencies.length})
        </button>
      </div>

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card space-y-4">
            <h3 className="card-title">Customer Information</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="text-sm font-medium">{customer.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{customer.email}</p>
                </div>
              </div>
              {customer.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <a
                      href={`tel:${customer.phone}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {customer.phone}
                    </a>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <GraduationCap className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Student</p>
                  <p className="text-sm font-medium">
                    {customer.is_student ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Award className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Loyalty Points</p>
                  <p className="text-sm font-medium">
                    {customer.loyalty_points ?? 0} points
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="text-sm font-medium">
                    {format(new Date(customer.created_at), 'PPP')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Loyalty adjustment */}
          <div className="card space-y-4">
            <h3 className="card-title">Adjust Loyalty Points</h3>
            <div className="space-y-3">
              <div>
                <label className="form-label">Points (±)</label>
                <input
                  className="form-input"
                  type="number"
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(e.target.value)}
                  placeholder="+100 or -50"
                />
              </div>
              <div>
                <label className="form-label">Reason</label>
                <input
                  className="form-input"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Compensation, error correction..."
                />
              </div>
              <Button
                className="w-full"
                disabled={
                  !adjustPoints || !adjustReason || adjustMutation.isPending
                }
                onClick={() =>
                  adjustMutation.mutate({
                    user_id: customerId,
                    points: +adjustPoints,
                    reason: adjustReason,
                  })
                }
              >
                {adjustMutation.isPending && (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                )}
                Apply Adjustment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bookings tab */}
      {activeTab === 'bookings' && (
        <div className="card">
          <DataTable
            columns={bookingColumns}
            data={bookings}
            loading={bookingsLoading}
            emptyMessage="No bookings found"
            rowKey="id"
          />
        </div>
      )}

      {/* Loyalty tab */}
      {activeTab === 'loyalty' && (
        <div className="card space-y-4">
          <h3 className="card-title">Loyalty Transaction History</h3>
          <div className="space-y-2">
            {mockTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border-default"
              >
                <div>
                  <p className="text-sm font-medium">{tx.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(tx.created_at), 'PPp')}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    tx.points >= 0 ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {tx.points >= 0 ? '+' : ''}
                  {tx.points}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews tab */}
      {activeTab === 'reviews' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mockReviews.map((review) => (
            <div key={review.id} className="card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`size-4 ${
                        i < review.rating
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-muted-foreground'
                      }`}
                    />
                  ))}
                </div>
                <Badge variant="secondary" className="text-xs capitalize">
                  {review.target_type}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {review.comment}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{review.target_name}</span>
                <span>{format(new Date(review.created_at), 'PP')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Emergency tab */}
      {activeTab === 'emergency' && (
        <div className="card">
          <DataTable
            columns={emergencyColumns}
            data={emergencies}
            loading={emergenciesLoading}
            emptyMessage="No emergency alerts"
            rowKey="id"
          />
        </div>
      )}
    </div>
  )
}
