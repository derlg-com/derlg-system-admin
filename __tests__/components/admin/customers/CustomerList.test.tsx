import React from 'react'
import { render, screen, waitFor, within } from '@/__tests__/test-utils'
import userEvent from '@testing-library/user-event'

import { CustomerList, type Customer } from '@/components/admin/customers/CustomerList'
import * as api from '@/lib/api'

/**
 * This list previously read snake_case fields the API never returns (`name`,
 * `loyalty_points`, `created_at`) and called `.filter()` on the `{ data, meta }`
 * envelope as though it were an array — which threw, so the page did not render at
 * all. The first two tests exist to stop that recurring.
 *
 * The suspend dialog is the other focus: the API requires a reason of at least 3
 * characters, which it records in the audit log, so the UI must not allow a
 * reasonless suspension.
 */
jest.mock('@/lib/api', () => ({
  customersApi: {
    list: jest.fn(),
    setStatus: jest.fn().mockResolvedValue({
      data: { status: 'suspended', clearedSessionKeys: 2 },
    }),
    update: jest.fn().mockResolvedValue({ data: {} }),
    setRole: jest.fn().mockResolvedValue({ data: {} }),
  },
  extractErrorMessage: (_e: unknown, fallback: string) => fallback,
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/admin/customers',
}))

// The edit dialog has its own suite; stub it so this one stays on the list.
jest.mock('@/components/admin/customers/CustomerEditDialog', () => ({
  CustomerEditDialog: ({ customer }: { customer: unknown }) =>
    customer ? <div data-testid="edit-dialog" /> : null,
}))

const CUSTOMER: Customer = {
  id: 'cust-1',
  email: 'wendy@example.com',
  fullName: 'WeChat Wendy',
  phone: '+855 12 345 678',
  avatarUrl: null,
  loyaltyPoints: 250,
  isStudentVerified: false,
  role: 'user',
  status: 'active',
  bookingCount: 6,
  reviewCount: 2,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

const customersApi = api.customersApi as jest.Mocked<typeof api.customersApi>

function mockList(rows = [CUSTOMER], total = rows.length) {
  customersApi.list.mockResolvedValue({
    data: { data: rows, meta: { total } },
  } as never)
}

describe('CustomerList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockList()
  })

  it('reads camelCase fields from the envelope', async () => {
    render(<CustomerList />)

    expect(await screen.findByText('WeChat Wendy')).toBeInTheDocument()
    expect(screen.getByText('wendy@example.com')).toBeInTheDocument()
    // `loyaltyPoints`, not `loyalty_points`.
    expect(screen.getByText('250')).toBeInTheDocument()
  })

  it('does not crash when the response is the { data, meta } object', async () => {
    render(<CustomerList />)

    // The old code called .filter() on this object and threw a TypeError.
    await waitFor(() => expect(customersApi.list).toHaveBeenCalled())
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument()
  })

  it('renders each status distinctly', async () => {
    mockList([
      CUSTOMER,
      { ...CUSTOMER, id: 'c2', email: 'b@x.com', status: 'suspended' },
      { ...CUSTOMER, id: 'c3', email: 'c@x.com', status: 'inactive' },
    ])
    render(<CustomerList />)

    expect(await screen.findByText('active')).toBeInTheDocument()
    expect(screen.getByText('suspended')).toBeInTheDocument()
    expect(screen.getByText('inactive')).toBeInTheDocument()
  })

  it('omits the status param while the filter is "all"', async () => {
    render(<CustomerList />)
    await waitFor(() => expect(customersApi.list).toHaveBeenCalled())

    const params = customersApi.list.mock.calls[0][0] as Record<string, unknown>
    expect(params).not.toHaveProperty('status')
    expect(params).toMatchObject({ page: 1, limit: 20 })
  })

  it('searches server-side rather than filtering the current page', async () => {
    render(<CustomerList />)
    await waitFor(() => expect(customersApi.list).toHaveBeenCalled())

    await userEvent.type(screen.getByPlaceholderText(/search by name/i), 'wendy')

    await waitFor(() => {
      const latest = customersApi.list.mock.calls.at(-1)?.[0] as Record<string, unknown>
      expect(latest.search).toBe('wendy')
    })
  })

  it('requires a reason before a suspension can be submitted', async () => {
    render(<CustomerList />)
    await screen.findByText('WeChat Wendy')

    await userEvent.click(screen.getByTitle('Suspend'))

    const dialog = (await screen.findByText('Suspend Customer')).closest(
      '.modal',
    ) as HTMLElement
    const confirm = within(dialog).getByRole('button', { name: /^suspend$/i })
    // The API rejects a reason under 3 characters, so the control stays disabled.
    expect(confirm).toBeDisabled()
    expect(customersApi.setStatus).not.toHaveBeenCalled()
  })

  it('submits the reason with the status change once one is given', async () => {
    render(<CustomerList />)
    await screen.findByText('WeChat Wendy')

    await userEvent.click(screen.getByTitle('Suspend'))
    const dialog = (await screen.findByText('Suspend Customer')).closest(
      '.modal',
    ) as HTMLElement
    await userEvent.type(
      within(dialog).getByPlaceholderText(/chargeback/i),
      'Chargeback fraud',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: /^suspend$/i }))

    await waitFor(() =>
      expect(customersApi.setStatus).toHaveBeenCalledWith(
        'cust-1',
        'suspended',
        'Chargeback fraud',
      ),
    )
  })

  it('offers reactivation for a suspended customer', async () => {
    mockList([{ ...CUSTOMER, status: 'suspended' }])
    render(<CustomerList />)
    await screen.findByText('WeChat Wendy')

    await userEvent.click(screen.getByTitle('Reactivate'))
    const dialog = (await screen.findByText('Reactivate Customer')).closest(
      '.modal',
    ) as HTMLElement
    await userEvent.type(
      within(dialog).getByPlaceholderText(/investigation/i),
      'cleared',
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: /^reactivate$/i }),
    )

    await waitFor(() =>
      expect(customersApi.setStatus).toHaveBeenCalledWith('cust-1', 'active', 'cleared'),
    )
  })

  it('warns that suspension signs the customer out everywhere', async () => {
    render(<CustomerList />)
    await screen.findByText('WeChat Wendy')

    await userEvent.click(screen.getByTitle('Suspend'))

    // Consequences stated before the fact: this terminates live sessions.
    expect(await screen.findByText(/signed\s*out of every device/i)).toBeInTheDocument()
    expect(screen.getByText(/not cancelled/i)).toBeInTheDocument()
  })

  it('opens the edit dialog from the row action', async () => {
    render(<CustomerList />)
    await screen.findByText('WeChat Wendy')

    await userEvent.click(screen.getByTitle('Edit'))

    expect(await screen.findByTestId('edit-dialog')).toBeInTheDocument()
  })
})
