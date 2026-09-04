import React from 'react'
import { render, screen, waitFor } from '@/__tests__/test-utils'
import userEvent from '@testing-library/user-event'

import {
  AbaExceptionQueue,
  type AbaException,
} from '@/components/admin/payments/AbaExceptionQueue'
import * as api from '@/lib/api'

/**
 * The exception queue is the reason the screen exists, so the pins are: it reads
 * the BARE ARRAY the endpoint returns (not a paginated envelope), it hides the
 * write action from support agents rather than disabling it, and it validates the
 * ABA transaction id and reason client-side — the backend 400s otherwise, and an
 * inline message beats a round-trip toast.
 *
 * `requireActual` keeps the real `unwrapList`, which is what turns the bare array
 * into `{ items, meta }`.
 */
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api')
  return {
    ...actual,
    paymentsApi: {
      list: jest.fn(),
      getAbaExceptions: jest.fn(),
      settleManually: jest.fn().mockResolvedValue({ data: {} }),
    },
  }
})

const paymentsApi = api.paymentsApi as jest.Mocked<typeof api.paymentsApi>

const EXCEPTION: AbaException = {
  id: 'pay-9',
  amountUsd: '75.00',
  qrExpiresAt: '2026-08-30T00:00:00.000Z',
  createdAt: '2026-08-29T00:00:00.000Z',
  booking: { id: 'b-9', reference: 'DERLG-2002', status: 'pending' },
  user: { id: 'u-9', fullName: 'Backpacker Ben', email: 'ben@example.com' },
}

// getAbaExceptions returns a bare array (after the envelope interceptor), so the
// mock resolves `{ data: [...] }`, not `{ data: { data, meta } }`.
function mockExceptions(rows: AbaException[] = [EXCEPTION]) {
  paymentsApi.getAbaExceptions.mockResolvedValue({ data: rows } as never)
}

describe('AbaExceptionQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExceptions()
  })

  it('renders exceptions from the bare array the endpoint returns', async () => {
    render(<AbaExceptionQueue canWrite />)

    expect(await screen.findByText('DERLG-2002')).toBeInTheDocument()
    expect(screen.getByText('Backpacker Ben')).toBeInTheDocument()
    expect(screen.getByText('$75.00')).toBeInTheDocument()
  })

  it('announces the outstanding count to assistive tech', async () => {
    render(<AbaExceptionQueue canWrite />)

    expect(
      screen.getByRole('heading', { name: /ABA payment exceptions/i }),
    ).toBeInTheDocument()
    // A polite status region carries the count in words for a screen reader.
    expect(
      await screen.findByText(/1 expired ABA payment awaiting manual settlement/i),
    ).toBeInTheDocument()
  })

  it('HIDES the settle action from a support agent (canWrite=false)', async () => {
    render(<AbaExceptionQueue canWrite={false} />)
    await screen.findByText('DERLG-2002')

    expect(
      screen.queryByRole('button', { name: /settle manually/i }),
    ).not.toBeInTheDocument()
  })

  it('opens a dialog that makes the consequence explicit', async () => {
    render(<AbaExceptionQueue canWrite />)
    await screen.findByText('DERLG-2002')

    await userEvent.click(screen.getByRole('button', { name: /settle manually/i }))

    expect(
      await screen.findByText(/Settling confirms this booking as paid/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/verify the amount below against the ABA statement/i)).toBeInTheDocument()
  })

  it('blocks submission when the transaction id or reason is invalid', async () => {
    render(<AbaExceptionQueue canWrite />)
    await screen.findByText('DERLG-2002')
    await userEvent.click(screen.getByRole('button', { name: /settle manually/i }))

    await userEvent.type(screen.getByLabelText('ABA transaction id'), 'ab')
    await userEvent.type(screen.getByLabelText('Reason'), 'too short')
    await userEvent.click(screen.getByRole('button', { name: /settle payment/i }))

    expect(
      await screen.findByText(/numeric ABA transaction id from the credit alert/i),
    ).toBeInTheDocument()
    // The request never leaves the browser.
    expect(paymentsApi.settleManually).not.toHaveBeenCalled()
  })

  it('settles with the transaction id and reason once both are valid', async () => {
    render(<AbaExceptionQueue canWrite />)
    await screen.findByText('DERLG-2002')
    await userEvent.click(screen.getByRole('button', { name: /settle manually/i }))

    await userEvent.type(screen.getByLabelText('ABA transaction id'), '178220228091798')
    await userEvent.type(
      screen.getByLabelText('Reason'),
      'Verified against ABA statement line 2026-08-30',
    )
    await userEvent.click(screen.getByRole('button', { name: /settle payment/i }))

    await waitFor(() =>
      expect(paymentsApi.settleManually).toHaveBeenCalledWith(
        'pay-9',
        '178220228091798',
        'Verified against ABA statement line 2026-08-30',
      ),
    )
  })
})
