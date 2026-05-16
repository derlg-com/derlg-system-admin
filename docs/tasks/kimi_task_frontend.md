# Frontend Tasks — DerLg System Admin Panel

> Source: `/docs/specs/system-admin/combined.md` + `/docs/specs/telegram/design.md`
> Status: **F1 Complete** — All dependencies installed, shadcn/ui components ready, build compiles cleanly.

---

## F1: Install Missing Dependencies

- [x] 1.1 Install required dependencies (shadcn/ui components, leaflet, etc.)
  - Base: `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-slot`
  - Map: `leaflet@1.9.4`, `react-leaflet@5.0.0`, `@types/leaflet@1.9.21`
  - WebSocket: `socket.io-client@4.8.3`
  - Date picker: `react-day-picker@10.0.1`, `date-fns@4.1.0`
  - Command palette: `cmdk@1.1.1`
  - Toast: `sonner@2.0.7`
  - Themes: `next-themes@0.4.6`
- [x] 1.2 Add `leaflet` + `react-leaflet` for emergency location maps
- [x] 1.3 Add `socket.io-client` for WebSocket connection
- [x] 1.4 Install shadcn/ui components: Table, Dialog, DropdownMenu, Form, Input, Button, Badge, Card, Select, DatePicker (Calendar), Tabs, Accordion, AlertDialog, Toast (Sonner), Avatar, Skeleton, Pagination, Calendar, Popover, Checkbox, Textarea, Command, Separator
  - 24 component files in `components/ui/`
  - `lib/utils.ts` with `cn()` helper created
  - `components.json` configured for Tailwind v4 + Next.js 16
- [x] 1.5 Verify React 19 compatibility for all installed packages
  - Next.js 16.2.4 builds successfully with React 19.2.4
  - All shadcn/ui components compile cleanly
  - `react-leaflet@5.0.0` and `react-day-picker@10.0.1` confirmed React 19 compatible
  - Fixed `calendar.tsx` `table` className for react-day-picker v10 API

---

## F2: Shared Admin Components
**Source:** Combined Task 37

- [x] 2.1 Create `DataTable` component (`components/shared/DataTable.tsx`):
  - Reusable table with sorting, filtering, pagination
  - Props: columns, data, filters, onSort, onFilter, onPageChange
  - Use shadcn/ui Table components (Table, TableHeader, TableBody, TableRow, TableHead, TableCell)
  - Responsive design with horizontal scroll on mobile
  - Loading skeleton state, empty state, controlled/uncontrolled pagination
- [x] 2.2 Create `SearchInput` component (`components/shared/SearchInput.tsx`):
  - Reusable search input with debounce (default 300ms)
  - Props: placeholder, onSearch, debounceMs, defaultValue
  - Clear button (X icon), backward-compatible with legacy value/onChange API
  - Uses shadcn/ui Input component
- [x] 2.3 Create `FilterDropdown` component (`components/shared/FilterDropdown.tsx`):
  - Reusable dropdown for filtering using shadcn/ui DropdownMenu + Checkbox
  - Props: options, value, onChange, label
  - Multi-select support (string[]), backward-compatible with single-select (string)
  - Selected count badge, clear button
- [x] 2.4 Create `ConfirmDialog` component (`components/shared/ConfirmDialog.tsx`):
  - Reusable confirmation dialog using shadcn/ui AlertDialog
  - Props: title, message, onConfirm, onCancel, open, loading, variant
  - Loading spinner on confirm button, danger/primary variants
- [x] 2.5 Create `ImageUpload` component (`components/shared/ImageUpload.tsx`):
  - Reusable image upload with drag-and-drop + click
  - Props: onUpload, maxSize, accept, multiple, maxFiles
  - Preview thumbnails, upload progress bar
  - Calls backend presigned URL endpoint, uploads to storage
  - Toast notifications for errors

---

## F3: Admin Layout & Navigation
**Source:** Combined Task 21

