# Backend Tasks — DerLg System Admin Panel

> Source: `/docs/specs/system-admin/combined.md` + `/docs/specs/telegram/requirements.md` + `/docs/specs/telegram/design.md`
> Status: **All tasks pending (⬜)** — backend is an empty NestJS scaffold with no Prisma models, no modules, no controllers, no services.

---

## B1: Database Schema Extensions
**Source:** Combined Task 1

- [ ] 1.1 Add new Prisma models for admin functionality:
  - `Driver` — id, driver_id, driver_name, telegram_id, phone, auth_pin, vehicle_id, status (AVAILABLE/UNAVAILABLE/BUSY), last_status_update, last_telegram_activity
  - `DriverAssignment` — id, driver_id, booking_id, vehicle_id, status (PENDING/ACCEPTED/REJECTED/COMPLETED/CANCELLED), assignment_timestamp, response_timestamp, trip_start_time, completion_timestamp, rejection_reason, telegram_notification_sent
  - `VehicleMaintenance` — id, vehicle_id, maintenance_type, scheduled_date, completion_date, maintenance_cost, maintenance_notes, status (SCHEDULED/IN_MAINTENANCE/COMPLETED)
  - `AdminUser` — id, user_id, admin_role (SUPER_ADMIN/OPERATIONS_MANAGER/SUPPORT_AGENT/FLEET_MANAGER), permissions (JSON), is_active
  - `SupportTicket` — id, ticket_id, driver_id, message, status, priority, assigned_to, resolved_at
  - `BroadcastMessage` — id, message_id, content, image_url, target_filter (JSONB), sent_by, status, sent_count, failed_count, completed_at
  - Enums: `DriverStatus`, `AssignmentStatus`, `TicketStatus`, `TicketPriority`, `BroadcastStatus`
  - Indexes: driver.status, driver.telegram_id, driver.vehicle_id, driver_assignment.driver_id, driver_assignment.booking_id, driver_assignment.status, vehicle_maintenance.vehicle_id, admin_user.user_id, support_tickets.driver_id, support_tickets.status, broadcast_messages.sent_by, broadcast_messages.status
- [ ] 1.2 Modify existing tables:
  - `emergency_alerts` — add `driver_id` column (FK to drivers.id)
- [ ] 1.3 Generate and apply Prisma migration: `npx prisma migrate dev --name add-admin-tables`

---

## B2: Admin Module Setup
**Source:** Combined Task 2

- [ ] 2.1 Create `AdminModule` structure:
  - `src/admin/admin.module.ts`
  - `src/admin/controllers/` — 13 controller files
  - `src/admin/services/` — 13 service files
  - `src/admin/dto/` — all admin DTOs
  - `src/admin/guards/` — `admin-role.guard.ts`
  - `src/admin/websocket/` — `admin-gateway.ts`
- [ ] 2.2 Implement `AdminRoleGuard`:
  - Check `user.role` is ADMIN or SUPPORT
  - Query `admin_users` table for `admin_role` and `permissions`
  - Implement `@AdminRoles()` decorator for role-based access
  - Cache admin permissions in Redis with 5-minute TTL

---

## B3: Auth & Session

- [ ] 3.1 JWT authentication with httpOnly cookies
- [ ] 3.2 Token refresh endpoint (`POST /v1/auth/refresh`) — 15-min access token expiry
- [ ] 3.3 Admin role verification on login
- [ ] 3.4 Redis caching for admin permissions

---

## B4: Driver Management API (`/v1/admin/drivers`)
**Source:** Combined Task 3

- [ ] 4.1 Implement `AdminDriversService`:
  - `getAllDrivers()` — with status filter and pagination
  - `getDriverById()` — with vehicle and assignment details
  - `createDriver()` — validating telegram_id uniqueness
  - `updateDriver()` — with status change logging
  - `deactivateDriver()` — set status to OFFLINE
  - Publish driver status changes to Redis channel `driver_status_changed:{driver_id}`
