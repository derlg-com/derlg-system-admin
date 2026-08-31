import React from 'react'
import { render, screen, waitFor } from '@/__tests__/test-utils'
import userEvent from '@testing-library/user-event'

import { CustomerEditDialog } from '@/components/admin/customers/CustomerEditDialog'
import type { Customer } from '@/components/admin/customers/CustomerList'
import * as api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'

/**
 * The role control is the security-relevant part.
 *
 * It is hidden rather than disabled for anyone below SUPER_ADMIN, matching the
 * sidebar's convention — there is no point offering a control that would answer
 * 403. The API enforces the same restriction independently, so this is defence in
 * depth rather than the only guard.
 *
 * Email is also absent by design: it is the login identity, and the API rejects
 * attempts to change it here.
 */
jest.mock('@/lib/api', () => ({
  customersApi: {
    update: jest.fn().mockResolvedValue({ data: {} }),
    setRole: jest.fn().mockResolvedValue({ data: {} }),
  },
  extractErrorMessage: (_e: unknown, fallback: string) => fallback,
}))

jest.mock('@/hooks/usePermission', () => ({
  usePermission: jest.fn(),
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
const mockedUsePermission = usePermission as jest.MockedFunction<typeof usePermission>

function asRole(isSuperAdmin: boolean) {
  mockedUsePermission.mockReturnValue({ isSuperAdmin } as never)
}

function renderDialog(customer: Customer | null = CUSTOMER) {
  return render(
    <CustomerEditDialog customer={customer} onClose={jest.fn()} onSaved={jest.fn()} />,
  )
}

describe('CustomerEditDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    asRole(true)
  })

  it('renders nothing when no customer is selected', () => {
    asRole(true)
    const { container } = renderDialog(null)

    expect(container).toBeEmptyDOMElement()
  })

  it('prefills the editable profile fields', () => {
    renderDialog()

    expect(screen.getByDisplayValue('WeChat Wendy')).toBeInTheDocument()
    expect(screen.getByDisplayValue('+855 12 345 678')).toBeInTheDocument()
  })

  it('shows the email read-only and explains why', () => {
    renderDialog()

    // Present as context, but not as an input: it is the login identity.
    expect(screen.getByText(/wendy@example.com/)).toBeInTheDocument()
    expect(screen.getByText(/cannot be changed/i)).toBeInTheDocument()
    expect(screen.queryByDisplayValue('wendy@example.com')).not.toBeInTheDocument()
  })

  it('HIDES the role control from a non-super-admin', () => {
    asRole(false)
    renderDialog()

    // Hidden, not disabled — the sidebar convention.
    expect(screen.queryByText('Role')).not.toBeInTheDocument()
  })

  it('shows the role control to a super admin', () => {
    asRole(true)
    renderDialog()

    expect(screen.getByText('Role')).toBeInTheDocument()
  })

  it('offers only non-admin roles', () => {
    renderDialog()

    const options = screen
      .getAllByRole('option')
      .map((o) => (o as HTMLOptionElement).value)

    // Granting an admin role needs a matching admin_users record, which is what
    // the Admin Users screen creates; the API refuses admin roles on this route.
    expect(options).toContain('user')
    expect(options).toContain('guide')
    expect(options).toContain('student')
    expect(options).not.toContain('super_admin')
    expect(options).not.toContain('operations_manager')
  })

  it('surfaces an admin role held by the target as a "(current)" option', () => {
    renderDialog({ ...CUSTOMER, role: 'support_agent' })

    // The select must show the truth rather than silently misrepresenting the
    // account as a plain user.
    expect(screen.getByText(/support_agent \(current\)/i)).toBeInTheDocument()
  })

  it('changes the role immediately, separately from the field save', async () => {
    renderDialog()

    // Two selects exist (preferred language and role); the role control is the
    // last one rendered.
    const roleSelect = screen.getAllByRole('combobox').at(-1) as HTMLSelectElement
    await userEvent.selectOptions(roleSelect, 'guide')

    await waitFor(() =>
      expect(customersApi.setRole).toHaveBeenCalledWith('cust-1', 'guide'),
    )
    // The role change must not be bundled into the profile PATCH.
    expect(customersApi.update).not.toHaveBeenCalled()
  })

  it('sends only non-empty fields so a blank input cannot wipe stored data', async () => {
    renderDialog({ ...CUSTOMER, fullName: 'WeChat Wendy', phone: null })

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(customersApi.update).toHaveBeenCalled())
    const patch = customersApi.update.mock.calls[0][1] as Record<string, unknown>
    expect(patch).toHaveProperty('fullName', 'WeChat Wendy')
    // Phone was empty, so it must be omitted rather than sent as ''.
    expect(patch).not.toHaveProperty('phone')
  })

  it('rejects an over-long name before calling the API', async () => {
    renderDialog()

    const name = screen.getByDisplayValue('WeChat Wendy')
    await userEvent.clear(name)
    await userEvent.type(name, 'x'.repeat(130))
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    // Zod mirrors the DTO's @MaxLength(120), so the request never leaves.
    await waitFor(() => expect(customersApi.update).not.toHaveBeenCalled())
  })
})