- [x] 3.1 Create `AdminLayout` component (`components/layout/AdminLayout.tsx`):
  - Responsive layout with sidebar and top bar
  - Mobile hamburger menu with overlay backdrop for sidebar
  - Auto-collapse sidebar on mobile, close on navigation
  - Top bar with admin user info, notification bell
  - WebSocket connection status indicator (connected/disconnected with color)
  - Logout button
  - Zustand hydration guard (spinner while rehydrating)
- [x] 3.2 Create `AdminSidebar` component (`components/admin/AdminSidebar.tsx`):
  - Render navigation menu items based on admin role permissions
  - Highlight active route with primary color and indicator bar
  - Icons from lucide-react for all 13 nav items
  - Filter menu items by role (FLEET_MANAGER sees only drivers/vehicles, SUPPORT_AGENT sees only bookings/customers)
  - Collapsible sidebar with expand/collapse button
  - User info section at bottom
  - Mobile-friendly with onNavigate callback to close mobile sidebar
- [x] 3.3 Create `NotificationBell` component (`components/admin/NotificationBell.tsx`):
  - Badge with unread notification count (shadcn/ui Badge)
  - Dropdown with recent notifications using shadcn/ui DropdownMenu
  - Notification types: BOOKING, DRIVER_STATUS, EMERGENCY, SYSTEM with icons
  - Click to mark as read
  - Mark all read and clear all actions
  - Relative timestamps via date-fns
  - Store notifications in Zustand store
- [x] 3.4 Create admin route group structure:
  - `app/admin/layout.tsx` with AdminLayout wrapping all admin routes
  - All 13 admin page routes scaffolded as specified
  - Route protection: unauthenticated users redirected to /login
  - Role protection: users without adminRole redirected to /login
  - Login page checks user.role is ADMIN or SUPPORT

---

## F4: Authentication & Authorization
**Source:** Combined Task 36

- [x] 4.1 Create admin route protection:
  - Login page checks user.role is ADMIN or SUPPORT before allowing access
  - `RequireAuth` component (`components/shared/RequireAuth.tsx`) guards pages by auth state, required roles, and required permissions
  - `AdminLayout` redirects unauthenticated users to /login
  - `AdminLayout` redirects users without adminRole to /login
  - Admin role and permissions stored in Zustand auth store on login
- [x] 4.2 Implement role-based UI rendering:
  - `AdminSidebar` filters nav items by admin_role (SUPER_ADMIN, OPERATIONS_MANAGER, FLEET_MANAGER, SUPPORT_AGENT)
  - `usePermission` hook (`hooks/usePermission.ts`) provides granular permission checks + role-based helpers (canManageDrivers, canManageBookings, etc.)
  - `AccessDenied` component (`components/shared/AccessDenied.tsx`) shows shield icon + message for unauthorized features
  - SUPER_ADMIN bypasses all permission checks
- [x] 4.3 Handle token refresh in admin panel:
  - Axios interceptor catches 401, queues pending requests, calls POST /v1/auth/refresh with httpOnly cookie
  - On successful refresh: updates localStorage token, notifies Zustand store via `setTokenRefreshCallback`, retries queued requests
  - On refresh failure: clears auth, redirects to /login
  - `AuthProvider` component wires up token refresh callback to keep Zustand store in sync
  - Zustand persist middleware maintains session across page navigation

---

## F5: Dashboard Page
**Source:** Combined Task 22

- [x] 5.1 Create `DashboardOverview` component (`components/admin/dashboard/DashboardOverview.tsx`):
  - Fetch dashboard data from GET /v1/admin/dashboard via React Query
  - Display metric cards: bookings today, revenue today, active drivers, open emergencies
  - Render booking trend chart for past 30 days using recharts
  - Display pending actions list (unassigned bookings, upcoming maintenance)
  - Display recent emergency alerts with status badges
  - Display upcoming bookings (next 24h)
  - Implement auto-refresh every 60 seconds using React Query `refetchInterval`
  - Mock fallback data for when API isn't ready