- [ ] 4.2 Create `AdminDriversController`:
  - `GET /v1/admin/drivers` — query params: status, page, limit
  - `GET /v1/admin/drivers/:id`
  - `POST /v1/admin/drivers` — with `CreateDriverDto` validation
  - `PATCH /v1/admin/drivers/:id` — with `UpdateDriverDto` validation
  - Apply `@AdminRoles(FLEET_MANAGER, OPERATIONS_MANAGER, SUPER_ADMIN)` guard
  - Create audit log entries for all driver modifications
- [ ] 4.3 Create driver DTOs:
  - `CreateDriverDto`: driver_name, driver_id, telegram_id, phone, vehicle_id
  - `UpdateDriverDto`: partial fields from CreateDriverDto plus status
  - `DriverResponseDto`: all driver fields plus vehicle details and assignment count

---

## B5: Vehicle Fleet API (`/v1/admin/vehicles`)
**Source:** Combined Task 4

- [ ] 5.1 Implement `AdminVehiclesService`:
  - `getAllVehicles()` — with category and tier filters
  - `getVehicleById()` — with assigned driver and maintenance history
  - `createVehicle()` — with image upload to Supabase Storage
  - `updateVehicle()` — with price change audit logging
  - `getVehicleAvailability()` — checking driver status and maintenance
- [ ] 5.2 Create `AdminVehiclesController`:
  - `GET /v1/admin/vehicles` — query params: category, tier, search
  - `GET /v1/admin/vehicles/:id`
  - `POST /v1/admin/vehicles` — with `CreateVehicleDto` validation
  - `PATCH /v1/admin/vehicles/:id` — with `UpdateVehicleDto` validation
  - Apply `@AdminRoles(FLEET_MANAGER, OPERATIONS_MANAGER, SUPER_ADMIN)` guard
- [ ] 5.3 Create vehicle DTOs:
  - `CreateVehicleDto`: name, category, capacity, tier, price_per_day, price_per_km, features, images
  - `UpdateVehicleDto`: partial fields from CreateVehicleDto
  - `VehicleResponseDto`: all vehicle fields plus assigned_driver and maintenance_status

---

## B6: Vehicle Maintenance API (`/v1/admin/maintenance`)
**Source:** Combined Task 5

- [ ] 6.1 Implement `AdminMaintenanceService`:
  - `getMaintenanceSchedule()` — with date range filter
  - `scheduleMaintenance()` — creating VehicleMaintenance record
  - `updateMaintenanceStatus()` — with status transitions
  - `getMaintenanceHistory()` — for specific vehicle
  - `getUpcomingMaintenance()` — for reminders (within 3 days)
  - Prevent vehicle assignment when status is IN_MAINTENANCE
- [ ] 6.2 Create `AdminMaintenanceController`:
  - `GET /v1/admin/maintenance` — query params: vehicle_id, start_date, end_date
  - `POST /v1/admin/maintenance` — with `ScheduleMaintenanceDto`
  - `PATCH /v1/admin/maintenance/:id` — with `UpdateMaintenanceDto`
  - `GET /v1/admin/maintenance/upcoming`
  - Apply `@AdminRoles(FLEET_MANAGER, OPERATIONS_MANAGER, SUPER_ADMIN)` guard
- [ ] 6.3 Create maintenance DTOs:
  - `ScheduleMaintenanceDto`: vehicle_id, maintenance_type, scheduled_date, maintenance_notes
  - `UpdateMaintenanceDto`: status, completion_date, maintenance_cost, maintenance_notes
  - `MaintenanceResponseDto`: all fields plus vehicle details

---

## B7: Driver Assignment API (`/v1/admin/assignments`)
**Source:** Combined Task 6

