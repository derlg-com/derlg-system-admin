import React from 'react'
import { render, screen, waitFor } from '@/__tests__/test-utils'
import userEvent from '@testing-library/user-event'

import {
  RefundPayoutQueue,
  type RefundRow,
} from '@/components/admin/payments/RefundPayoutQueue'
import * as api from '@/lib/api'

/**
 * The payout queue's rules come straight from the backend guards: a card refund
 * is settled by Stripe and answers PAY_METHOD_NOT_SUPPORTED, so it must be
 * read-only; an already-succeeded refund has moved the total and is done; and the
 * providerRefundId/reason are validated client-side to match CompleteRefundDto.
 *
 * `requireActual` keeps the real `unwrapList`.
 */
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api')
  return {
    ...actual,
    refundsApi: {
      list: jest.fn(),
      complete: jest.fn().mockResolvedValue({ data: {} }),
    },
  }
})

const refundsApi = api.refundsApi as jest.Mocked<typeof api.refundsApi>

const ABA_REFUND: RefundRow = {
  id: 'ref-1',
  amountUsd: '94.50',
  percentage: 50,
  reason: 'Cancelled 3 days before start',
  status: 'pending',
  providerRefundId: null,
  processedById: null,
  createdAt: '2026-08-20T00:00:00.000Z',
  payment: {
    id: 'pay-1',
    provider: 'aba',
    amountUsd: '189.00',
    refundedAmountUsd: '0',
    booking: { id: 'b-1', reference: 'DERLG-3003' },
    user: { id: 'u-1', fullName: 'WeChat Wendy', email: 'wendy@example.com' },
  },
}

const CARD_REFUND: RefundRow = {
  ...ABA_REFUND,
  id: 'ref-2',
  payment: {
    id: 'pay-2',
    provider: 'stripe',
    amountUsd: '120.00',
    refundedAmountUsd: '0',
    booking: { id: 'b-2', reference: 'DERLG-4004' },
    user: { id: 'u-2', fullName: 'Backpacker Ben', email: 'ben@example.com' },
  },
}

function mockRefunds(rows: RefundRow[] = [ABA_REFUND], total = rows.length) {
  refundsApi.list.mockResolvedValue({
    data: { data: rows, meta: { page: 1, limit: 20, total, totalPages: Math.ceil(total / 20) } },
  } as never)
}

describe('RefundPayoutQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRefunds()
  })

  it('defaults to the pending filter, since that is the work queue', async () => {
    render(<RefundPayoutQueue canWrite />)
    await waitFor(() => expect(refundsApi.list).toHaveBeenCalled())

    const params = refundsApi.list.mock.calls[0][0] as Record<string, unknown>
    expect(params).toMatchObject({ status: 'pending', page: 1, limit: 20 })
  })

  it('renders a refund with its amount, tier and provider', async () => {
    render(<RefundPayoutQueue canWrite />)

    expect(await screen.findByText('DERLG-3003')).toBeInTheDocument()
    expect(screen.getByText('WeChat Wendy')).toBeInTheDocument()
    expect(screen.getByText('$94.50')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('Cancelled 3 days before start')).toBeInTheDocument()
    expect(screen.getByText('aba')).toBeInTheDocument()
  })

  it('offers "Mark paid out" for a pending ABA refund when the operator can write', async () => {
    render(<RefundPayoutQueue canWrite />)
    await screen.findByText('DERLG-3003')

    expect(screen.getByRole('button', { name: /mark paid out/i })).toBeInTheDocument()
  })

  it('HIDES "Mark paid out" from a support agent (canWrite=false)', async () => {
    render(<RefundPayoutQueue canWrite={false} />)
    await screen.findByText('DERLG-3003')

    expect(
      screen.queryByRole('button', { name: /mark paid out/i }),
    ).not.toBeInTheDocument()
  })

  it('renders a card refund read-only, since Stripe settles it automatically', async () => {
    mockRefunds([CARD_REFUND])
    render(<RefundPayoutQueue canWrite />)
    await screen.findByText('DERLG-4004')

    expect(screen.getByText(/Auto — Stripe/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /mark paid out/i }),
    ).not.toBeInTheDocument()
  })

  it('shows an already-paid-out refund as read-only', async () => {
    mockRefunds([{ ...ABA_REFUND, status: 'succeeded', providerRefundId: 'TRX-777' }])
    render(<RefundPayoutQueue canWrite />)
    await screen.findByText('DERLG-3003')

    expect(screen.getByText(/paid out/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /mark paid out/i }),
    ).not.toBeInTheDocument()
  })

  it('blocks submission when the reference or reason is invalid', async () => {
    render(<RefundPayoutQueue canWrite />)
    await screen.findByText('DERLG-3003')
    await userEvent.click(screen.getByRole('button', { name: /mark paid out/i }))

    await userEvent.type(screen.getByLabelText('Bank transfer reference'), 'ab')
    await userEvent.type(screen.getByLabelText('Reason'), 'too short')
    await userEvent.click(screen.getByRole('button', { name: /record payout/i }))

    expect(
      await screen.findByText(/bank transfer reference \(at least 4 characters\)/i),
    ).toBeInTheDocument()
    expect(refundsApi.complete).not.toHaveBeenCalled()
  })

  it('records the payout with the reference and reason once both are valid', async () => {
    render(<RefundPayoutQueue canWrite />)
    await screen.findByText('DERLG-3003')
    await userEvent.click(screen.getByRole('button', { name: /mark paid out/i }))

    await userEvent.type(screen.getByLabelText('Bank transfer reference'), 'ABA-RCPT-55210')
    await userEvent.type(
      screen.getByLabelText('Reason'),
      'Transferred to customer account on 2026-08-21',
    )
    await userEvent.click(screen.getByRole('button', { name: /record payout/i }))

    await waitFor(() =>
      expect(refundsApi.complete).toHaveBeenCalledWith(
        'ref-1',
        'ABA-RCPT-55210',
        'Transferred to customer account on 2026-08-21',
      ),
    )
  })
})
