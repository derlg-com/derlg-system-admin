import React from 'react'
import { render, screen, waitFor } from '@/__tests__/test-utils'
import userEvent from '@testing-library/user-event'

import { PaymentList, type PaymentRow } from '@/components/admin/payments/PaymentList'
import * as api from '@/lib/api'

/**
 * The ledger is read-only, so the pins here are about reading the backend shape
 * correctly rather than mutations.
 *
 * `requireActual` keeps the real `unwrapList`: the component pipes the list
 * response through `paymentsApi.list(params).then(unwrapList<PaymentRow>)`, and a
 * stub would turn `.then(unwrapList)` into `.then(undefined)`.
 *
 * Two shape facts matter: amounts are Prisma `Decimal` strings that must be
 * coerced before `toFixed`, and filters must be OMITTED (not sent empty) because
 * `forbidNonWhitelisted` 400s an unexpected `provider=`.
 */
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api')
  return {
    ...actual,
    paymentsApi: {
      list: jest.fn(),
      getAbaExceptions: jest.fn(),
      settleManually: jest.fn(),
    },
  }
})

const paymentsApi = api.paymentsApi as jest.Mocked<typeof api.paymentsApi>

const PAYMENT: PaymentRow = {
  id: 'pay-1',
  provider: 'aba',
  status: 'succeeded',
  amountUsd: '189.00',
  refundedAmountUsd: '0',
  currency: 'usd',
  providerPaymentId: 'aba_178220228091798',
  stripePaymentIntentId: null,
  qrExpiresAt: null,
  paidAt: '2026-08-02T10:00:00.000Z',
  createdAt: '2026-08-01T00:00:00.000Z',
  booking: { id: 'b-1', reference: 'DERLG-1001', status: 'confirmed', totalUsd: '189.00' },
  user: { id: 'u-1', fullName: 'WeChat Wendy', email: 'wendy@example.com' },
  refunds: [],
}

function mockList(rows: PaymentRow[] = [PAYMENT], total = rows.length) {
  paymentsApi.list.mockResolvedValue({
    data: { data: rows, meta: { page: 1, limit: 20, total, totalPages: Math.ceil(total / 20) } },
  } as never)
}

describe('PaymentList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockList()
  })

  it('renders payments from the { data, meta } envelope', async () => {
    render(<PaymentList />)

    expect(await screen.findByText('DERLG-1001')).toBeInTheDocument()
    expect(screen.getByText('WeChat Wendy')).toBeInTheDocument()
    expect(screen.getByText('$189.00')).toBeInTheDocument()
  })

  it('coerces Decimal-string amounts before formatting', async () => {
    mockList([{ ...PAYMENT, amountUsd: '100', refundedAmountUsd: '25.5' }])
    render(<PaymentList />)

    // Number('100').toFixed(2) and Number('25.5').toFixed(2) — string in, money out.
    expect(await screen.findByText('$100.00')).toBeInTheDocument()
    expect(screen.getByText('$25.50')).toBeInTheDocument()
  })

  it('shows the settlement id, falling back to the Stripe intent id', async () => {
    mockList([
      PAYMENT,
      {
        ...PAYMENT,
        id: 'pay-2',
        provider: 'stripe',
        providerPaymentId: null,
        stripePaymentIntentId: 'pi_stripe_123',
        booking: { id: 'b-2', reference: 'DERLG-1002', status: 'confirmed', totalUsd: '50.00' },
      },
    ])
    render(<PaymentList />)

    expect(await screen.findByText('aba_178220228091798')).toBeInTheDocument()
    expect(screen.getByText('pi_stripe_123')).toBeInTheDocument()
  })

  it('omits filter params entirely while they are unset', async () => {
    render(<PaymentList />)
    await waitFor(() => expect(paymentsApi.list).toHaveBeenCalled())

    const params = paymentsApi.list.mock.calls[0][0] as Record<string, unknown>
    expect(params).not.toHaveProperty('provider')
    expect(params).not.toHaveProperty('status')
    expect(params).not.toHaveProperty('search')
    expect(params).toMatchObject({ page: 1, limit: 20 })
  })

  it('sends a trimmed search term once typed', async () => {
    render(<PaymentList />)
    await waitFor(() => expect(paymentsApi.list).toHaveBeenCalled())

    await userEvent.type(
      screen.getByPlaceholderText(/search booking reference or settlement id/i),
      'DERLG-1001',
    )

    await waitFor(() => {
      const latest = paymentsApi.list.mock.calls.at(-1)?.[0] as Record<string, unknown>
      expect(latest.search).toBe('DERLG-1001')
    })
  })

  it('drives pagination from meta.total rather than the page length', async () => {
    mockList([PAYMENT], 42)
    render(<PaymentList />)
    await screen.findByText('DERLG-1001')

    // One row on the page, but meta says 42 → three pages.
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('renders an empty state rather than a blank table', async () => {
    mockList([], 0)
    render(<PaymentList />)

    expect(await screen.findByText(/No payments match the current filters/i)).toBeInTheDocument()
  })
})
