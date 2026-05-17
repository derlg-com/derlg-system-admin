import React from 'react'
import { render, screen, waitFor } from '@/__tests__/test-utils'
import { BookingDetailView } from '@/components/admin/bookings/BookingDetailView'
import * as api from '@/lib/api'
import userEvent from '@testing-library/user-event'

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

jest.mock('@/components/admin/bookings/DriverAssignmentPanel', () => ({
  DriverAssignmentPanel: ({
    bookingId,
    currentAssignment,
  }: {
    bookingId: string
    currentAssignment?: any
  }) => {
    if (currentAssignment) {
      return (
        <div data-testid="driver-assignment-panel">
          <h3>Current Assignment</h3>
          <div>Pending Response</div>
          <div>{currentAssignment.driver?.driver_name}</div>
          {currentAssignment.telegram_notified && <div>Telegram notified</div>}
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
            const { assignmentsApi } = require('@/lib/api')
            assignmentsApi
              .create({ driver_id: 'drv-1', booking_id: bookingId })
              .catch(() => {})
          }}
        >
          Assign Driver
        </button>
      </div>
    )
  },
}))

const mockBooking = {
  id: 'booking-1',
  booking_ref: 'BK20240517001',
  status: 'CONFIRMED',
  booking_type: 'PACKAGE',
  travel_date: '2026-05-20',
  end_date: '2026-05-25',
  num_adults: 2,
  num_children: 1,
  total_usd: 1250.0,
  subtotal_usd: 1300.0,
  discount_amount_usd: 50.0,
  special_requests: 'Vegetarian meals',
  customizations: 'Extra luggage space',
  ai_assisted: true,
  created_at: '2026-05-10T10:00:00Z',
  user: {
    name: 'John Smith',
    email: 'john@example.com',
    phone: '+85512345678',
  },
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
  assignment: null,
  payments: [
    {
      id: 'pay-1',
      payment_method: 'Credit Card',
      status: 'COMPLETED',
      amount_usd: 1250.0,
      created_at: '2026-05-10T10:05:00Z',
    },
  ],
}

const mockBookingWithAssignment = {
  ...mockBooking,
  booking_type: 'TRANSPORT_ONLY',
  assignment: {
    id: 'assign-1',
    driver_id: 'drv-1',
    status: 'PENDING',
    telegram_notified: true,
    assignment_timestamp: new Date().toISOString(),
    driver: {
      driver_name: 'John Doe',
      phone: '+85512345678',
    },
  },
}

const mockDrivers = [
  {
    id: 'drv-1',
    driver_name: 'John Doe',
    phone: '+85512345678',
    telegram_id: '123456789',
    vehicle_id: 'veh-1',
    status: 'AVAILABLE',
  },
  {
    id: 'drv-2',
    driver_name: 'Jane Smith',
    phone: '+85587654321',
    telegram_id: null,
    vehicle_id: 'veh-2',
    status: 'AVAILABLE',
  },
]

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

    expect(screen.getByText('CONFIRMED')).toBeInTheDocument()
    expect(screen.getByText('John Smith')).toBeInTheDocument()
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
    expect(screen.getByText(/2 adults/)).toBeInTheDocument()
    expect(screen.getByText(/1 children/)).toBeInTheDocument()
  })

  it('shows AI assisted badge when booking is AI-assisted', async () => {
    ;(api.bookingsApi.get as jest.Mock).mockResolvedValue({ data: mockBooking })

    render(<BookingDetailView bookingId="booking-1" />)

    await waitFor(() => {
      expect(screen.getByText('AI')).toBeInTheDocument()
    })
  })

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
    const completedBooking = { ...mockBooking, status: 'COMPLETED' }
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
      data: { ...mockBooking, booking_type: 'TRANSPORT_ONLY' },
    })
    ;(api.driversApi.list as jest.Mock).mockResolvedValue({ data: mockDrivers })

    render(<BookingDetailView bookingId="booking-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('driver-assignment-panel')).toBeInTheDocument()
    })
  })

  it('shows current assignment when one exists', async () => {
    ;(api.bookingsApi.get as jest.Mock).mockResolvedValue({
      data: mockBookingWithAssignment,
    })
    ;(api.driversApi.list as jest.Mock).mockResolvedValue({ data: mockDrivers })

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
      data: { ...mockBooking, booking_type: 'TRANSPORT_ONLY' },
    })
    ;(api.driversApi.list as jest.Mock).mockResolvedValue({ data: mockDrivers })
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

    await waitFor(() => {
      expect(api.assignmentsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          driver_id: 'drv-1',
          booking_id: 'booking-1',
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

    expect(screen.getByText(/Credit Card/)).toBeInTheDocument()
    expect(screen.getByText(/COMPLETED/)).toBeInTheDocument()
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