- [x] 5.2 Create `MetricCard` component (`components/admin/dashboard/MetricCard.tsx`):
  - Reusable card for displaying single metric
  - Props: title, value, icon, trend (percentage change), color, loading
  - Display trend indicator (up/down arrow with color)
  - Skeleton loading state
  - Color-coded icon background
- [x] 5.3 Create `BookingTrendChart` component (`components/admin/dashboard/BookingTrendChart.tsx`):
  - Line chart showing daily booking counts
  - Use recharts library (LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer)
  - Responsive design with custom dark theme styling
  - Monotone line with active dot on hover
  - Formatted date labels via date-fns
- [x] 5.4 Create dashboard page: `app/admin/dashboard/page.tsx`
  - Server Component with metadata
  - Uses DashboardOverview client component

---

## F6: Driver Management Pages
**Source:** Combined Task 23

- [x] 6.1 Create `DriverList` component (`components/admin/drivers/DriverList.tsx`):
  - Fetch drivers from GET /v1/admin/drivers
  - Data table with columns: name, driver_id, vehicle, status, last_update
  - Status filter dropdown (AVAILABLE, BUSY, OFFLINE)
  - Search by name or driver_id
  - Subscribe to WebSocket for real-time status updates
  - Add Edit and View Details actions
- [x] 6.2 Create `DriverStatusBadge` component (`components/admin/drivers/DriverStatusBadge.tsx`):
  - Color-coded badge: green (AVAILABLE), yellow (BUSY), gray (OFFLINE)
  - Pulsing animation for real-time updates
- [x] 6.3 Create `DriverForm` component (`components/admin/drivers/DriverForm.tsx`):
  - Form for creating/editing driver profiles
  - Fields: driver_name, driver_id, telegram_id, phone, vehicle_id (dropdown)
  - Use React Hook Form + Zod validation
  - Submit to POST/PATCH /v1/admin/drivers
- [x] 6.4 Create `DriverDetailView` component (`components/admin/drivers/DriverDetailView.tsx`):
  - Display driver profile information
  - Show assigned vehicle details
  - Display assignment history table
  - Show performance metrics (total trips, average rating)
- [x] 6.5 Create driver pages:
  - `app/(admin)/admin/drivers/page.tsx` with DriverList
  - `app/(admin)/admin/drivers/[id]/page.tsx` with DriverDetailView
- [x] 6.6 **Telegram-enhanced DriverList** (from Telegram design):
  - Telegram registration status badge (✅ Registered / ❌ Not Registered)
  - Last seen timestamp from Telegram activity
  - Filter by Telegram registration status
- [x] 6.7 **Telegram-enhanced DriverForm** (from Telegram design):
  - `auth_pin` field (4-digit PIN, auto-generated)
  - `telegram_id` field (read-only)
  - `admin_role` dropdown (SUPER_ADMIN, OPERATIONS_MANAGER, FLEET_MANAGER, SUPPORT_AGENT)
  - "Copy Credentials" button

---

## F7: Vehicle Management Pages
**Source:** Combined Task 24

- [x] 7.1 Create `VehicleList` component (`components/admin/vehicles/VehicleList.tsx`):
  - Fetch vehicles from GET /v1/admin/vehicles
  - Data table with columns: name, category, capacity, tier, price, assigned_driver
  - Filters: category (VAN, BUS, TUK_TUK), tier (STANDARD, VIP)
  - Search by name
  - Add Edit and Schedule Maintenance actions
- [x] 7.2 Create `VehicleForm` component (`components/admin/vehicles/VehicleForm.tsx`):
  - Form for creating/editing vehicles
  - Fields: name, category, capacity, tier, price_per_day, price_per_km, features (multi-select), images (upload)
  - Image upload to Supabase Storage
  - Use React Hook Form + Zod validation
