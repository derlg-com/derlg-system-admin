import React from 'react'
import { render, screen, waitFor } from '@/__tests__/test-utils'
import userEvent from '@testing-library/user-event'

import { TripList, type TripRow } from '@/components/admin/trips/TripList'
import * as api from '@/lib/api'

/**
 * Trip packages had no admin surface at all until recently — they could only be
 * created by the seed script or hand-written SQL.
 *
 * Two things are worth pinning here. The list must read the `{ data, meta }`
 * envelope rather than assuming an array (the customers list assumed an array and
 * crashed on load). And filters must be OMITTED when set to "all": the API runs
 * with `forbidNonWhitelisted`, so sending `isPublished=all` would 400 the whole
 * request instead of being ignored.
 */
jest.mock('@/lib/api', () => ({
  tripsApi: {
    list: jest.fn(),
    setPublished: jest.fn().mockResolvedValue({ data: {} }),
    remove: jest.fn().mockResolvedValue({ data: {} }),
    create: jest.fn(),
  },
  extractErrorMessage: (_e: unknown, fallback: string) => fallback,
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/admin/trips',
}))

jest.mock('@/components/admin/trips/TripFormDialog', () => ({
  TripFormDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="trip-form" /> : null,
}))

const TRIP: TripRow = {
  id: 'trip-1',
  title: 'Angkor Deep Dive',
  subtitle: 'Three temple days',
  category: 'temples',
  durationDays: 3,
  basePriceUsd: 249.99,
  maxCapacity: 12,
  coverImage: null,
  images: [],
  isPublished: false,
  itineraryCount: 4,
  guideCount: 2,
  reviewCount: 0,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
}

const tripsApi = api.tripsApi as jest.Mocked<typeof api.tripsApi>

function mockList(trips = [TRIP], total = trips.length) {
  tripsApi.list.mockResolvedValue({ data: { data: trips, meta: { total } } } as never)
}

describe('TripList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockList()
  })

  it('renders trips from the { data, meta } envelope', async () => {
    render(<TripList />)

    expect(await screen.findByText('Angkor Deep Dive')).toBeInTheDocument()
    expect(screen.getByText('Three temple days')).toBeInTheDocument()
  })

  it('shows the total from meta rather than the page length', async () => {
    mockList([TRIP], 42)
    render(<TripList />)

    // A paginated list must report the whole collection, not the current page.
    expect(await screen.findByText(/42 customer|42 trip|42/i)).toBeInTheDocument()
  })

  it('flags a trip with no English title, since publishing is blocked without one', async () => {
    mockList([{ ...TRIP, title: null }])
    render(<TripList />)

    expect(await screen.findByText(/no English title/i)).toBeInTheDocument()
  })

  it('renders draft and published states distinctly', async () => {
    mockList([TRIP, { ...TRIP, id: 'trip-2', isPublished: true }])
    render(<TripList />)

    expect(await screen.findByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('Published')).toBeInTheDocument()
  })

  it('omits filter params entirely while they are set to "all"', async () => {
    render(<TripList />)
    await waitFor(() => expect(tripsApi.list).toHaveBeenCalled())

    const params = tripsApi.list.mock.calls[0][0] as Record<string, unknown>
    // Sending `category=all` would be rejected by forbidNonWhitelisted.
    expect(params).not.toHaveProperty('category')
    expect(params).not.toHaveProperty('isPublished')
    expect(params).not.toHaveProperty('search')
    expect(params).toMatchObject({ page: 1, limit: 20 })
  })

  it('sends a trimmed search term once typed', async () => {
    render(<TripList />)
    await waitFor(() => expect(tripsApi.list).toHaveBeenCalled())

    const input = screen.getByPlaceholderText(/search trip titles/i)
    await userEvent.type(input, 'angkor')

    await waitFor(() => {
      const latest = tripsApi.list.mock.calls.at(-1)?.[0] as Record<string, unknown>
      expect(latest.search).toBe('angkor')
    })
  })

  it('toggles publish state from the row action', async () => {
    render(<TripList />)
    await screen.findByText('Angkor Deep Dive')

    await userEvent.click(screen.getByTitle('Publish'))

    await waitFor(() =>
      // The trip is a draft, so the action must request publication.
      expect(tripsApi.setPublished).toHaveBeenCalledWith('trip-1', true),
    )
  })

  it('offers Unpublish for an already published trip', async () => {
    mockList([{ ...TRIP, isPublished: true }])
    render(<TripList />)
    await screen.findByText('Angkor Deep Dive')

    await userEvent.click(screen.getByTitle('Unpublish'))

    await waitFor(() =>
      expect(tripsApi.setPublished).toHaveBeenCalledWith('trip-1', false),
    )
  })

  it('requires confirmation before deleting and explains the booking restriction', async () => {
    render(<TripList />)
    await screen.findByText('Angkor Deep Dive')

    await userEvent.click(screen.getByTitle('Delete'))

    // Deleting a booked trip answers 409; the dialog says so up front.
    expect(await screen.findByText(/cannot be deleted/i)).toBeInTheDocument()
    expect(tripsApi.remove).not.toHaveBeenCalled()
  })

  it('renders an empty state rather than a blank table', async () => {
    mockList([], 0)
    render(<TripList />)

    expect(await screen.findByText(/No trip packages yet/i)).toBeInTheDocument()
  })

  it('opens the create dialog from the header action', async () => {
    render(<TripList />)

    await userEvent.click(screen.getByRole('button', { name: /new trip/i }))

    expect(await screen.findByTestId('trip-form')).toBeInTheDocument()
  })
})