- [ ] 7.1 Implement `AdminAssignmentsService`:
  - `assignDriver()` — validating driver status is AVAILABLE
  - Verify vehicle capacity matches booking passenger count
  - Update driver status to BUSY after assignment
  - Create DriverAssignment record with assignment_timestamp
  - `completeAssignment()` — updating driver status to AVAILABLE
  - Publish assignment events to Redis channel `driver_assignments`
- [ ] 7.2 Create `AdminAssignmentsController`:
  - `POST /v1/admin/assignments` — with `AssignDriverDto` validation
  - `PATCH /v1/admin/assignments/:id/complete`
  - `GET /v1/admin/assignments` — query params: driver_id, booking_id
  - Apply `@AdminRoles(OPERATIONS_MANAGER, FLEET_MANAGER, SUPER_ADMIN)` guard
  - Return 409 Conflict if driver is not AVAILABLE
- [ ] 7.3 Create assignment DTOs:
  - `AssignDriverDto`: driver_id, booking_id, vehicle_id
  - `AssignmentResponseDto`: all fields plus driver, booking, and vehicle details

---

## B8: Booking Operations API (`/v1/admin/bookings`)
**Source:** Combined Task 8

- [ ] 8.1 Implement `AdminBookingsService`:
  - `getAllBookings()` — with filters: booking_type, status, date_range, user_email
  - `getBookingById()` — with full details (trip, hotel, vehicle, guide, payment)
  - `updateBooking()` — for modifications
  - `cancelBooking()` — updating status and processing refund
  - `getUnassignedBookings()` — for pending driver assignments
- [ ] 8.2 Create `AdminBookingsController`:
  - `GET /v1/admin/bookings` — query params: booking_type, status, start_date, end_date, search
  - `GET /v1/admin/bookings/:id`
  - `PATCH /v1/admin/bookings/:id` — with `UpdateBookingDto`
  - `POST /v1/bookings/:id/cancel`
  - Apply `@AdminRoles(SUPPORT_AGENT, OPERATIONS_MANAGER, SUPER_ADMIN)` guard
- [ ] 8.3 Create booking admin DTOs:
  - `UpdateBookingDto`: travel_date, end_date, num_adults, num_children, customizations
  - `BookingDetailResponseDto`: all booking fields plus related entities

---

## B9: Hotel Inventory API (`/v1/admin/hotels`)
**Source:** Combined Task 9

- [ ] 9.1 Implement `AdminHotelsService`:
  - `getAllHotels()` — with pagination
  - `getHotelById()` — with rooms
  - `createHotel()` — with image upload
  - `updateHotel()`
  - `getHotelRooms()`
  - `createRoom()`
  - `updateRoom()`
  - `getRoomAvailability()` — checking bookings table for overlaps
- [ ] 9.2 Create `AdminHotelsController`:
  - `GET /v1/admin/hotels`
  - `GET /v1/admin/hotels/:id`
  - `POST /v1/admin/hotels` — with `CreateHotelDto`
  - `PATCH /v1/admin/hotels/:id` — with `UpdateHotelDto`
  - `GET /v1/admin/hotels/:id/rooms`
  - `POST /v1/admin/hotels/:id/rooms` — with `CreateRoomDto`
  - `PATCH /v1/admin/hotels/:hotelId/rooms/:roomId` — with `UpdateRoomDto`
  - Apply `@AdminRoles(OPERATIONS_MANAGER, SUPER_ADMIN)` guard
- [ ] 9.3 Create hotel admin DTOs:
  - `CreateHotelDto`, `UpdateHotelDto`, `CreateRoomDto`, `UpdateRoomDto`

---

## B10: Tour Guide API (`/v1/admin/guides`)
**Source:** Combined Task 10

- [ ] 10.1 Implement `AdminGuidesService`:
  - `getAllGuides()` — with language and specialty filters
  - `getGuideById()` — with assignments and performance metrics
  - `createGuide()` — with profile picture upload
  - `updateGuide()`
  - `getGuideAssignments()` — from bookings table
  - `getGuideAvailability()` — checking overlapping bookings