- [x] 7.3 Create `MaintenanceScheduler` component (`components/admin/vehicles/MaintenanceScheduler.tsx`):
  - Calendar view of scheduled maintenance
  - Form to schedule new maintenance
  - Fields: vehicle_id, maintenance_type, scheduled_date, notes
  - Submit to POST /v1/admin/maintenance
  - Display reminder notifications for upcoming maintenance (within 3 days)
- [x] 7.4 Create `MaintenanceHistory` component (`components/admin/vehicles/MaintenanceHistory.tsx`):
  - Table of past maintenance records
  - Columns: date, type, cost, notes, status
  - Calculate and display total cost
- [x] 7.5 Create vehicle pages:
  - `app/(admin)/admin/vehicles/page.tsx` with VehicleList
  - `app/(admin)/admin/vehicles/[id]/page.tsx` with vehicle detail and MaintenanceHistory

---

## F8: Booking Management Pages
**Source:** Combined Task 25

- [ ] 8.1 Create `BookingList` component (`components/admin/bookings/BookingList.tsx`):
  - Fetch bookings from GET /v1/admin/bookings
  - Data table with columns: booking_ref, customer, type, status, travel_date, total
  - Filters: booking_type, status, date range, AI-assisted flag
  - Search by booking_ref or customer email
  - Subscribe to WebSocket for real-time new booking notifications
- [ ] 8.2 Create `BookingDetailView` component (`components/admin/bookings/BookingDetailView.tsx`):
  - Fetch booking details from GET /v1/admin/bookings/:id
  - Display complete booking information
  - Show customer details from users table
  - Show trip/hotel/vehicle/guide details
  - Display payment status and history
  - Include DriverAssignmentPanel component
  - Add modification and cancellation actions
- [ ] 8.3 Create `DriverAssignmentPanel` component (`components/admin/bookings/DriverAssignmentPanel.tsx`):
  - Dropdown to select available driver from GET /v1/admin/drivers?status=AVAILABLE
  - Display vehicle capacity validation
  - Assign button calling POST /v1/admin/assignments
  - Show current assignment if exists
  - Display error if driver not available (409 Conflict)
- [ ] 8.4 Create `BookingModificationForm` component (`components/admin/bookings/BookingModificationForm.tsx`):
  - Form to modify booking details
  - Fields: travel_date, end_date, num_adults, num_children, customizations
  - Validation and price recalculation
  - Submit to PATCH /v1/admin/bookings/:id
- [ ] 8.5 Create booking pages:
  - `app/(admin)/admin/bookings/page.tsx` with BookingList
  - `app/(admin)/admin/bookings/[id]/page.tsx` with BookingDetailView
- [ ] 8.6 **Telegram-enhanced assignment** (from Telegram design):
  - Filter drivers by AVAILABLE + telegram_id NOT NULL
  - Notification sent indicator
  - Real-time response status (pending/accepted/rejected)
  - Countdown timer (5 minutes)

---

## F9: Hotel Management Pages
**Source:** Combined Task 26

- [ ] 9.1 Create `HotelList` component (`components/admin/hotels/HotelList.tsx`):
  - Fetch hotels from GET /v1/admin/hotels
  - Data table with columns: name, location, rating, room_count
  - Search by name or location
  - Add Edit and Manage Rooms actions
- [ ] 9.2 Create `HotelForm` component (`components/admin/hotels/HotelForm.tsx`):
  - Form for creating/editing hotels
  - Fields: name, description, location (JSON with lat/lng), images, rating, amenities, check_in_time, check_out_time, cancellation_policy
  - Location picker using Leaflet.js map
  - Image upload to Supabase Storage
- [ ] 9.3 Create `RoomManagement` component (`components/admin/hotels/RoomManagement.tsx`):
  - List of rooms for a hotel from GET /v1/admin/hotels/:id/rooms
  - Add/Edit/Delete room actions
  - Display room availability calendar
