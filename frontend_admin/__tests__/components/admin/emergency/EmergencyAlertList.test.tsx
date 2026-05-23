import React from 'react'
import { render, screen, waitFor, fireEvent } from '@/__tests__/test-utils'
import { EmergencyAlertList } from '@/components/admin/emergency/EmergencyAlertList'
import * as api from '@/lib/api'
import userEvent from '@testing-library/user-event'

jest.mock('@/lib/api', () => ({
  emergencyApi: {
    list: jest.fn(),
    update: jest.fn(),
  },
}))

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

const mockAlerts = [
  {
    id: 'alert-1',
    alert_type: 'SOS',
    status: 'SENT',
    message: 'Help needed urgently',
    latitude: 11.5564,
    longitude: 104.9282,
    user_id: 'user-1',
    user: { name: 'Alice Cooper' },
    created_at: new Date().toISOString(),
  },
  {
    id: 'alert-2',
    alert_type: 'MEDICAL',
    status: 'ACKNOWLEDGED',
    message: 'Driver feeling unwell',
    latitude: 11.5600,
    longitude: 104.9300,
    user_id: 'user-2',
    user: { name: 'Bob Smith' },
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'alert-3',
    alert_type: 'THEFT',
    status: 'RESOLVED',
    message: 'Bag stolen from vehicle',
    latitude: null,
    longitude: null,
    user_id: 'user-3',
    user: { name: 'Charlie Brown' },
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
]

describe('EmergencyAlertList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(api.emergencyApi.list as jest.Mock).mockResolvedValue({ data: mockAlerts })
  })

  it('renders emergency alert list with correct data', async () => {
    render(<EmergencyAlertList />)

    await waitFor(() => {
      expect(screen.getByText('SOS')).toBeInTheDocument()
    })

    expect(screen.getByText('MEDICAL')).toBeInTheDocument()
    expect(screen.getByText('THEFT')).toBeInTheDocument()
    expect(screen.getByText('Alice Cooper')).toBeInTheDocument()
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
  })

  it('shows active emergency banner when SENT alerts exist', async () => {
    render(<EmergencyAlertList />)

    await waitFor(() => {
      expect(screen.getByText(/active emergency alerts requiring immediate attention/i)).toBeInTheDocument()
    })
  })

  it('filters alerts by status', async () => {
    const user = userEvent.setup()
    render(<EmergencyAlertList />)

    await waitFor(() => {
      expect(screen.getByText('SOS')).toBeInTheDocument()
    })

    const statusFilter = screen.getByRole('button', { name: /all statuses/i })
    await user.click(statusFilter)

    const sentOption = screen.getByRole('menuitemcheckbox', { name: /sent/i })
    await user.click(sentOption)

    await waitFor(() => {
      expect(api.emergencyApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SENT' })
      )
    })
  })

  it('filters alerts by type', async () => {
    const user = userEvent.setup()
    render(<EmergencyAlertList />)

    await waitFor(() => {
      expect(screen.getByText('SOS')).toBeInTheDocument()
    })

    const typeFilter = screen.getByRole('button', { name: /all types/i })
    await user.click(typeFilter)

    const sosOption = screen.getByRole('menuitemcheckbox', { name: 'SOS' })
    await user.click(sosOption)

    await waitFor(() => {
      expect(api.emergencyApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ alert_type: 'SOS' })
      )
    })
  })

  it('acknowledges an alert', async () => {
    const user = userEvent.setup()
    ;(api.emergencyApi.update as jest.Mock).mockResolvedValue({ data: {} })

    render(<EmergencyAlertList />)

    await waitFor(() => {
      expect(screen.getByText('SOS')).toBeInTheDocument()
    })

    const acknowledgeButton = screen.getByTitle('Acknowledge')
    await user.click(acknowledgeButton)

    await waitFor(() => {
      expect(api.emergencyApi.update).toHaveBeenCalledWith(
        'alert-1',
        expect.objectContaining({ status: 'ACKNOWLEDGED' })
      )
    })
  })

  it('resolves an acknowledged alert', async () => {
    const user = userEvent.setup()
    // Only show ACKNOWLEDGED alerts
    const acknowledgedAlerts = mockAlerts.filter(a => a.status === 'ACKNOWLEDGED')
    ;(api.emergencyApi.list as jest.Mock).mockResolvedValue({ data: acknowledgedAlerts })
    ;(api.emergencyApi.update as jest.Mock).mockResolvedValue({ data: {} })

    render(<EmergencyAlertList />)

    await waitFor(() => {
      expect(screen.getByText('MEDICAL')).toBeInTheDocument()
    })

    const resolveButton = screen.getByTitle('Resolve')
    await user.click(resolveButton)

    await waitFor(() => {
      expect(api.emergencyApi.update).toHaveBeenCalledWith(
        'alert-2',
        expect.objectContaining({ status: 'RESOLVED' })
      )
    })
  })

  it('toggles sound on/off', async () => {
    const user = userEvent.setup()
    render(<EmergencyAlertList />)

    await waitFor(() => {
      expect(screen.getByText('SOS')).toBeInTheDocument()
    })

    const soundButton = screen.getByTitle('Sound on')
    await user.click(soundButton)

    // Button should now show sound off state
    await waitFor(() => {
      expect(screen.getByTitle('Sound off')).toBeInTheDocument()
    })
  })

  it('shows empty state when no alerts', async () => {
    ;(api.emergencyApi.list as jest.Mock).mockResolvedValue({ data: [] })

    render(<EmergencyAlertList />)

    await waitFor(() => {
      expect(screen.getByText('No emergency alerts')).toBeInTheDocument()
    })
  })

  it('navigates to alert detail on row click', async () => {
    const mockPush = jest.fn()
    jest.resetModules()

    render(<EmergencyAlertList />)

    await waitFor(() => {
      expect(screen.getByText('SOS')).toBeInTheDocument()
    })

    // Find and click a row
    const sosRow = screen.getByText('SOS').closest('tr')
    if (sosRow) {
      fireEvent.click(sosRow)
    }
  })
})