- [ ] 10.2 Create `AdminGuidesController`:
  - `GET /v1/admin/guides` — query params: languages, specialties
  - `GET /v1/admin/guides/:id`
  - `POST /v1/admin/guides` — with `CreateGuideDto`
  - `PATCH /v1/admin/guides/:id` — with `UpdateGuideDto`
  - Apply `@AdminRoles(OPERATIONS_MANAGER, SUPER_ADMIN)` guard
- [ ] 10.3 Create guide admin DTOs:
  - `CreateGuideDto`, `UpdateGuideDto`, `GuideResponseDto`

---

## B11: Emergency Alert API (`/v1/admin/emergency`)
**Source:** Combined Task 11

- [ ] 11.1 Implement `AdminEmergencyService`:
  - `getAllEmergencyAlerts()` — with status and type filters
  - `getEmergencyAlertById()` — with user and booking details
  - `acknowledgeAlert()` — updating status to ACKNOWLEDGED
  - `resolveAlert()` — updating status to RESOLVED with notes
  - Publish emergency events to Redis channel `emergency_alerts`
- [ ] 11.2 Create `AdminEmergencyController`:
  - `GET /v1/admin/emergency` — query params: status, alert_type
  - `GET /v1/admin/emergency/:id`
  - `PATCH /v1/admin/emergency/:id` — with `UpdateEmergencyDto`
  - Apply `@AdminRoles(OPERATIONS_MANAGER, SUPER_ADMIN)` guard
- [ ] 11.3 Create emergency admin DTOs:
  - `UpdateEmergencyDto`, `EmergencyDetailResponseDto`

---

## B12: Customer Support API (`/v1/admin/customers`)
**Source:** Combined Task 12

- [ ] 12.1 Implement `AdminCustomersService`:
  - `getAllCustomers()` — with search filters (name, email, phone)
  - `getCustomerById()` — with booking history and loyalty transactions
  - `getCustomerReviews()` — from reviews table
  - `adjustLoyaltyPoints()` — updating users.loyalty_points and creating transaction
- [ ] 12.2 Create `AdminCustomersController`:
  - `GET /v1/admin/customers` — query params: search, page, limit
  - `GET /v1/admin/customers/:id`
  - `POST /v1/admin/loyalty/adjust` — with `AdjustLoyaltyDto`
  - Apply `@AdminRoles(SUPPORT_AGENT, OPERATIONS_MANAGER, SUPER_ADMIN)` guard
- [ ] 12.3 Create customer admin DTOs:
  - `CustomerResponseDto`, `AdjustLoyaltyDto`

---

## B13: Discount Code API (`/v1/admin/discounts`)
**Source:** Combined Task 13

- [ ] 13.1 Implement `AdminDiscountsService`:
  - `getAllDiscountCodes()`
  - `createDiscountCode()` — validating code uniqueness
  - `updateDiscountCode()`
  - `deactivateDiscountCode()` — setting is_active to false
  - `getAllStudentVerifications()` — with status filter
  - `reviewStudentVerification()` — updating status and users.is_student
- [ ] 13.2 Create `AdminDiscountsController`:
  - `GET /v1/admin/discounts`
  - `POST /v1/admin/discounts` — with `CreateDiscountCodeDto`
  - `PATCH /v1/admin/discounts/:id` — with `UpdateDiscountCodeDto`
  - `GET /v1/admin/student-verifications` — query param: status
  - `PATCH /v1/admin/student-verifications/:id` — with `ReviewStudentVerificationDto`
  - Apply `@AdminRoles(OPERATIONS_MANAGER, SUPER_ADMIN)` guard
- [ ] 13.3 Create discount admin DTOs:
  - `CreateDiscountCodeDto`, `UpdateDiscountCodeDto`, `ReviewStudentVerificationDto`

---

## B14: Analytics & Reporting API (`/v1/admin/analytics`)
**Source:** Combined Task 14

