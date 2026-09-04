import React from 'react'
import { render, screen, waitFor, fireEvent } from '@/__tests__/test-utils'
import { EmergencyAlertList } from '@/components/admin/emergency/EmergencyAlertList'
import * as api from '@/lib/api'
import userEvent from '@testing-library/user-event'

// `requireActual` keeps the real `unwrapList`: the component pipes the list
// through `emergencyApi.list(...).then((r) => unwrapList<EmergencyAlert>(r).items)`,
// so a stub that dropped it would throw "unwrapList is not a function".
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api')
  return {
    ...actual,
    emergencyApi: {
      list: jest.fn(),
      update: jest.fn(),
    },
  }
})

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  usePathname: () => '/admin/emergency',
}))

jest.mock('@/store/adminStore', () => ({
  useNotificationStore: () => ({
    addNotification: jest.fn(),
  }),
}))

/**
 * Shapes a mocked `list()` result the way the axios envelope interceptor leaves
 * it: `response.data` is the `{ data, meta }` page object, which `unwrapList`
 * normalises to `{ items, meta }`.
 */
function paginated<T>(items: T[]) {
  return {
    data: {
      data: items,
      meta: { page: 1, limit: 20, total: items.length, totalPages: 1 },
    },
  }
}

// camelCase fields matching the admin API's EmergencyAlert shape. Enum values are
// lowercase: EmergencyAlertType (sos|medical|theft|lost) and EmergencyAlertStatus
// (triggered|acknowledged|resolved|cancelled). Customer name is `user.fullName`.
const mockAlerts = [
  {
    id: 'alert-1',
    alertType: 'sos',
    status: 'triggered',
    message: 'Help needed urgently',
    latitude: 11.5564,
    longitude: 104.9282,
    userId: 'user-1',
    user: { fullName: 'Alice Cooper' },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'alert-2',
    alertType: 'medical',
    status: 'acknowledged',
    message: 'Driver feeling unwell',
    latitude: 11.56,
    longitude: 104.93,
    userId: 'user-2',
    user: { fullName: 'Bob Smith' },
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'alert-3',
    alertType: 'theft',
    status: 'resolved',
    message: 'Bag stolen from vehicle',
    latitude: null,
    longitude: null,
    userId: 'user-3',
    user: { fullName: 'Charlie Brown' },
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
]

describe('EmergencyAlertList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(api.emergencyApi.list as jest.Mock).mockResolvedValue(paginated(mockAlerts))
  })

  it('renders emergency alert list with correct data', async () => {
    render(<EmergencyAlertList />)

    // The Type column renders the raw lowercase `alertType`.
    await waitFor(() => {
      expect(screen.getByText('sos')).toBeInTheDocument()
    })

    expect(screen.getByText('medical')).toBeInTheDocument()
    expect(screen.getByText('theft')).toBeInTheDocument()
    expect(screen.getByText('Alice Cooper')).toBeInTheDocument()
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
  })

  it('shows active emergency banner when triggered alerts exist', async () => {
    render(<EmergencyAlertList />)

    await waitFor(() => {
      expect(screen.getByText(/active emergency alerts requiring immediate attention/i)).toBeInTheDocument()
    })
  })

  it('filters alerts by status', async () => {
    const user = userEvent.setup()
    render(<EmergencyAlertList />)

    await waitFor(() => {
      expect(screen.getByText('sos')).toBeInTheDocument()
    })

    const statusFilter = screen.getByRole('button', { name: /all statuses/i })
    await user.click(statusFilter)

    // Status option label is "Triggered (Open)"; the value sent is the lowercase
    // EmergencyAlertStatus enum member.
    const triggeredOption = screen.getByRole('menuitemcheckbox', { name: /triggered/i })
    await user.click(triggeredOption)

    await waitFor(() => {
      expect(api.emergencyApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'triggered' })
      )
    })
  })

  it('filters alerts by type', async () => {
    const user = userEvent.setup()
    render(<EmergencyAlertList />)

    await waitFor(() => {
      expect(screen.getByText('sos')).toBeInTheDocument()
    })

    const typeFilter = screen.getByRole('button', { name: /all types/i })
    await user.click(typeFilter)

    const sosOption = screen.getByRole('menuitemcheckbox', { name: 'SOS' })
    await user.click(sosOption)

    // alert_type is sent as the lowercase EmergencyAlertType enum member.
    await waitFor(() => {
      expect(api.emergencyApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ alert_type: 'sos' })
      )
    })
  })

  it('acknowledges an alert', async () => {
    const user = userEvent.setup()
    ;(api.emergencyApi.update as jest.Mock).mockResolvedValue({ data: {} })

    render(<EmergencyAlertList />)

    await waitFor(() => {
      expect(screen.getByText('sos')).toBeInTheDocument()
    })

    const acknowledgeButton = screen.getByTitle('Acknowledge')
    await user.click(acknowledgeButton)

    // PATCH body uses the lowercase EmergencyAlertStatus the controller branches on.
    await waitFor(() => {
      expect(api.emergencyApi.update).toHaveBeenCalledWith(
        'alert-1',
        expect.objectContaining({ status: 'acknowledged' })
      )
    })
  })

  it('resolves an acknowledged alert', async () => {
    const user = userEvent.setup()
    // Only show acknowledged alerts
    const acknowledgedAlerts = mockAlerts.filter((a) => a.status === 'acknowledged')
    ;(api.emergencyApi.list as jest.Mock).mockResolvedValue(paginated(acknowledgedAlerts))
    ;(api.emergencyApi.update as jest.Mock).mockResolvedValue({ data: {} })

    render(<EmergencyAlertList />)

    await waitFor(() => {
      expect(screen.getByText('medical')).toBeInTheDocument()
    })

    const resolveButton = screen.getByTitle('Resolve')
    await user.click(resolveButton)

    await waitFor(() => {
      expect(api.emergencyApi.update).toHaveBeenCalledWith(
        'alert-2',
        expect.objectContaining({ status: 'resolved' })
      )
    })
  })

  it('toggles sound on/off', async () => {
    const user = userEvent.setup()
    render(<EmergencyAlertList />)

    await waitFor(() => {
      expect(screen.getByText('sos')).toBeInTheDocument()
    })

    const soundButton = screen.getByTitle('Sound on')
    await user.click(soundButton)

    // Button should now show sound off state
    await waitFor(() => {
      expect(screen.getByTitle('Sound off')).toBeInTheDocument()
    })
  })

  it('shows empty state when no alerts', async () => {
    ;(api.emergencyApi.list as jest.Mock).mockResolvedValue(paginated([]))

    render(<EmergencyAlertList />)

    await waitFor(() => {
      expect(screen.getByText('No emergency alerts')).toBeInTheDocument()
    })
  })

  it('navigates to alert detail on row click', async () => {
    render(<EmergencyAlertList />)

    await waitFor(() => {
      expect(screen.getByText('sos')).toBeInTheDocument()
    })

    // Find and click a row
    const sosRow = screen.getByText('sos').closest('tr')
    if (sosRow) {
      fireEvent.click(sosRow)
    }
  })
})
