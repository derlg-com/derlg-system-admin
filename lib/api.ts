import axios, { AxiosInstance, AxiosError } from 'axios'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1'

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

let isRefreshing = false
let pendingRequests: Array<() => void> = []

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_access_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as any
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingRequests.push(() => resolve(api(original)))
        })
      }
      original._retry = true
      isRefreshing = true
      try {
        const res = await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
        const { accessToken } = res.data
        localStorage.setItem('admin_access_token', accessToken)
        pendingRequests.forEach((cb) => cb())
        pendingRequests = []
        isRefreshing = false
        original.headers.Authorization = `Bearer ${accessToken}`
        return api(original)
      } catch {
        isRefreshing = false
        pendingRequests = []
        localStorage.removeItem('admin_access_token')
        if (typeof window !== 'undefined') window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export default api

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
}

// Admin Dashboard
export const dashboardApi = {
  getOverview: () => api.get('/admin/dashboard'),
}

// Admin Drivers
export const driversApi = {
  list: (params?: Record<string, any>) => api.get('/admin/drivers', { params }),
  get: (id: string) => api.get(`/admin/drivers/${id}`),
  create: (data: any) => api.post('/admin/drivers', data),
  update: (id: string, data: any) => api.patch(`/admin/drivers/${id}`, data),
  delete: (id: string) => api.delete(`/admin/drivers/${id}`),
}

// Admin Vehicles
export const vehiclesApi = {
  list: (params?: Record<string, any>) => api.get('/admin/vehicles', { params }),
  get: (id: string) => api.get(`/admin/vehicles/${id}`),
  create: (data: any) => api.post('/admin/vehicles', data),
  update: (id: string, data: any) => api.patch(`/admin/vehicles/${id}`, data),
}

// Admin Maintenance
export const maintenanceApi = {
  list: (params?: Record<string, any>) => api.get('/admin/maintenance', { params }),
  create: (data: any) => api.post('/admin/maintenance', data),
  update: (id: string, data: any) => api.patch(`/admin/maintenance/${id}`, data),
}

// Admin Bookings
export const bookingsApi = {
  list: (params?: Record<string, any>) => api.get('/admin/bookings', { params }),
  get: (id: string) => api.get(`/admin/bookings/${id}`),
  update: (id: string, data: any) => api.patch(`/admin/bookings/${id}`, data),
  cancel: (id: string) => api.post(`/bookings/${id}/cancel`),
}

// Admin Assignments
export const assignmentsApi = {
  create: (data: any) => api.post('/admin/assignments', data),
  complete: (id: string) => api.patch(`/admin/assignments/${id}/complete`),
}

// Admin Hotels
export const hotelsApi = {
  list: (params?: Record<string, any>) => api.get('/admin/hotels', { params }),
  get: (id: string) => api.get(`/admin/hotels/${id}`),
  create: (data: any) => api.post('/admin/hotels', data),
  update: (id: string, data: any) => api.patch(`/admin/hotels/${id}`, data),
  getRooms: (id: string) => api.get(`/admin/hotels/${id}/rooms`),
  createRoom: (id: string, data: any) => api.post(`/admin/hotels/${id}/rooms`, data),
  updateRoom: (hotelId: string, roomId: string, data: any) =>
    api.patch(`/admin/hotels/${hotelId}/rooms/${roomId}`, data),
}

// Admin Guides
export const guidesApi = {
  list: (params?: Record<string, any>) => api.get('/admin/guides', { params }),
  get: (id: string) => api.get(`/admin/guides/${id}`),
  create: (data: any) => api.post('/admin/guides', data),
  update: (id: string, data: any) => api.patch(`/admin/guides/${id}`, data),
}

// Admin Emergency
export const emergencyApi = {
  list: (params?: Record<string, any>) => api.get('/admin/emergency', { params }),
  get: (id: string) => api.get(`/admin/emergency/${id}`),
  update: (id: string, data: any) => api.patch(`/admin/emergency/${id}`, data),
}

// Admin Customers
export const customersApi = {
  list: (params?: Record<string, any>) => api.get('/admin/customers', { params }),
  get: (id: string) => api.get(`/admin/customers/${id}`),
  adjustLoyalty: (data: any) => api.post('/admin/loyalty/adjust', data),
}

// Admin Discounts
export const discountsApi = {
  list: (params?: Record<string, any>) => api.get('/admin/discounts', { params }),
  create: (data: any) => api.post('/admin/discounts', data),
  update: (id: string, data: any) => api.patch(`/admin/discounts/${id}`, data),
  getStudentVerifications: (params?: Record<string, any>) =>
    api.get('/admin/student-verifications', { params }),
  reviewStudentVerification: (id: string, data: any) =>
    api.patch(`/admin/student-verifications/${id}`, data),
}

// Admin Analytics
export const analyticsApi = {
  getRevenue: (params?: Record<string, any>) => api.get('/admin/analytics/revenue', { params }),
  getBookings: (params?: Record<string, any>) => api.get('/admin/analytics/bookings', { params }),
  getDrivers: (params?: Record<string, any>) => api.get('/admin/analytics/drivers', { params }),
  export: (params?: Record<string, any>) => api.get('/admin/analytics/export', { params, responseType: 'blob' }),
}

// Admin Users
export const adminUsersApi = {
  list: (params?: Record<string, any>) => api.get('/admin/users', { params }),
  create: (data: any) => api.post('/admin/users', data),
  update: (id: string, data: any) => api.patch(`/admin/users/${id}`, data),
}

// Admin Audit Logs
export const auditLogsApi = {
  list: (params?: Record<string, any>) => api.get('/admin/audit-logs', { params }),
  export: (params?: Record<string, any>) =>
    api.get('/admin/audit-logs/export', { params, responseType: 'blob' }),
}
