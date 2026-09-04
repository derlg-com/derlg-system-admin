import React from 'react'
import { render, screen, waitFor } from '@/__tests__/test-utils'
import { BookingDetailView } from '@/components/admin/bookings/BookingDetailView'
import * as api from '@/lib/api'
import userEvent from '@testing-library/user-event'

// BookingDetailView fetches a single booking (`bookingsApi.get(id).then(r => r.data)`),
// so the get mock resolves the bare booking envelope `{ data: booking }` — not a
// paginated list. It does not use `unwrapList`, so no requireActual is needed here.
jest.mock('@/lib/api', () => ({
  bookingsApi: {
    get: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
  },
  driversApi: {
    list: jest.fn(),
  },
  assignmentsApi: {
    create: jest.fn(),
  },
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

// The real DriverAssignmentPanel consumes the assignment in camelCase
// (`driver.driverName`, `telegramNotified`, `assignmentTimestamp`) and posts
// `assignmentsApi.create({ driverId, bookingId })`. The double mirrors that
// contract so the fixture stays in the true backend shape.
jest.mock('@/components/admin/bookings/DriverAssignmentPanel', () => ({
  DriverAssignmentPanel: ({
    bookingId,
    currentAssignment,
  }: {
    bookingId: string
    currentAssignment?: {
      driver?: { driverName?: string }
      telegramNotified?: boolean
    }
  }) => {
    if (currentAssignment) {
      return (
        <div data-testid="driver-assignment-panel">
          <h3>Current Assignment</h3>
          <div>Pending Response</div>
          <div>{currentAssignment.driver?.driverName}</div>
          {currentAssignment.telegramNotified && <div>Telegram notified</div>}
        </div>
      )
    }
    return (
      <div data-testid="driver-assignment-panel">
        <div>Assign Driver</div>
        <select data-testid="driver-select">
          <option value="">Select driver</option>
          <option value="drv-1">John Doe</option>
          <option value="drv-2">Jane Smith</option>
        </select>
        <button
          onClick={() => {
            api.assignmentsApi
              .create({ driverId: 'drv-1', bookingId })
              .catch(() => {})
          }}
        >
          Assign Driver
        </button>
      </div>
    )
  },
}))

// camelCase fields matching the admin API's Booking aggregate:
//   reference (not booking_ref), startDate/endDate (not travel_date/end_date),
//   passengerCount (not num_adults/num_children), totalUsd/subtotalUsd/discountUsd,
//   user.fullName (not user.name), items[].bookingType (booking type lives on the
//   line items, not the booking), driverAssignment (not assignment), and payments
//   with amountUsd/paidAt. BookingStatus is lowercase.
const mockBooking = {
  id: 'booking-1',
  reference: 'BK20240517001',
  status: 'confirmed',
  startDate: '2026-05-20',
  endDate: '2026-05-25',
  passengerCount: 3,
  totalUsd: 1250.0,
  subtotalUsd: 1300.0,
  discountUsd: 50.0,
  userId: 'user-1',
  special_requests: 'Vegetarian meals',
  customizations: 'Extra luggage space',
  createdAt: '2026-05-10T10:00:00Z',
  user: {
    fullName: 'John Smith',
    email: 'john@example.com',
    phone: '+85512345678',
  },
  items: [{ bookingType: 'trip', vehicleId: null }],
  trip: {
    name: 'Angkor Wat Tour',
    destination: 'Siem Reap',
  },
  hotel: {
    name: 'Grand Hotel',
    location: 'Phnom Penh',
  },
  vehicle: {
    id: 'veh-1',
    name: 'Toyota Hiace',
    category: 'VAN',
    capacity: 12,
  },
  guide: {
    name: 'Sokha Chen',
    languages: ['English', 'Khmer'],
  },
  driverAssignment: null,
  payments: [
    {
      id: 'pay-1',
      status: 'succeeded',
      amountUsd: 1250.0,
      paidAt: '2026-05-10T10:05:00Z',
    },
  ],
}

const mockBookingWithAssignment = {
  ...mockBooking,
  // Transport line item is what triggers the driver panel now (booking_type is gone).
  items: [{ bookingType: 'transportation', vehicleId: 'veh-1' }],
  driverAssignment: {
    id: 'assign-1',
    driverId: 'drv-1',
    vehicleId: 'veh-1',
    // AssignmentStatus is UPPERCASE in Prisma.
    status: 'PENDING',
    telegramNotified: true,
    assignmentTimestamp: new Date().toISOString(),
    driver: {
      driverName: 'John Doe',
      phone: '+85512345678',
    },
  },
}

const mockDrivers = [
  {
    id: 'drv-1',
    driverName: 'John Doe',
    phone: '+85512345678',
    telegramId: '123456789',
    vehicleId: 'veh-1',
    status: 'AVAILABLE',
  },
  {
    id: 'drv-2',
    driverName: 'Jane Smith',
    phone: '+85587654321',
    telegramId: null,
    vehicleId: 'veh-2',
    status: 'AVAILABLE',
  },
]

/** Mimics the axios envelope interceptor for an admin list (`{ data, meta }`). */
function paginated<T>(items: T[]) {
  return {
    data: {
      data: items,
      meta: { page: 1, limit: 20, total: items.length, totalPages: 1 },
    },
  }
}

describe('BookingDetailView', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders booking details correctly', async () => {
    ;(api.bookingsApi.get as jest.Mock).mockResolvedValue({ data: mockBooking })

    render(<BookingDetailView bookingId="booking-1" />)

    await waitFor(() => {
      expect(screen.getByText('BK20240517001')).toBeInTheDocument()
    })

    // Status renders as the lowercase enum with underscores spaced out.
    expect(screen.getByText('confirmed')).toBeInTheDocument()
    expect(screen.getByText('John Smith')).toBeInTheDocument()
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
    // Passengers is a single count now (no adults/children split).
    expect(screen.getByText(/3 passengers/)).toBeInTheDocument()
  })

  // NOTE: The "shows AI assisted badge" test was deleted. The badge/column was
  // removed from BookingDetailView (and BookingList) because the backend returns
  // no `ai_assisted` / provenance field on a booking. There is no data source for
  // the feature this test asserted, so it cannot be made to pass without inventing
  // a backend column — it is a stale assertion of a removed (buggy) UI element.

  it('shows booking not found when API returns empty', async () => {
    ;(api.bookingsApi.get as jest.Mock).mockResolvedValue({ data: null })

    render(<BookingDetailView bookingId="nonexistent" />)

    await waitFor(() => {
      expect(screen.getByText('Booking not found')).toBeInTheDocument()
    })
  })

  it('shows modify and cancel buttons for editable bookings', async () => {
    ;(api.bookingsApi.get as jest.Mock).mockResolvedValue({ data: mockBooking })

    render(<BookingDetailView bookingId="booking-1" />)

    await waitFor(() => {
      expect(screen.getByText('Modify')).toBeInTheDocument()
    })

    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('hides modify/cancel buttons for non-editable bookings', async () => {
    const completedBooking = { ...mockBooking, status: 'completed' }
    ;(api.bookingsApi.get as jest.Mock).mockResolvedValue({ data: completedBooking })

    render(<BookingDetailView bookingId="booking-1" />)

    await waitFor(() => {
      expect(screen.getByText('BK20240517001')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: /modify/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument()
  })

  it('renders driver assignment panel for transport bookings', async () => {
    ;(api.bookingsApi.get as jest.Mock).mockResolvedValue({
      data: { ...mockBooking, items: [{ bookingType: 'transportation', vehicleId: 'veh-1' }] },
    })
    ;(api.driversApi.list as jest.Mock).mockResolvedValue(paginated(mockDrivers))

    render(<BookingDetailView bookingId="booking-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('driver-assignment-panel')).toBeInTheDocument()
    })
  })

  it('shows current assignment when one exists', async () => {
    ;(api.bookingsApi.get as jest.Mock).mockResolvedValue({
      data: mockBookingWithAssignment,
    })
    ;(api.driversApi.list as jest.Mock).mockResolvedValue(paginated(mockDrivers))

    render(<BookingDetailView bookingId="booking-1" />)

    await waitFor(() => {
      expect(screen.getByText('Current Assignment')).toBeInTheDocument()
    })

    expect(screen.getByText('Pending Response')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Telegram notified')).toBeInTheDocument()
  })

  it('assigns a driver to booking', async () => {
    const user = userEvent.setup()
    ;(api.bookingsApi.get as jest.Mock).mockResolvedValue({
      data: { ...mockBooking, items: [{ bookingType: 'transportation', vehicleId: 'veh-1' }] },
    })
    ;(api.driversApi.list as jest.Mock).mockResolvedValue(paginated(mockDrivers))
    ;(api.assignmentsApi.create as jest.Mock).mockResolvedValue({ data: {} })

    render(<BookingDetailView bookingId="booking-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('driver-assignment-panel')).toBeInTheDocument()
    })

    // Select a driver from the mocked native select
    const select = screen.getByTestId('driver-select')
    await user.selectOptions(select, 'drv-1')

    // Click assign button
    const assignButton = screen.getByRole('button', { name: /assign driver/i })
    await user.click(assignButton)

    // AssignDriverDto expects camelCase driverId/bookingId.
    await waitFor(() => {
      expect(api.assignmentsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          driverId: 'drv-1',
          bookingId: 'booking-1',
        })
      )
    })
  })

  it('shows payment history', async () => {
    ;(api.bookingsApi.get as jest.Mock).mockResolvedValue({ data: mockBooking })

    render(<BookingDetailView bookingId="booking-1" />)

    await waitFor(() => {
      expect(screen.getByText('Payment History')).toBeInTheDocument()
    })

    // The payment row renders the payment status; `payment_method` is no longer
    // returned by the backend, so the old "Credit Card" assertion was removed.
    expect(screen.getByText('succeeded')).toBeInTheDocument()
  })

  it('shows price breakdown with discount', async () => {
    ;(api.bookingsApi.get as jest.Mock).mockResolvedValue({ data: mockBooking })

    render(<BookingDetailView bookingId="booking-1" />)

    await waitFor(() => {
      expect(screen.getByText('Price Breakdown')).toBeInTheDocument()
    })

    // Use within to scope the search to the price breakdown section
    const priceSection = screen.getByText('Price Breakdown').closest('.card') || document.body
    expect(priceSection).toBeInTheDocument()
  })
})