- [ ] 14.1 Implement `AdminAnalyticsService`:
  - `getRevenueAnalytics()` — aggregating bookings by booking_type
  - `getBookingStatistics()` — with counts by status
  - `getDriverPerformance()` — aggregating assignments and reviews
  - `getPopularDestinations()` — from bookings and trips
  - `getHotelOccupancy()` — calculating occupancy rate
  - `getGuideUtilization()` — calculating utilization percentage
  - `exportData()` — generating CSV/JSON files
  - `getAIPerformance()` — for AI-assisted booking metrics
- [ ] 14.2 Create `AdminAnalyticsController`:
  - `GET /v1/admin/analytics/revenue` — query params: start_date, end_date
  - `GET /v1/admin/analytics/bookings`
  - `GET /v1/admin/analytics/drivers`
  - `GET /v1/admin/analytics/ai-bookings`
  - `GET /v1/admin/analytics/ai-performance`
  - `GET /v1/admin/analytics/export` — format param (CSV or JSON)
  - Apply `@AdminRoles(SUPER_ADMIN, OPERATIONS_MANAGER)` guard
- [ ] 14.3 Create analytics DTOs:
  - `RevenueAnalyticsDto`, `BookingStatisticsDto`, `DriverPerformanceDto`

---

## B15: Admin User Management API (`/v1/admin/users`)
**Source:** Combined Task 15

- [ ] 15.1 Implement `AdminUsersService`:
  - `getAllAdminUsers()` — joining users and admin_users tables
  - `createAdminUser()` — creating user with role ADMIN and admin_users record
  - `updateAdminRole()` — updating admin_role and permissions
  - `deactivateAdminUser()` — setting is_active to false and incrementing token_version
  - Cache admin permissions in Redis with 5-minute TTL
- [ ] 15.2 Create `AdminUsersController`:
  - `GET /v1/admin/users`
  - `POST /v1/admin/users` — with `CreateAdminUserDto`
  - `PATCH /v1/admin/users/:id` — with `UpdateAdminUserDto`
  - Apply `@AdminRoles(SUPER_ADMIN)` guard
- [ ] 15.3 Create admin user DTOs:
  - `CreateAdminUserDto`, `UpdateAdminUserDto`, `AdminUserResponseDto`

---

## B16: Audit Logging API (`/v1/admin/audit-logs`)
**Source:** Combined Task 16

- [ ] 16.1 Implement `AdminAuditService`:
  - `getAllAuditLogs()` — with filters (date_range, admin_user_id, action_type)
  - `createAuditLog()` — for manual audit entries
  - `exportAuditLogs()` — generating CSV file
  - Implement automatic audit logging in `AuditInterceptor` for sensitive operations
- [ ] 16.2 Create `AdminAuditController`:
  - `GET /v1/admin/audit-logs` — query params: start_date, end_date, admin_user_id, action_type
  - `GET /v1/admin/audit-logs/export`
  - Apply `@AdminRoles(SUPER_ADMIN)` guard
- [ ] 16.3 Create audit DTOs:
  - `AuditLogResponseDto`, `AuditLogFilterDto`

---

## B17: Dashboard Overview API (`/v1/admin/dashboard`)
**Source:** Combined Task 17

- [ ] 17.1 Implement `AdminDashboardService`:
  - `getDashboardOverview()` — aggregating multiple metrics
  - Calculate total_bookings_today, total_revenue_today, active_drivers_count
  - Get booking_trends for past 30 days
  - Get pending_actions (unassigned bookings, upcoming maintenance)
  - Get recent_emergency_alerts
  - Get driver_availability_summary
  - Get upcoming_bookings for next 24 hours
- [ ] 17.2 Create `AdminDashboardController`:
  - `GET /v1/admin/dashboard`
  - Apply `@AdminRoles(all roles)` guard
  - Return different metrics based on admin role