- [ ] 9.4 Create `RoomForm` component (`components/admin/hotels/RoomForm.tsx`):
  - Form for creating/editing rooms
  - Fields: name, description, capacity, price_per_night, images, amenities
  - Image upload to Supabase Storage
  - Submit to POST/PATCH /v1/admin/hotels/:hotelId/rooms/:roomId
- [ ] 9.5 Create hotel pages:
  - `app/(admin)/admin/hotels/page.tsx` with HotelList
  - `app/(admin)/admin/hotels/[id]/page.tsx` with hotel detail
  - `app/(admin)/admin/hotels/[id]/rooms/page.tsx` with RoomManagement

---

## F10: Tour Guide Management Pages
**Source:** Combined Task 27

- [ ] 10.1 Create `GuideList` component (`components/admin/guides/GuideList.tsx`):
  - Fetch guides from GET /v1/admin/guides
  - Data table with columns: name, languages, specialties, rating, price
  - Filters: languages (multi-select), specialties (multi-select)
  - Add Edit and View Details actions
- [ ] 10.2 Create `GuideForm` component (`components/admin/guides/GuideForm.tsx`):
  - Form for creating/editing guides
  - Fields: name, bio, profile_picture, languages (multi-select), specialties (multi-select), experience_years, certifications, price_per_hour, price_per_day
  - Profile picture upload to Supabase Storage
- [ ] 10.3 Create `GuideDetailView` component (`components/admin/guides/GuideDetailView.tsx`):
  - Display guide profile information
  - Show assignment history from bookings table
  - Display performance metrics (total assignments, average rating)
  - Show availability calendar
- [ ] 10.4 Create guide pages:
  - `app/(admin)/admin/guides/page.tsx` with GuideList
  - `app/(admin)/admin/guides/[id]/page.tsx` with GuideDetailView

---

## F11: Emergency Alert Management Pages
**Source:** Combined Task 28

- [ ] 11.1 Create `EmergencyAlertList` component (`components/admin/emergency/EmergencyAlertList.tsx`):
  - Fetch alerts from GET /v1/admin/emergency
  - Data table with columns: alert_type, customer, location, status, time
  - Filters: status (SENT, ACKNOWLEDGED, RESOLVED), alert_type
  - Urgent visual styling for SENT alerts
  - Subscribe to WebSocket for new emergency alerts
  - Play sound notification for new alerts using browser Notification API
- [ ] 11.2 Create `EmergencyDetailView` component (`components/admin/emergency/EmergencyDetailView.tsx`):
  - Fetch alert details from GET /v1/admin/emergency/:id
  - Display alert details (type, message, timestamp)
  - Show customer contact information
  - Show assigned driver contact (if applicable)
  - Render EmergencyMap component with location
  - Add Acknowledge and Resolve action buttons
  - Include resolution notes textarea
- [ ] 11.3 Create `EmergencyMap` component (`components/admin/emergency/EmergencyMap.tsx`):
  - Leaflet.js map showing alert location (latitude, longitude)
  - Add marker with alert type icon
  - Display nearby hotels/hospitals/police stations
- [ ] 11.4 Create emergency pages:
  - `app/(admin)/admin/emergency/page.tsx` with EmergencyAlertList
  - `app/(admin)/admin/emergency/[id]/page.tsx` with EmergencyDetailView

---

## F12: Customer Support Pages
**Source:** Combined Task 29

- [ ] 12.1 Create `CustomerList` component (`components/admin/customers/CustomerList.tsx`):
  - Fetch customers from GET /v1/admin/customers
  - Data table with columns: name, email, phone, loyalty_points, is_student
  - Search by name, email, or phone
  - Add View Profile action
- [ ] 12.2 Create `CustomerProfileView` component (`components/admin/customers/CustomerProfileView.tsx`):
  - Fetch customer details from GET /v1/admin/customers/:id
  - Display customer information
  - Show booking history table
  - Display loyalty points balance and transaction history
  - Show reviews and feedback
  - Display emergency alerts history
  - Include loyalty points adjustment form
