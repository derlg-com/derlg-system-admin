import axios, { AxiosError, AxiosInstance } from 'axios'

/**
 * API client for the DerLg admin panel.
 *
 * Talks to the main NestJS backend (`backend/`), not a separate admin service.
 * The admin API was merged into it, so every route below is served by the same
 * app that serves the public site — one database, one auth model, one client.
 *
 * Default port is the backend's dev port. Override with NEXT_PUBLIC_API_URL.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/v1`
  : 'http://localhost:4007/v1'

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  // Sends the httpOnly `derlg_refresh` cookie so /auth/refresh works.
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

export const ACCESS_TOKEN_STORAGE_KEY = 'admin_access_token'

let isRefreshing = false
let pendingRequests: Array<() => void> = []

let onTokenRefresh: ((token: string, user?: unknown) => void) | null = null

export function setTokenRefreshCallback(
  cb: (token: string, user?: unknown) => void,
) {
  onTokenRefresh = cb
}

/**
 * Unwraps the backend's response envelope.
 *
 * `TransformInterceptor` wraps every success as `{ success: true, data }`, so
 * callers receive `data` directly. Errors keep their envelope and are surfaced
 * through the rejection path below.
 */
api.interceptors.response.use((response) => {
  const body = response.data
  if (
    body &&
    typeof body === 'object' &&
    'success' in body &&
    'data' in body &&
    (body as { success: unknown }).success !== false
  ) {
    response.data = (body as { data: unknown }).data
  }
  return response
})

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/** Human-readable message from `AllExceptionsFilter`'s error shape. */
export function extractErrorMessage(error: unknown, fallback = 'Request failed'): string {
  const axiosError = error as AxiosError<{
    message?: string | string[]
    error?: { message?: string | string[]; code?: string }
  }>
  const body = axiosError?.response?.data
  const raw = body?.error?.message ?? body?.message
  if (Array.isArray(raw)) return raw.join(', ')
  if (typeof raw === 'string' && raw.trim() !== '') return raw
  return fallback
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined

    if (error.response?.status === 401 && original && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingRequests.push(() => resolve(api(original)))
        })
      }
      original._retry = true
      isRefreshing = true
      try {
        // Plain axios, not `api`: the instance's own 401 handler would recurse.
        const res = await axios.post(
          `${BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        )
        // /auth/refresh now returns { accessToken, user }. It previously
        // returned only accessToken, so this destructure silently yielded
        // undefined and the auth store lost the user on every refresh.
        const payload = (res.data?.data ?? res.data) as {
          accessToken: string
          user?: unknown
        }
        localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, payload.accessToken)
        onTokenRefresh?.(payload.accessToken, payload.user)

        pendingRequests.forEach((cb) => cb())
        pendingRequests = []
        isRefreshing = false

        original.headers.Authorization = `Bearer ${payload.accessToken}`
        return api(original)
      } catch {
        isRefreshing = false
        pendingRequests = []
        localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
        onTokenRefresh?.('', null)
        if (typeof window !== 'undefined') window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  },
)

export default api

// ---------------------------------------------------------------------------
// Paginated responses
// ---------------------------------------------------------------------------

/** Pagination metadata returned alongside every admin list. */
export interface PageMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

/** Shape of a list endpoint's payload after the envelope interceptor runs. */
export interface Paginated<T> {
  data: T[]
  meta: PageMeta
}

const EMPTY_META: PageMeta = { page: 1, limit: 0, total: 0, totalPages: 0 }

/**
 * Normalises a list response into `{ items, meta }`.
 *
 * Admin list services return `{ data, meta }`, which the response interceptor
 * above unwraps exactly one level — so `response.data` is the `{ data, meta }`
 * object, not the array. Components that did
 * `list().then(r => r.data)` and then called `.filter()` on the result were
 * calling it on that object, which threw
 * `(intermediate value).filter is not a function` and blanked the page.
 *
 * A few endpoints (admin users, upcoming maintenance) legitimately return a bare
 * array, so both shapes are accepted rather than requiring every caller to know
 * which is which.
 *
 * @example
 * const { data } = useQuery({
 *   queryKey: ['admin-drivers'],
 *   queryFn: () => driversApi.list().then(unwrapList<Driver>),
 * })
 * // data.items is always an array; data.meta is always present.
 */
export function unwrapList<T>(response: { data: unknown }): {
  items: T[]
  meta: PageMeta
} {
  const body = response.data

  if (Array.isArray(body)) {
    return {
      items: body as T[],
      meta: { ...EMPTY_META, limit: body.length, total: body.length, totalPages: 1 },
    }
  }

  if (body && typeof body === 'object' && Array.isArray((body as Paginated<T>).data)) {
    const paginated = body as Paginated<T>
    return { items: paginated.data, meta: paginated.meta ?? EMPTY_META }
  }

  // Unrecognised shape: render an empty list rather than crashing the page.
  return { items: [], meta: EMPTY_META }
}

// ---------------------------------------------------------------------------
// Auth — served by the backend's own auth module, not an admin-specific one
// ---------------------------------------------------------------------------
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  /** Returns the user plus `adminRole` and `permissions` from admin_users. */
  me: () => api.get('/auth/me'),
}

// ---------------------------------------------------------------------------
// Admin — all under /v1/admin/*
// ---------------------------------------------------------------------------
type Params = Record<string, unknown>

export const dashboardApi = {
  getOverview: () => api.get('/admin/dashboard'),
}

export const driversApi = {
  list: (params?: Params) => api.get('/admin/drivers', { params }),
  get: (id: string) => api.get(`/admin/drivers/${id}`),
  create: (data: unknown) => api.post('/admin/drivers', data),
  update: (id: string, data: unknown) => api.patch(`/admin/drivers/${id}`, data),
  /**
   * Retires a driver by forcing them OFFLINE.
   *
   * There is no `DELETE /admin/drivers/:id` and there should not be — assignment
   * and booking history reference the driver row. This used to call DELETE, which
   * matched no handler, so the list's Delete button 404'd every time.
   */
  deactivate: (id: string) => api.patch(`/admin/drivers/${id}/deactivate`),
}

export const vehiclesApi = {
  list: (params?: Params) => api.get('/admin/vehicles', { params }),
  get: (id: string) => api.get(`/admin/vehicles/${id}`),
  create: (data: unknown) => api.post('/admin/vehicles', data),
  update: (id: string, data: unknown) => api.patch(`/admin/vehicles/${id}`, data),
  getAvailability: (id: string) => api.get(`/admin/vehicles/${id}/availability`),
  /** Soft-delete, for the same reason as `driversApi.deactivate`. */
  deactivate: (id: string) => api.patch(`/admin/vehicles/${id}/deactivate`),
}

export const maintenanceApi = {
  list: (params?: Params) => api.get('/admin/maintenance', { params }),
  create: (data: unknown) => api.post('/admin/maintenance', data),
  update: (id: string, data: unknown) =>
    api.patch(`/admin/maintenance/${id}`, data),
  /** Records due soon — returns a bare array, not a paginated envelope. */
  getUpcoming: () => api.get('/admin/maintenance/upcoming'),
  /** Full history for one vehicle. */
  getForVehicle: (vehicleId: string) =>
    api.get(`/admin/maintenance/vehicle/${vehicleId}`),
}

export const bookingsApi = {
  list: (params?: Params) => api.get('/admin/bookings', { params }),
  get: (id: string) => api.get(`/admin/bookings/${id}`),
  update: (id: string, data: unknown) => api.patch(`/admin/bookings/${id}`, data),
  /** Bookings with no driver assigned yet — the dispatch work queue. */
  listUnassigned: (params?: Params) =>
    api.get('/admin/bookings/unassigned', { params }),
  /**
   * Admin cancellation.
   *
   * Must be the `/admin/` route. This previously posted to
   * `/bookings/:id/cancel`, the customer endpoint, which asserts
   * `booking.userId === caller.sub` — so an admin cancelling a customer's booking
   * got a 403, and the action was impossible from the panel. The admin route also
   * writes an audit-log entry.
   */
  cancel: (id: string, reason?: string) =>
    api.post(`/admin/bookings/${id}/cancel`, reason ? { reason } : {}),
}

export const aiSessionsApi = {
  /** Paginated session list. Returns `{ data, meta }` after envelope unwrap. */
  list: (params?: Params) => api.get('/admin/ai-sessions', { params }),
  getBookings: (params?: Params) =>
    api.get('/admin/ai-sessions/bookings', { params }),
  /** Prefers the agent's live Redis state, falling back to the archive. */
  getSession: (sessionId: string) => api.get(`/admin/ai-sessions/${sessionId}`),
  /** Always the persisted transcript, never the Redis copy. */
  getTranscript: (sessionId: string) =>
    api.get(`/admin/ai-sessions/${sessionId}/transcript`),
  getSuccessRate: (params?: Params) =>
    api.get('/admin/ai-sessions/metrics/success-rate', { params }),
  getPerformance: (params?: Params) =>
    api.get('/admin/ai-sessions/metrics/performance', { params }),
}

export const assignmentsApi = {
  list: (params?: Params) => api.get('/admin/assignments', { params }),
  create: (data: unknown) => api.post('/admin/assignments', data),
  complete: (id: string) => api.patch(`/admin/assignments/${id}/complete`),
}

export const hotelsApi = {
  list: (params?: Params) => api.get('/admin/hotels', { params }),
  get: (id: string) => api.get(`/admin/hotels/${id}`),
  create: (data: unknown) => api.post('/admin/hotels', data),
  update: (id: string, data: unknown) => api.patch(`/admin/hotels/${id}`, data),
  getRooms: (id: string) => api.get(`/admin/hotels/${id}/rooms`),
  createRoom: (id: string, data: unknown) =>
    api.post(`/admin/hotels/${id}/rooms`, data),
  updateRoom: (hotelId: string, roomId: string, data: unknown) =>
    api.patch(`/admin/hotels/${hotelId}/rooms/${roomId}`, data),
  /**
   * Interval-overlap availability; dates are ISO yyyy-mm-dd.
   *
   * The route is nested under the hotel — `hotels/:hotelId/rooms/:roomId/...`.
   * This used to build `/admin/hotels/rooms/${roomId}/availability`, which is one
   * segment short and matched no handler, and sent camelCase `startDate`/`endDate`
   * where the endpoint reads `start_date`/`end_date`.
   */
  getRoomAvailability: (
    hotelId: string,
    roomId: string,
    startDate: string,
    endDate: string,
  ) =>
    api.get(`/admin/hotels/${hotelId}/rooms/${roomId}/availability`, {
      params: { start_date: startDate, end_date: endDate },
    }),
}

export const guidesApi = {
  list: (params?: Params) => api.get('/admin/guides', { params }),
  get: (id: string) => api.get(`/admin/guides/${id}`),
  create: (data: unknown) => api.post('/admin/guides', data),
  update: (id: string, data: unknown) => api.patch(`/admin/guides/${id}`, data),
  /** Trips/bookings this guide is booked on. */
  getAssignments: (id: string) => api.get(`/admin/guides/${id}/assignments`),
  /** Dates the guide is already committed. */
  getAvailability: (id: string) => api.get(`/admin/guides/${id}/availability`),
  /** Soft-delete: guides are referenced by historical bookings. */
  deactivate: (id: string) =>
    api.patch(`/admin/guides/${id}`, { isActive: false }),
}

/**
 * Trip packages.
 *
 * Trips had no admin surface at all until now — the public controller exposes
 * only list/detail/related/share, so packages could only be created by the seed
 * script or by hand-written SQL.
 *
 * `list` returns `{ data, meta }` after the envelope unwrap. Mutations return the
 * full trip aggregate; itinerary mutations return the whole reordered itinerary
 * so the caller never has to re-fetch.
 */
export const tripsApi = {
  list: (params?: Params) => api.get('/admin/trips', { params }),
  get: (id: string) => api.get(`/admin/trips/${id}`),
  create: (data: unknown) => api.post('/admin/trips', data),
  update: (id: string, data: unknown) => api.patch(`/admin/trips/${id}`, data),
  /** Rejected with 400 unless a non-empty English title exists. */
  setPublished: (id: string, isPublished: boolean) =>
    api.patch(`/admin/trips/${id}/publish`, { isPublished }),
  /** 409 when booking records reference the trip — unpublish instead. */
  remove: (id: string) => api.delete(`/admin/trips/${id}`),

  getItinerary: (id: string) => api.get(`/admin/trips/${id}/itinerary`),
  createItineraryItem: (id: string, data: unknown) =>
    api.post(`/admin/trips/${id}/itinerary`, data),
  updateItineraryItem: (id: string, itemId: string, data: unknown) =>
    api.patch(`/admin/trips/${id}/itinerary/${itemId}`, data),
  deleteItineraryItem: (id: string, itemId: string) =>
    api.delete(`/admin/trips/${id}/itinerary/${itemId}`),
  /** One batched request: dragging a stop shifts its siblings' sortOrder too. */
  reorderItinerary: (
    id: string,
    items: { itemId: string; dayNumber: number; sortOrder: number }[],
  ) => api.patch(`/admin/trips/${id}/itinerary/reorder`, { items }),

  /** PUT: replaces the guide set wholesale rather than appending. */
  setGuides: (id: string, guideIds: string[]) =>
    api.put(`/admin/trips/${id}/guides`, { guideIds }),
}

export const emergencyApi = {
  list: (params?: Params) => api.get('/admin/emergency', { params }),
  get: (id: string) => api.get(`/admin/emergency/${id}`),
  update: (id: string, data: unknown) => api.patch(`/admin/emergency/${id}`, data),
}

export const customersApi = {
  list: (params?: Params) => api.get('/admin/customers', { params }),
  get: (id: string) => api.get(`/admin/customers/${id}`),
  getReviews: (id: string) => api.get(`/admin/customers/${id}/reviews`),
  adjustLoyalty: (data: unknown) => api.post('/admin/loyalty/adjust', data),
  /** Profile fields only. Email is not editable — it is the login identity. */
  update: (id: string, data: unknown) => api.patch(`/admin/customers/${id}`, data),
  /**
   * Suspend, deactivate or restore. `reason` is mandatory and audit-logged.
   * Suspending also terminates the customer's active sessions server side.
   */
  setStatus: (id: string, status: string, reason: string) =>
    api.patch(`/admin/customers/${id}/status`, { status, reason }),
  /** SUPER_ADMIN only, and only non-admin roles. */
  setRole: (id: string, role: string) =>
    api.patch(`/admin/customers/${id}/role`, { role }),
}

export const discountsApi = {
  list: (params?: Params) => api.get('/admin/discounts', { params }),
  create: (data: unknown) => api.post('/admin/discounts', data),
  update: (id: string, data: unknown) => api.patch(`/admin/discounts/${id}`, data),
  /**
   * Dedicated deactivate route.
   *
   * The list used to call `update(id, { is_active: false })`, which the backend
   * rejected with 400: `UpdateDiscountCodeDto` whitelists camelCase `isActive`
   * only, and `forbidNonWhitelisted` fails the request on any undeclared property.
   */
  deactivate: (id: string) => api.patch(`/admin/discounts/${id}/deactivate`),
  getStudentVerifications: (params?: Params) =>
    api.get('/admin/student-verifications', { params }),
  reviewStudentVerification: (id: string, data: unknown) =>
    api.patch(`/admin/student-verifications/${id}`, data),
}

export const analyticsApi = {
  getRevenue: (params?: Params) => api.get('/admin/analytics/revenue', { params }),
  getBookings: (params?: Params) =>
    api.get('/admin/analytics/bookings', { params }),
  getDrivers: (params?: Params) => api.get('/admin/analytics/drivers', { params }),
  getPopularDestinations: (params?: Params) =>
    api.get('/admin/analytics/destinations', { params }),
  getHotelOccupancy: (params?: Params) =>
    api.get('/admin/analytics/hotels', { params }),
  getGuideUtilization: (params?: Params) =>
    api.get('/admin/analytics/guides', { params }),
  /** Revenue and volume attributable to the AI concierge. */
  getAiBookings: (params?: Params) =>
    api.get('/admin/analytics/ai-bookings', { params }),
  /** Conversion and latency for the AI concierge. */
  getAiPerformance: (params?: Params) =>
    api.get('/admin/analytics/ai-performance', { params }),
  export: (params?: Params) =>
    api.get('/admin/analytics/export', { params, responseType: 'blob' }),
}

/**
 * Payment operations.
 *
 * Reads are available to support agents fielding "did my payment go through?".
 * `settleManually` and `refundsApi.complete` are OPERATIONS_MANAGER and above:
 * one confirms a booking, the other records money as returned.
 */
export const paymentsApi = {
  list: (params?: Params) => api.get('/admin/payments', { params }),
  /**
   * ABA payments that expired while still pending — money that arrived with no
   * matching alert, or an ambiguous amount match the Telegram listener refused to
   * guess at. Returns a bare array, not a paginated envelope.
   */
  getAbaExceptions: () => api.get('/admin/payments/aba-exceptions'),
  /**
   * Settles an ABA payment against a bank transaction the operator has verified.
   *
   * `abaTrxId` must be the numeric id from the ABA credit alert: it is stored in a
   * unique column, so the same bank transaction cannot settle two bookings, and it
   * ties the settlement to a line on the merchant statement. `reason` is recorded
   * in the audit log and must be at least 10 characters.
   */
  settleManually: (id: string, abaTrxId: string, reason: string) =>
    api.post(`/admin/payments/${id}/settle`, { abaTrxId, reason }),
}

/**
 * Refunds.
 *
 * Card refunds settle themselves through Stripe. ABA has no refund API, so those
 * are queued as `pending` and the payment's refunded total deliberately does not
 * move until an operator confirms the transfer here — the books must not show
 * money returned before it was.
 */
export const refundsApi = {
  list: (params?: Params) => api.get('/admin/refunds', { params }),
  complete: (id: string, providerRefundId: string, reason: string) =>
    api.patch(`/admin/refunds/${id}/complete`, { providerRefundId, reason }),
}

/**
 * Data export and backup. SUPER_ADMIN only.
 *
 * These five endpoints have existed on the backend since the admin merge with no
 * client wrapper and no UI, so the "Data export & backup" capability was
 * unreachable from the panel.
 */
export const exportApi = {
  bookings: (params?: Params) =>
    api.get('/admin/export/bookings', { params, responseType: 'blob' }),
  drivers: (params?: Params) =>
    api.get('/admin/export/drivers', { params, responseType: 'blob' }),
  payments: (params?: Params) =>
    api.get('/admin/export/payments', { params, responseType: 'blob' }),
  createBackup: () => api.post('/admin/backup'),
  listBackups: (params?: Params) => api.get('/admin/backups', { params }),
}

export const adminUsersApi = {
  list: (params?: Params) => api.get('/admin/users', { params }),
  get: (id: string) => api.get(`/admin/users/${id}`),
  create: (data: unknown) => api.post('/admin/users', data),
  update: (id: string, data: unknown) => api.patch(`/admin/users/${id}`, data),
  deactivate: (id: string) => api.patch(`/admin/users/${id}/deactivate`),
  /**
   * Sets a password and terminates existing sessions.
   *
   * Also the remedy for an account created without one: sign-in checks
   * `users.password_hash`, so a passwordless admin is created inactive and
   * cannot log in until this is called.
   */
  resetPassword: (id: string, password: string) =>
    api.post(`/admin/users/${id}/reset-password`, { password }),
}

export const auditLogsApi = {
  list: (params?: Params) => api.get('/admin/audit-logs', { params }),
  export: (params?: Params) =>
    api.get('/admin/audit-logs/export', { params, responseType: 'blob' }),
}

/**
 * Telegram admin operations.
 *
 * These now live under /v1/admin/telegram/* behind the admin guards. Broadcast
 * previously sat on the unauthenticated driver-facing controller, and support
 * tickets and analytics had no backend at all.
 */
export const telegramApi = {
  broadcast: (data: {
    message: string
    imageUrl?: string
    targetFilter?: { status?: string; province?: string }
  }) => api.post('/admin/telegram/broadcast', data),
  getBroadcastHistory: (params?: Params) =>
    api.get('/admin/telegram/broadcasts', { params }),
  getAnalytics: (params?: Params) =>
    api.get('/admin/telegram/analytics', { params }),
  getSupportTickets: (params?: Params) =>
    api.get('/admin/telegram/support-tickets', { params }),
  updateTicket: (id: string, data: unknown) =>
    api.patch(`/admin/telegram/support-tickets/${id}`, data),
  assignTicket: (id: string, assignedTo: string) =>
    api.patch(`/admin/telegram/support-tickets/${id}/assign`, { assignedTo }),
}

/**
 * Presigned uploads straight to MinIO.
 *
 * The browser PUTs to the returned URL; it never holds MinIO credentials.
 */
export const uploadApi = {
  getPresignedUrl: (fileName: string, contentType?: string, bucket?: string) =>
    api.post<{ url: string; bucket: string; objectKey: string; expiresIn: number }>(
      '/admin/upload/presigned',
      { fileName, contentType, bucket },
    ),
  getPresignedDownload: (bucket: string, objectKey: string) =>
    api.post<{ url: string; expiresIn: number }>(
      '/admin/storage/presigned-download',
      { bucket, objectKey },
    ),
}
