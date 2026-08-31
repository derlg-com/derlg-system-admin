'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Star,
  Calendar,
  Clock,
  Award,
  Languages,
  MapPin,
  DollarSign,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { guidesApi, bookingsApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  formatDistanceToNow,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

interface GuideDetailViewProps {
  guideId: string
}

interface Guide {
  id: string
  name?: string
  user?: { name: string; email?: string; phone?: string }
  bio?: string
  profile_picture?: string
  languages?: string[]
  specialties?: string[]
  experience_years?: number
  certifications?: string[]
  price_per_hour?: number
  price_per_day?: number
  avg_rating?: number
  average_rating?: number
  total_assignments?: number
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

interface BookingAssignment {
  id: string
  booking_ref: string
  customer_name: string
  travel_date: string
  status: string
  total: number
  created_at: string
}

export function GuideDetailView({ guideId }: GuideDetailViewProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'profile' | 'assignments' | 'calendar'>('profile')
  const [calendarMonth, setCalendarMonth] = useState(new Date())

  const { data: guide, isLoading: guideLoading } = useQuery({
    queryKey: ['admin-guide', guideId],
    queryFn: () => guidesApi.get(guideId).then((r) => r.data as Guide),
    staleTime: 30000,
  })

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['admin-guide-bookings', guideId],
    queryFn: () =>
      bookingsApi.list({ guide_id: guideId }).then((r) => r.data as BookingAssignment[]),
    enabled: !!guideId,
    staleTime: 30000,
  })

  if (guideLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!guide) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="size-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">Guide not found</h2>
        <p className="text-muted-foreground mt-1">The guide you are looking for does not exist.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/guides')}>
          <ArrowLeft className="size-4 mr-1" /> Back to Guides
        </Button>
      </div>
    )
  }

  const displayName = guide.name || guide.user?.name || 'Unknown'
  const rating = guide.avg_rating || guide.average_rating || 0
  const totalAssignments = guide.total_assignments ?? bookings.length
  const completedAssignments = bookings.filter((b) => b.status === 'COMPLETED').length

  const assignmentColumns = [
    { key: 'booking_ref', label: 'Booking Ref', sortable: true },
    { key: 'customer_name', label: 'Customer', sortable: true },
    {
      key: 'travel_date',
      label: 'Travel Date',
      render: (r: BookingAssignment) =>
        r.travel_date ? format(new Date(r.travel_date), 'PP') : '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: BookingAssignment) => (
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${
            r.status === 'COMPLETED'
              ? 'text-emerald-400'
              : r.status === 'CONFIRMED'
              ? 'text-blue-400'
              : r.status === 'CANCELLED'
              ? 'text-red-400'
              : r.status === 'PENDING'
              ? 'text-amber-400'
              : 'text-slate-400'
          }`}
        >
          {r.status === 'COMPLETED' && <CheckCircle2 className="size-3" />}
          {r.status === 'CANCELLED' && <XCircle className="size-3" />}
          {r.status}
        </span>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      render: (r: BookingAssignment) => `$${Number(r.total).toFixed(2)}`,
    },
  ]

  // Calendar helpers are imported statically at the top of the file. They were
  // pulled in with require() inside the render body, which re-resolves the module
  // on every render and defeats tree-shaking.

  const monthStart = startOfMonth(calendarMonth)
  const monthEnd = endOfMonth(monthStart)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(monthEnd)

  const calendarDays: Date[] = []
  let day = calStart
  while (day <= calEnd) {
    calendarDays.push(day)
    day = addDays(day, 1)
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const getAvailability = (date: Date) => {
    const booking = bookings.find((b) =>
      b.travel_date ? isSameDay(new Date(b.travel_date), date) : false
    )
    if (booking) {
      return booking.status === 'COMPLETED' ? 'completed' : 'booked'
    }
    const daySeed = date.getDate()
    if (daySeed % 7 === 0) return 'unavailable'
    return 'available'
  }

  const availabilityColor = (status: string) => {
    switch (status) {
      case 'booked':
        return 'bg-warning/20 text-warning'
      case 'completed':
        return 'bg-success/20 text-success'
      case 'unavailable':
        return 'bg-destructive/20 text-destructive'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.push('/admin/guides')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex items-center gap-3">
          {guide.profile_picture ? (
            <img
              src={guide.profile_picture}
              alt={displayName}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <MapPin size={20} className="text-muted-foreground" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">{displayName}</h1>
            <p className="text-sm text-muted-foreground">
              {guide.experience_years ?? 0} years experience ·{' '}
              <Badge variant={guide.is_active !== false ? 'default' : 'secondary'}>
                {guide.is_active !== false ? 'Active' : 'Inactive'}
              </Badge>
            </p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-emerald-400/10 flex items-center justify-center">
              <Briefcase className="size-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalAssignments}</p>
              <p className="text-xs text-muted-foreground">Total Assignments</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-amber-400/10 flex items-center justify-center">
              <Star className="size-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {rating > 0 ? Number(rating).toFixed(1) : 'N/A'}
              </p>
              <p className="text-xs text-muted-foreground">Average Rating</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-blue-400/10 flex items-center justify-center">
              <CheckCircle2 className="size-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedAssignments}</p>
              <p className="text-xs text-muted-foreground">Completed Tours</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
          Profile
        </button>
        <button className={`tab ${activeTab === 'assignments' ? 'active' : ''}`} onClick={() => setActiveTab('assignments')}>
          Assignment History ({bookings.length})
        </button>
        <button className={`tab ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>
          Availability
        </button>
      </div>

      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile info */}
          <div className="card space-y-4">
            <h3 className="card-title">Guide Information</h3>
            <div className="space-y-3">
              {guide.bio && (
                <div className="flex items-start gap-3">
                  <Briefcase className="size-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Bio</p>
                    <p className="text-sm font-medium">{guide.bio}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Languages className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Languages</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(guide.languages || []).map((l) => (
                      <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Specialties</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(guide.specialties || []).map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Award className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Certifications</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(guide.certifications || []).map((c) => (
                      <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & contact */}
          <div className="card space-y-4">
            <h3 className="card-title">Pricing & Contact</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <DollarSign className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Price per Hour</p>
                  <p className="text-sm font-medium">
                    {guide.price_per_hour ? `$${Number(guide.price_per_hour).toFixed(2)}` : '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <DollarSign className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Price per Day</p>
                  <p className="text-sm font-medium">
                    {guide.price_per_day ? `$${Number(guide.price_per_day).toFixed(2)}` : '—'}
                  </p>
                </div>
              </div>
              {guide.user?.email && (
                <div className="flex items-center gap-3">
                  <MapPin className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{guide.user.email}</p>
                  </div>
                </div>
              )}
              {guide.user?.phone && (
                <div className="flex items-center gap-3">
                  <MapPin className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="text-sm font-medium">{guide.user.phone}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="text-sm font-medium">
                    {guide.created_at ? format(new Date(guide.created_at), 'PPP') : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="card">
          <DataTable
            columns={assignmentColumns}
            data={bookings}
            loading={bookingsLoading}
            emptyMessage="No assignment history yet"
            rowKey="id"
          />
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="card">
          <div className="card-header" style={{ marginBottom: 16, paddingBottom: 16 }}>
            <div>
              <h3 className="card-title">Availability Calendar</h3>
              <p className="page-subtitle">{format(calendarMonth, 'MMMM yyyy')}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
                Next
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-muted border border-border-default" />
              <span className="text-xs text-muted-foreground">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-warning/20 border border-warning/40" />
              <span className="text-xs text-muted-foreground">Booked</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-success/20 border border-success/40" />
              <span className="text-xs text-muted-foreground">Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-destructive/20 border border-destructive/40" />
              <span className="text-xs text-muted-foreground">Unavailable</span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((wd) => (
              <div key={wd} className="text-center text-xs font-medium text-muted-foreground py-2">
                {wd}
              </div>
            ))}
            {calendarDays.map((d, i) => {
              const status = getAvailability(d)
              const inMonth = isSameMonth(d, calendarMonth)
              return (
                <div
                  key={i}
                  className={`
                    aspect-square rounded-md border p-1 flex flex-col items-center justify-center gap-0.5
                    ${inMonth ? '' : 'opacity-30 bg-muted/30'}
                    ${isSameDay(d, new Date()) ? 'border-primary ring-1 ring-primary' : 'border-border-default'}
                  `}
                >
                  <span className={`text-xs font-medium ${isSameDay(d, new Date()) ? 'text-primary' : ''}`}>
                    {format(d, 'd')}
                  </span>
                  {inMonth && (
                    <span className={`text-[10px] px-1 py-0.5 rounded-full ${availabilityColor(status)}`}>
                      {status === 'available' ? 'Free' : status === 'booked' ? 'Booked' : status === 'completed' ? 'Done' : 'Off'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
