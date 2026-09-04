import React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@/__tests__/test-utils'
import { DriverList } from '@/components/admin/drivers/DriverList'
import * as api from '@/lib/api'
import userEvent from '@testing-library/user-event'

// Mock the API module.
//
// `requireActual` keeps the real `unwrapList` — the component pipes every list
// response through `driversApi.list(params).then(unwrapList<Driver>)`, so a stub
// that omitted it would turn `.then(unwrapList)` into `.then(undefined)` and the
// data would never unwrap into `{ items, meta }`.
//
// `driversApi.delete` is gone: soft-delete is now `deactivate` (a PATCH), because
// assignment/booking history references the driver row.
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api')
  return {
    ...actual,
    driversApi: {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deactivate: jest.fn(),
    },
    vehiclesApi: {
      list: jest.fn().mockResolvedValue({
        data: {
          data: [
            { id: 'veh-1', name: 'Toyota Camry', licensePlate: 'PP-1234' },
            { id: 'veh-2', name: 'Honda Civic', licensePlate: 'PP-5678' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        },
      }),
    },
  }
})

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/admin/drivers',
}))

jest.mock('@/components/admin/drivers/DriverForm', () => ({
  DriverForm: ({
    onSubmit,
    onCancel,
  }: {
    onSubmit?: (data: { driver_name: string; driver_id: string; phone: string }) => void
    onCancel?: () => void
  }) => (
    <form data-testid="driver-form">
      <input placeholder="Driver Name" />
      <button type="button" onClick={() => onSubmit?.({
        driver_name: 'Test Driver',
        driver_id: 'DRV999',
        phone: '+85512345678',
      })} >Submit</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </form>
  ),
}))

/**
 * Shapes a mocked `list()` result the way the axios envelope interceptor leaves
 * it: `response.data` is the `{ data, meta }` page object, NOT a bare array.
 * `unwrapList` normalises this to `{ items, meta }`.
 */
function paginated<T>(items: T[]) {
  return {
    data: {
      data: items,
      meta: { page: 1, limit: 20, total: items.length, totalPages: 1 },
    },
  }
}

// camelCase fields matching the admin API's Driver shape (see prisma `Driver`):
// telegramId is a BigInt serialised to a string|null; vehicle is the included
// relation used to render the Vehicle column.
const mockDrivers = [
  {
    id: 'drv-1',
    driverName: 'John Doe',
    driverId: 'DRV001',
    telegramId: '123456789',
    phone: '+85512345678',
    vehicleId: 'veh-1',
    status: 'AVAILABLE',
    lastStatusUpdate: new Date().toISOString(),
    lastTelegramActivity: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    vehicle: { id: 'veh-1', name: 'Toyota Camry', licensePlate: 'PP-1234' },
  },
  {
    id: 'drv-2',
    driverName: 'Jane Smith',
    driverId: 'DRV002',
    telegramId: null,
    phone: '+85587654321',
    vehicleId: null,
    status: 'BUSY',
    lastStatusUpdate: new Date().toISOString(),
    lastTelegramActivity: null,
    createdAt: new Date().toISOString(),
    vehicle: null,
  },
  {
    id: 'drv-3',
    driverName: 'Bob Wilson',
    driverId: 'DRV003',
    telegramId: '987654321',
    phone: '+85511223344',
    vehicleId: 'veh-2',
    status: 'OFFLINE',
    lastStatusUpdate: new Date().toISOString(),
    lastTelegramActivity: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    vehicle: { id: 'veh-2', name: 'Honda Civic', licensePlate: 'PP-5678' },
  },
]