- [ ] 12.3 Create customer pages:
  - `app/(admin)/admin/customers/page.tsx` with CustomerList
  - `app/(admin)/admin/customers/[id]/page.tsx` with CustomerProfileView

---

## F13: Discount Code Management Pages
**Source:** Combined Task 30

- [ ] 13.1 Create `DiscountCodeList` component (`components/admin/discounts/DiscountCodeList.tsx`):
  - Fetch discount codes from GET /v1/admin/discounts
  - Data table with columns: code, discount_percentage, valid_from, valid_until, usage_count, max_usage, is_active
  - Add Edit and Deactivate actions
- [ ] 13.2 Create `DiscountCodeForm` component (`components/admin/discounts/DiscountCodeForm.tsx`):
  - Form for creating/editing discount codes
  - Fields: code, discount_percentage, valid_from, valid_until, max_usage
  - Validate code uniqueness and date range validity
  - Submit to POST/PATCH /v1/admin/discounts
- [ ] 13.3 Create `StudentVerificationQueue` component (`components/admin/discounts/StudentVerificationQueue.tsx`):
  - Fetch verifications from GET /v1/admin/student-verifications?status=PENDING
  - List with columns: student_name, submitted_at, status
  - Add Review action
- [ ] 13.4 Create `StudentVerificationReview` component (`components/admin/discounts/StudentVerificationReview.tsx`):
  - Display uploaded student ID and selfie images from Supabase Storage
  - Side-by-side image comparison
  - Add Approve and Reject buttons with confirmation
  - Include rejection reason textarea
  - Submit to PATCH /v1/admin/student-verifications/:id
- [ ] 13.5 Create discount pages:
  - `app/(admin)/admin/discounts/page.tsx` with DiscountCodeList
  - `app/(admin)/admin/discounts/student-verifications/page.tsx` with StudentVerificationQueue

---

## F14: Analytics and Reporting Pages
**Source:** Combined Task 31

- [ ] 14.1 Create `AnalyticsDashboard` component (`components/admin/analytics/AnalyticsDashboard.tsx`):
  - Fetch analytics data from multiple endpoints
  - Display revenue charts by booking type using RevenueChart component
  - Show booking statistics (total, by status, cancellation rate)
  - Display driver performance metrics using PerformanceMetrics component
  - Show popular destinations chart
  - Display hotel occupancy rate
  - Show guide utilization rate
  - Add date range selector
  - Add export button calling GET /v1/admin/analytics/export
- [ ] 14.2 Create `RevenueChart` component (`components/admin/analytics/RevenueChart.tsx`):
  - Bar chart showing revenue by booking type
  - Use recharts library (BarChart, Bar, XAxis, YAxis, Tooltip, Legend)
  - Responsive design
- [ ] 14.3 Create `PerformanceMetrics` component (`components/admin/analytics/PerformanceMetrics.tsx`):
  - Table of driver/guide performance
  - Columns: name, total_trips, average_rating, revenue_generated
  - Sortable columns
- [ ] 14.4 Create analytics page: `app/(admin)/admin/analytics/page.tsx`

---

## F15: Admin User Management Pages
**Source:** Combined Task 32

- [ ] 15.1 Create `AdminUserList` component (`components/admin/users/AdminUserList.tsx`):
  - Fetch admin users from GET /v1/admin/users
  - Data table with columns: name, email, admin_role, permissions, is_active
  - Add Edit Role and Deactivate actions
  - Only accessible to SUPER_ADMIN role
- [ ] 15.2 Create `AdminUserForm` component (`components/admin/users/AdminUserForm.tsx`):
  - Form for creating/editing admin users
  - Fields: email, name, admin_role (dropdown), permissions (checkboxes)
  - Role-based permission presets
  - Submit to POST/PATCH /v1/admin/users
- [ ] 15.3 Create admin user page:
  - `app/(admin)/admin/users/page.tsx` with AdminUserList
  - Add loading and error states
  - Restrict access to SUPER_ADMIN only

---