- [ ] 17.3 Create dashboard DTOs:
  - `DashboardOverviewDto`, `BookingTrendDto`, `PendingActionDto`

---

## B18: Data Export & Backup API
**Source:** Combined Task 18

- [ ] 18.1 Implement `AdminExportService`:
  - `exportBookings()` — generating CSV/JSON file
  - `exportDrivers()` — with performance metrics
  - `exportPayments()` — with encryption for sensitive data
  - `triggerBackup()` — creating Supabase database dump
  - Store backup metadata in backups table
  - Implement AES-256 encryption for sensitive exports
- [ ] 18.2 Create `AdminExportController`:
  - `GET /v1/admin/export/bookings` — query params: start_date, end_date, format
  - `GET /v1/admin/export/drivers`
  - `GET /v1/admin/export/payments`
  - `POST /v1/admin/backup`
  - `GET /v1/admin/backups`
  - Apply `@AdminRoles(SUPER_ADMIN)` guard
- [ ] 18.3 Create export DTOs:
  - `ExportRequestDto`, `BackupResponseDto`

---

## B19: AI Monitoring API
**Source:** Combined Task 19

- [ ] 19.1 Implement `AdminAIMonitoringService`:
  - `getAIAssistedBookings()` — filtering by metadata.ai_assisted
  - `getAISessionDetails()` — retrieving conversation from Redis (7-day TTL)
  - `getAIBookingSuccessRate()` — calculating success percentage
  - `getAIPerformanceMetrics()` — average booking time and satisfaction
- [ ] 19.2 Create `AdminAIMonitoringController`:
  - `GET /v1/admin/ai-sessions/:sessionId`
  - Apply `@AdminRoles(OPERATIONS_MANAGER, SUPER_ADMIN)` guard
  - Return "Session expired" if Redis TTL expired

---

## B20: WebSocket Gateway (`/v1/admin/ws`)
**Source:** Combined Task 20

- [ ] 20.1 Implement `AdminGateway`:
  - WebSocket gateway at `/v1/admin/ws`
  - JWT authentication for WebSocket connections
  - Subscribe to Redis channels: admin_events, driver_status_changed:*, emergency_alerts, driver_assignments
  - Broadcast events to connected admin clients
  - Implement room-based broadcasting by admin role
  - Handle connection/disconnection events
- [ ] 20.2 Implement Redis pub/sub integration:
  - Create `RedisService` with publish() and subscribe() methods
  - Publish driver status changes to driver_status_changed:{driver_id}
  - Publish booking events to admin_events channel
  - Publish emergency alerts to emergency_alerts channel
  - Publish driver assignments to driver_assignments channel
- [ ] 20.3 Create WebSocket event DTOs:
  - `DriverStatusUpdateEvent`, `BookingCreatedEvent`, `EmergencyAlertEvent`, `DriverAssignmentEvent`

---

## B21: Telegram Webhook API
**Source:** Combined Task 7 + Telegram specs

- [ ] 21.1 Create Telegram module:
  - `src/telegram/telegram.module.ts`
  - `src/telegram/telegram.controller.ts` — webhook endpoint
  - `src/telegram/telegram.service.ts`
- [ ] 21.2 Implement `TelegramService`:
  - `handleDriverStatusUpdate()` — parse telegram_id, vehicle_id, driver_name, status
  - Update or create Driver record in database
  - Set last_status_update to current timestamp
  - Publish status change to Redis channel `driver_status_changed:{driver_id}`
  - Create audit log entry for status change
- [ ] 21.3 Create `TelegramController`:
  - `POST /v1/telegram/driver-status` — webhook endpoint
  - Validate webhook signature
  - Parse payload: telegram_id, vehicle_id, driver_name, status
  - Call `TelegramService.handleDriverStatusUpdate()`
  - Return 200 OK with confirmation message
- [ ] 21.4 Create telegram DTOs:
  - `DriverStatusWebhookDto`: telegram_id, vehicle_id, driver_name, status