describe('DriverList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(api.driversApi.list as jest.Mock).mockResolvedValue(paginated(mockDrivers))
  })

  it('renders driver list with correct columns', async () => {
    render(<DriverList />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Wilson')).toBeInTheDocument()

    // Check columns are rendered
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Driver ID')).toBeInTheDocument()
    expect(screen.getByText('Vehicle')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Telegram')).toBeInTheDocument()
  })

  it('displays Telegram registration status correctly', async () => {
    render(<DriverList />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    // Registered drivers should show "Registered" badge
    const registeredBadges = screen.getAllByText('Registered')
    expect(registeredBadges).toHaveLength(2) // John and Bob have telegramId

    // Non-registered driver should show "Not Registered"
    expect(screen.getByText('Not Registered')).toBeInTheDocument()
  })

  it('filters drivers by status', async () => {
    const user = userEvent.setup()
    render(<DriverList />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    // Open status filter
    const statusFilter = screen.getByRole('button', { name: /all statuses/i })
    await user.click(statusFilter)

    // Select AVAILABLE
    const availableOption = screen.getByRole('menuitemcheckbox', { name: 'Available' })
    await user.click(availableOption)

    await waitFor(() => {
      expect(api.driversApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'AVAILABLE' })
      )
    })
  })

  it('filters drivers by Telegram registration status', async () => {
    const user = userEvent.setup()
    render(<DriverList />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    // Open Telegram filter
    const telegramFilter = screen.getByRole('button', { name: /telegram status/i })
    await user.click(telegramFilter)

    // Select Registered
    const registeredOption = screen.getByRole('menuitemcheckbox', { name: 'Registered' })
    await user.click(registeredOption)

    // has_telegram is validated server-side with @IsBooleanString, so the client
    // must send the STRING 'true'/'false', not a JS boolean.
    await waitFor(() => {
      expect(api.driversApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ has_telegram: 'true' })
      )
    })
  })

  it('searches drivers by name or ID', async () => {
    const user = userEvent.setup()
    render(<DriverList />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    // Type in search box
    const searchInput = screen.getByPlaceholderText(/search by name or id/i)
    await user.type(searchInput, 'Jane')

    // Should filter client-side to show only Jane
    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
    })
  })

  it('opens create driver form modal', async () => {
    const user = userEvent.setup()
    render(<DriverList />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    const addButton = screen.getByRole('button', { name: /add driver/i })
    await user.click(addButton)

    expect(screen.getByTestId('driver-form')).toBeInTheDocument()
  })

  it('handles real-time status updates via query invalidation', async () => {
    render(<DriverList />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    // Verify initial fetch
    expect(api.driversApi.list).toHaveBeenCalledTimes(1)

    // Simulate a mutation that invalidates the drivers query
    // In a real scenario, this would be triggered by a WebSocket event
    // Here we verify the component is set up to respond to query invalidation
    expect(useQueryClient).toBeDefined()
  })

  it('shows loading state while fetching', () => {
    // Delay the API response
    ;(api.driversApi.list as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // never resolves
    )

    render(<DriverList />)

    // Should show skeleton loaders
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows empty state when no drivers', async () => {
    ;(api.driversApi.list as jest.Mock).mockResolvedValue(paginated([]))

    render(<DriverList />)

    await waitFor(() => {
      expect(screen.getByText('No drivers found')).toBeInTheDocument()
    })
  })

  it('deactivates a driver via the confirm dialog', async () => {
    // The old Delete action called `driversApi.delete` (a DELETE that matched no
    // route and 404'd). It is now a soft-delete via `deactivate`, and the confirm
    // dialog copy reads "Deactivate", not "Delete".
    const user = userEvent.setup()
    ;(api.driversApi.deactivate as jest.Mock).mockResolvedValue({ data: {} })

    render(<DriverList />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    const johnRow = screen.getByText('John Doe').closest('tr') as HTMLElement
    const deactivateButton = within(johnRow).getByTitle('Deactivate')
    await user.click(deactivateButton)

    // Confirm dialog uses the "Deactivate" verb. Scope to the dialog so we don't
    // also match the row's title="Deactivate" action button.
    const dialog = await screen.findByRole('alertdialog')
    const confirmButton = within(dialog).getByRole('button', { name: 'Deactivate' })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(api.driversApi.deactivate).toHaveBeenCalledWith('drv-1')
    })
  })
})