## F16: Audit Log Viewer Page
**Source:** Combined Task 33

- [ ] 16.1 Create `AuditLogViewer` component (`components/admin/audit/AuditLogViewer.tsx`):
  - Fetch audit logs from GET /v1/admin/audit-logs
  - Data table with columns: timestamp, admin_user, action_type, resource_type, affected_resource_id
  - Filters: date range, admin_user, action_type
  - Add expandable rows showing changed_fields JSON
  - Add export button calling GET /v1/admin/audit-logs/export
- [ ] 16.2 Create audit log page:
  - `app/(admin)/admin/audit-logs/page.tsx` with AuditLogViewer
  - Add loading and error states
  - Restrict access to SUPER_ADMIN only

---

## F17: WebSocket Integration
**Source:** Combined Task 34

- [ ] 17.1 Enhance `useAdminWebSocket` hook (`hooks/useAdminWebSocket.ts`):
  - Connection status UI indicator in top bar
  - Reconnect with exponential backoff (10s, 20s, 40s, max 60s)
  - Subscribe to all event types: DRIVER_STATUS_UPDATE, BOOKING_CREATED, EMERGENCY_ALERT, DRIVER_ASSIGNMENT
- [ ] 17.2 Integrate WebSocket in AdminLayout:
  - Display connection status indicator in top bar
  - Show reconnecting message when connection lost
- [ ] 17.3 Implement real-time updates in components:
  - Update DriverList when DRIVER_STATUS_UPDATE received
  - Update BookingList when BOOKING_CREATED received
  - Show urgent notification when EMERGENCY_ALERT received
  - Update dashboard metrics when events received
  - Use React Query cache invalidation for data refresh

---


---

## F18: AI Monitoring Page
**Source:** Combined Task 19 (AI requirement)

- [ ] 18.1 Create AI Monitoring page: `app/(admin)/admin/ai-monitoring/page.tsx`
  - Display AI-assisted booking flag in booking list
  - Filter bookings by metadata.ai_assisted
  - Display AI session_id from booking metadata
  - View session conversation history from GET /v1/admin/ai-sessions/:sessionId
  - Show AI booking success rate
  - Display validation error details from metadata
  - Allow manual correction via PATCH /v1/admin/bookings/:id

---

## F20: Telegram Admin Pages
**Source:** Telegram design.md

- [ ] 20.1 Create Telegram Broadcast page: `app/(admin)/admin/telegram/broadcast/page.tsx`
  - `BroadcastComposer` component:
    - Message editor with rich text
    - Image upload for broadcast
    - Audience selector: All Drivers, Online Only, Offline, By Vehicle Type (VAN/BUS/TUK_TUK)
    - Preview before send
    - Send button calling POST /v1/admin/telegram/broadcast
  - `BroadcastHistory` component:
    - Table with columns: timestamp, message, target, sent, failed, status
    - Delivery status tracking
- [ ] 20.2 Create Telegram Analytics page: `app/(admin)/admin/telegram/analytics/page.tsx`
  - Metrics: total registered drivers, active drivers (24h), avg response time, command usage
  - Charts: daily active drivers (line), command usage (pie), assignment acceptance rate (bar)
- [ ] 20.3 Create Support Tickets page: `app/(admin)/admin/telegram/support/page.tsx`
  - Real-time ticket notifications via WebSocket
  - Status and priority filters
  - Ticket assignment to support agents

---

## F21: Frontend Testing
**Source:** Combined Task 38

- [ ] 21.1 Test DriverList component with real-time updates
- [ ] 21.2 Test BookingDetailView with driver assignment
- [ ] 21.3 Test EmergencyAlertList with notifications
- [ ] 21.4 Test AdminLayout with role-based navigation
- [ ] 21.5 Use React Testing Library and Jest

---

## F22: Documentation
**Source:** Combined Task 39

- [ ] 22.1 Write admin panel user guide
- [ ] 22.2 Write Telegram bot onboarding guide for drivers