---

## B22: Telegram Bot Full Module
**Source:** Telegram specs

- [ ] 22.1 Telegram webhook handler:
  - `POST /v1/telegram/webhook` — receive updates, secret token validation, async Bull processing
  - Rate limiting: 30 req/min per telegram_id via Redis
  - Idempotency via update_id deduplication
- [ ] 22.2 Driver registration endpoint:
  - `POST /v1/telegram/register` — telegram_id, driver_id, pin
  - Verify driver_id exists and pin matches (bcrypt)
  - Update drivers.telegram_id
  - Store mapping in Redis: `telegram_driver:{telegram_id}` (30d TTL)
  - Create audit_logs record: action_type DRIVER_TELEGRAM_REGISTERED
- [ ] 22.3 Driver status endpoints:
  - `POST /v1/telegram/status` — telegram_id, status (AVAILABLE/UNAVAILABLE)
  - `GET /v1/telegram/driver-info` — query: telegram_id
  - Block offline if active assignments exist (409 Conflict)
  - Publish to Redis, create audit log
- [ ] 22.4 Trip assignment endpoints:
  - `GET /v1/telegram/assignments/active` — query: telegram_id
  - `POST /v1/telegram/assignments/:id/accept`
  - `POST /v1/telegram/assignments/:id/reject` — with optional reason
  - `POST /v1/telegram/assignments/:id/start`
  - `POST /v1/telegram/assignments/:id/complete`
  - Auto-reject after 5 minutes (Bull queue)
  - Notify Admin Panel via WebSocket on reject
- [ ] 22.5 Trip history & earnings endpoints:
  - `GET /v1/telegram/assignments/history` — query: telegram_id, limit, offset
  - `GET /v1/telegram/earnings/today`
  - `GET /v1/telegram/earnings/week`
- [ ] 22.6 Location endpoint:
  - `POST /v1/telegram/location` — telegram_id, latitude, longitude
  - Store in Redis: `driver_location:{driver_id}` (5-min TTL)
  - Publish to `driver_location_updated:{driver_id}`
- [ ] 22.7 Emergency & support endpoints:
  - `POST /v1/telegram/emergency` — telegram_id, location
  - `POST /v1/telegram/support` — telegram_id, message
  - Create emergency_alerts / support_tickets records
  - Notify Admin Panel via WebSocket
- [ ] 22.8 Settings endpoint:
  - `PATCH /v1/telegram/settings` — telegram_id, settings
- [ ] 22.9 Broadcast endpoints:
  - `POST /v1/admin/telegram/broadcast` — message, image_url, target_filter
  - `GET /v1/admin/telegram/broadcasts`
  - Queue in Bull, send at 30 msg/sec
  - Track sent_count / failed_count
- [ ] 22.10 Telegram module folder structure:
  - `handlers/`: command.handler.ts, callback.handler.ts, location.handler.ts, message.handler.ts
  - `dto/`: webhook-update.dto.ts, register-driver.dto.ts, status-update.dto.ts, assignment-action.dto.ts, location-update.dto.ts, broadcast-message.dto.ts
  - `guards/`: telegram-auth.guard.ts, webhook-secret.guard.ts
  - `jobs/`: broadcast.processor.ts, assignment-timeout.processor.ts, location-cleanup.processor.ts
  - `locales/`: en.json, km.json, zh.json

---

## B23: Backend Testing
**Source:** Combined Task 38

- [ ] 23.1 Unit tests for backend services (Jest with mocked Prisma client):
  - AdminDriversService, AdminVehiclesService, AdminBookingsService, AdminAssignmentsService
  - TelegramService webhook handling
- [ ] 23.2 Integration tests for backend endpoints (supertest):
  - Admin authentication and authorization
  - Driver management endpoints
  - Vehicle and maintenance endpoints
  - Booking operations endpoints
  - WebSocket gateway
