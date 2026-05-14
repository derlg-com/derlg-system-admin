# Backend Tasks — DerLg System Admin Panel

> Source: `/docs/specs/system-admin/combined.md` + `/docs/specs/telegram/requirements.md` + `/docs/specs/telegram/design.md`
> Status: **B1–B23 Complete** — All backend tasks implemented: database schema, admin module, auth & session, drivers, vehicles, maintenance, assignments, bookings, hotels, guides, emergency, customer support, discount code, analytics, admin user management, audit logging, dashboard, export/backup, AI monitoring, WebSocket gateway, Telegram webhook, full Telegram bot module with Bull queues, handlers, guards, processors, and locales, plus comprehensive backend testing. 345 unit tests + 33 e2e tests passing. Build compiles cleanly.

---

## B1: Database Schema Extensions
**Source:** Combined Task 1

- [x] 1.1 Add new Prisma models for admin functionality:
  - `Driver` — id, driver_id, driver_name, telegram_id, phone, auth_pin, vehicle_id, status (AVAILABLE/UNAVAILABLE/BUSY), last_status_update, last_telegram_activity
  - `DriverAssignment` — id, driver_id, booking_id, vehicle_id, status (PENDING/ACCEPTED/REJECTED/COMPLETED/CANCELLED), assignment_timestamp, response_timestamp, trip_start_time, completion_timestamp, rejection_reason, telegram_notification_sent
  - `VehicleMaintenance` — id, vehicle_id, maintenance_type, scheduled_date, completion_date, maintenance_cost, maintenance_notes, status (SCHEDULED/IN_MAINTENANCE/COMPLETED)
  - `AdminUser` — id, user_id, admin_role (SUPER_ADMIN/OPERATIONS_MANAGER/SUPPORT_AGENT/FLEET_MANAGER), permissions (JSON), is_active
  - `SupportTicket` — id, ticket_id, driver_id, message, status, priority, assigned_to, resolved_at
  - `BroadcastMessage` — id, message_id, content, image_url, target_filter (JSONB), sent_by, status, sent_count, failed_count, completed_at
  - Enums: `DriverStatus`, `AssignmentStatus`, `TicketStatus`, `TicketPriority`, `BroadcastStatus`
  - Indexes: driver.status, driver.telegram_id, driver.vehicle_id, driver_assignment.driver_id, driver_assignment.booking_id, driver_assignment.status, vehicle_maintenance.vehicle_id, admin_user.user_id, support_tickets.driver_id, support_tickets.status, broadcast_messages.sent_by, broadcast_messages.status
- [x] 1.2 Modify existing tables:
  - `emergency_alerts` — add `driver_id` column (FK to drivers.id)
- [x] 1.3 Generate and apply Prisma migration: SQL diff generated and applied via `prisma db execute`. Migration recorded in `_prisma_migrations` table.

---

## B2: Admin Module Setup
**Source:** Combined Task 2

- [x] 2.1 Create `AdminModule` structure:
  - `src/admin/admin.module.ts` — 16 controllers, 16 services, guards, WebSocket gateway wired
  - `src/admin/controllers/` — 16 controller files (dashboard, drivers, vehicles, maintenance, assignments, bookings, hotels, guides, emergency, customers+loyalty, discounts+verifications, analytics, users, audit, export, ai-monitoring)
  - `src/admin/services/` — 16 service files with Prisma queries
  - `src/admin/dto/` — 15 DTO files (create/update for drivers, vehicles, maintenance, assignments, bookings, hotels, rooms, guides, emergency, loyalty, discounts, verifications, admin users, exports)
  - `src/admin/guards/` — `admin.guard.ts` + `admin-role.guard.ts`
  - `src/admin/websocket/` — `admin.gateway.ts` with Redis pub/sub subscriptions
- [x] 2.2 Implement `AdminRoleGuard`:
  - `AdminGuard` checks `user.role` is `admin` or `support`
  - `AdminRoleGuard` queries `admin_users` table for `admin_role` and `permissions`
  - `@AdminRoles()` decorator sets required roles on handlers/classes
  - Redis cache with 5-minute TTL (`admin:permissions:{userId}`)
  - SUPER_ADMIN bypasses all specific role checks
  - Graceful fallback to DB when Redis is unavailable
  - `request.adminUser` attached for downstream use

---

## B3: Auth & Session

- [x] 3.1 JWT authentication with httpOnly cookies
  - `POST /v1/auth/login` — validates email/password, issues access token + refresh token cookie
  - `POST /v1/auth/logout` — revokes refresh token, clears httpOnly cookie
  - Cookie settings: `httpOnly`, `sameSite: 'strict'`, `secure` in production, 7-day TTL
- [x] 3.2 Token refresh endpoint (`POST /v1/auth/refresh`) — 15-min access token expiry
  - Reads `refresh_token` from httpOnly cookie
  - Validates against `refresh_tokens` table (not revoked, not expired)
  - Re-verifies admin status before issuing new 15-min access token
  - Returns new access token in response body
- [x] 3.3 Admin role verification on login
  - Queries `users` table by email (case-insensitive)
  - Verifies password via `auth.users.encrypted_password` (raw SQL) with bcrypt.compare
  - Checks `user.role` is `admin` or `support`
  - Checks `admin_users` record exists and `isActive = true`
  - Returns user profile with `adminRole` in login response
- [x] 3.4 Redis caching for admin permissions
  - `AuthService` caches admin permissions on login and refresh (`admin:permissions:{userId}`, 5-min TTL)
  - `AuthService` clears Redis cache on logout
  - `AdminRoleGuard` reads from cache first, falls back to DB (already implemented in B2)
- [x] 3.5 Tests
  - Unit tests: `auth.service.spec.ts` (13 tests) — login, refresh, logout, error cases
  - Unit tests: `auth.controller.spec.ts` (3 tests) — endpoint behavior, cookie handling
  - E2E tests: `test/auth.e2e-spec.ts` (7 tests) — full request/response cycle with validation
  - All 17 unit tests + 8 e2e tests passing
  - Build compiles cleanly

---

## B4: Driver Management API (`/v1/admin/drivers`)
**Source:** Combined Task 3

- [x] 4.1 Implement `AdminDriversService`:
  - `getAllDrivers()` — status filter, search (name/driverId/phone), pagination with meta
  - `getDriverById()` — driver with vehicle details (from transportation_vehicles) and assignment count
  - `createDriver()` — validates telegram_id uniqueness, auto-generates 6-digit auth PIN, defaults status to OFFLINE
  - `updateDriver()` — validates telegram_id uniqueness on change, updates lastStatusUpdate on status change, publishes to Redis
  - `deactivateDriver()` — sets status to OFFLINE, publishes status change to Redis
  - Publishes driver status changes to `driver_status_changed:{driver_id}` via Redis
  - `createAuditLog()` helper for audit trail entries
- [x] 4.2 Create `AdminDriversController`:
  - `GET /v1/admin/drivers` — query params: status, search, page, limit
  - `GET /v1/admin/drivers/:id`
  - `POST /v1/admin/drivers` — `CreateDriverDto` with class-validator
  - `PATCH /v1/admin/drivers/:id` — `UpdateDriverDto` with class-validator
  - `PATCH /v1/admin/drivers/:id/deactivate` — dedicated deactivation endpoint
  - `@AdminRoles(FLEET_MANAGER, OPERATIONS_MANAGER, SUPER_ADMIN)` guard applied
  - Audit log entries created for CREATE_DRIVER, UPDATE_DRIVER, DEACTIVATE_DRIVER actions
- [x] 4.3 Create driver DTOs:
  - `CreateDriverDto`: driverName, driverId, telegramId, phone, vehicleId with validation decorators
  - `UpdateDriverDto`: extends PartialType(CreateDriverDto) + status enum validation
  - `DriverResponseDto`: all driver fields + vehicle details + assignmentCount
- [x] 4.4 Tests
  - Unit tests: `admin-drivers.service.spec.ts` (14 tests)
  - Unit tests: `admin-drivers.controller.spec.ts` (5 tests)
  - All 36 unit tests + 8 e2e tests passing
  - Build compiles cleanly

---

## B5: Vehicle Fleet API (`/v1/admin/vehicles`)
**Source:** Combined Task 4

- [x] 5.1 Implement `AdminVehiclesService`:
  - `getAllVehicles()` — category (vehicle_type) filter, search (name/license_plate), pagination with meta
  - `getVehicleById()` — vehicle with assigned driver (from drivers table) and maintenance history
  - `createVehicle()` — creates vehicle with validated DTO; images stored as URL array (Minio upload helper added for future direct upload)
  - `updateVehicle()` — price change triggers audit log entry (`PRICING_CHANGE` with old/new price)
  - `getVehicleAvailability()` — checks vehicle is_active, driver status AVAILABLE, no active maintenance
- [x] 5.2 Create `AdminVehiclesController`:
  - `GET /v1/admin/vehicles` — query params: category, search, page, limit
  - `GET /v1/admin/vehicles/:id`
  - `GET /v1/admin/vehicles/:id/availability` — availability status endpoint
  - `POST /v1/admin/vehicles` — `CreateVehicleDto` with class-validator
  - `PATCH /v1/admin/vehicles/:id` — `UpdateVehicleDto` with class-validator
  - `@AdminRoles(FLEET_MANAGER, OPERATIONS_MANAGER, SUPER_ADMIN)` guard applied
  - Audit log entries for CREATE_VEHICLE and UPDATE_VEHICLE actions
- [x] 5.3 Create vehicle DTOs:
  - `CreateVehicleDto`: name, vehicle_type, license_plate, capacity, pricing_model, price_usd, province, images with validation decorators
  - `UpdateVehicleDto`: extends PartialType(CreateVehicleDto)
  - `VehicleResponseDto`: all vehicle fields + assignedDriver + maintenanceStatus + maintenanceHistory
- [x] 5.4 Tests
  - Unit tests: `admin-vehicles.service.spec.ts` (12 tests)
  - Unit tests: `admin-vehicles.controller.spec.ts` (5 tests)
  - All 53 unit tests + 8 e2e tests passing
  - Build compiles cleanly

---

## B6: Vehicle Maintenance API (`/v1/admin/maintenance`)
**Source:** Combined Task 5

- [x] 6.1 Implement `AdminMaintenanceService`:
  - `getMaintenanceSchedule()` — date range filter, vehicle_id filter, pagination with meta
  - `scheduleMaintenance()` — validates vehicle exists, creates record with status SCHEDULED
  - `updateMaintenanceStatus()` — validates status transitions (SCHEDULED→IN_MAINTENANCE/COMPLETED, IN_MAINTENANCE→COMPLETED)
  - `getMaintenanceHistory()` — for specific vehicle with vehicle details
  - `getUpcomingMaintenance()` — returns maintenance scheduled within next 3 days
  - `isVehicleInMaintenance()` — helper to check if vehicle has active IN_MAINTENANCE record (for assignment prevention)
- [x] 6.2 Create `AdminMaintenanceController`:
  - `GET /v1/admin/maintenance` — query params: vehicle_id, start_date, end_date, page, limit
  - `GET /v1/admin/maintenance/upcoming` — upcoming maintenance reminders
  - `GET /v1/admin/maintenance/vehicle/:vehicleId` — maintenance history for specific vehicle
  - `POST /v1/admin/maintenance` — `ScheduleMaintenanceDto` with class-validator
  - `PATCH /v1/admin/maintenance/:id` — `UpdateMaintenanceDto` with class-validator
  - `@AdminRoles(FLEET_MANAGER, OPERATIONS_MANAGER, SUPER_ADMIN)` guard applied
  - Audit log entries for SCHEDULE_MAINTENANCE and UPDATE_MAINTENANCE_STATUS actions
- [x] 6.3 Create maintenance DTOs:
  - `ScheduleMaintenanceDto`: vehicleId, maintenanceType, scheduledDate, maintenanceNotes with validation
  - `UpdateMaintenanceDto`: status, completionDate, maintenanceCost, maintenanceNotes with validation
  - `MaintenanceResponseDto`: all fields plus vehicle details
- [x] 6.4 Tests
  - Unit tests: `admin-maintenance.service.spec.ts` (12 tests)
  - Unit tests: `admin-maintenance.controller.spec.ts` (5 tests)
  - All 70 unit tests + 8 e2e tests passing
  - Build compiles cleanly

---

## B7: Driver Assignment API (`/v1/admin/assignments`)
**Source:** Combined Task 6

- [x] 7.1 Implement `AdminAssignmentsService`:
  - `getAssignments()` — query by driver_id/booking_id, pagination, returns relations (driver, booking, vehicle)
  - `assignDriver()` — validates driver status is AVAILABLE, verifies vehicle capacity >= booking passenger_count, checks vehicle not in maintenance, creates assignment with PENDING status, updates driver to BUSY
  - `completeAssignment()` — validates assignment exists and not already completed, updates to COMPLETED with completionTimestamp, updates driver to AVAILABLE
  - Publishes `DRIVER_ASSIGNED` and `ASSIGNMENT_COMPLETED` events to Redis channel `driver_assignments`
- [x] 7.2 Create `AdminAssignmentsController`:
  - `GET /v1/admin/assignments` — query params: driver_id, booking_id, page, limit
  - `POST /v1/admin/assignments` — `AssignDriverDto` with class-validator (UUID validation)
  - `PATCH /v1/admin/assignments/:id/complete`
  - `@AdminRoles(FLEET_MANAGER, OPERATIONS_MANAGER, SUPER_ADMIN)` guard applied
  - Returns 409 Conflict when driver is not AVAILABLE, vehicle capacity insufficient, or vehicle in maintenance
  - Audit log entries for ASSIGN_DRIVER and COMPLETE_ASSIGNMENT actions
- [x] 7.3 Create assignment DTOs:
  - `AssignDriverDto`: driverId, bookingId, vehicleId with @IsUUID validation
  - `AssignmentResponseDto`: all fields plus driver, booking, and vehicle details
- [x] 7.4 Tests
  - Unit tests: `admin-assignments.service.spec.ts` (10 tests)
  - Unit tests: `admin-assignments.controller.spec.ts` (3 tests)
  - All 83 unit tests + 8 e2e tests passing
  - Build compiles cleanly

---

## B8: Booking Operations API (`/v1/admin/bookings`)
**Source:** Combined Task 8

- [x] 8.1 Implement `AdminBookingsService`:
  - `getAllBookings()` — with filters: booking_type, status, date_range, search (reference/user email/name)
  - `getBookingById()` — with full details (user, payments, booking_items, driver_assignment)
  - `updateBooking()` — for modifications, rejects updates to cancelled bookings
  - `cancelBooking()` — updates status to cancelled, cancels pending driver assignments
  - `getUnassignedBookings()` — bookings without active (PENDING/ACCEPTED) driver assignments
- [x] 8.2 Create `AdminBookingsController`:
  - `GET /v1/admin/bookings` — query params: booking_type, status, start_date, end_date, search, page, limit
  - `GET /v1/admin/bookings/unassigned` — query params: page, limit
  - `GET /v1/admin/bookings/:id`
  - `PATCH /v1/admin/bookings/:id` — with `UpdateBookingDto`
  - `POST /v1/admin/bookings/:id/cancel` — with optional cancel_reason
  - Apply `@AdminRoles(SUPPORT_AGENT, OPERATIONS_MANAGER, SUPER_ADMIN)` guard
  - Audit log entries for UPDATE_BOOKING and CANCEL_BOOKING actions
- [x] 8.3 Create booking admin DTOs:
  - `UpdateBookingDto`: start_date, end_date, passenger_count, room_count, status, cancel_reason with class-validator
  - `BookingDetailResponseDto`: all booking fields plus user, payments, booking_items, driver_assignment
- [x] 8.4 Tests
  - Unit tests: `admin-bookings.service.spec.ts` (12 tests)
  - Unit tests: `admin-bookings.controller.spec.ts` (6 tests)
  - All 101 unit tests + 8 e2e tests passing
  - Build compiles cleanly

---

## B9: Hotel Inventory API (`/v1/admin/hotels`)
**Source:** Combined Task 9

- [x] 9.1 Implement `AdminHotelsService`:
  - `getAllHotels()` — pagination with meta, includes English translation name and room count
  - `getHotelById()` — includes rooms, translations, and review count
  - `createHotel()` — creates hotel + English translation (name/address/description stored in `hotel_translations`)
  - `updateHotel()` — updates hotel fields and English translation
  - `getHotelRooms()` — list rooms for a hotel
  - `createRoom()` — creates room with validation that hotel exists
  - `updateRoom()` — updates room fields, validates room belongs to hotel
  - `getRoomAvailability()` — checks `booking_items` for overlapping non-cancelled bookings in date range
- [x] 9.2 Create `AdminHotelsController`:
  - `GET /v1/admin/hotels` — query params: search, page, limit
  - `GET /v1/admin/hotels/:id`
  - `POST /v1/admin/hotels` — with `CreateHotelDto`, audit log: CREATE_HOTEL
  - `PATCH /v1/admin/hotels/:id` — with `UpdateHotelDto`, audit log: UPDATE_HOTEL
  - `GET /v1/admin/hotels/:id/rooms`
  - `POST /v1/admin/hotels/:id/rooms` — with `CreateRoomDto`, audit log: CREATE_ROOM
  - `PATCH /v1/admin/hotels/:hotelId/rooms/:roomId` — with `UpdateRoomDto`, audit log: UPDATE_ROOM
  - `GET /v1/admin/hotels/:hotelId/rooms/:roomId/availability` — query params: start_date, end_date
  - Apply `@AdminRoles(OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)` guard
- [x] 9.3 Create hotel admin DTOs:
  - `CreateHotelDto`: name, latitude, longitude, star_rating, address, description, images, amenities, is_published with class-validator
  - `UpdateHotelDto`: extends PartialType(CreateHotelDto)
  - `CreateRoomDto`: room_type, max_occupancy, price_usd, amenities, images, is_active with class-validator
  - `UpdateRoomDto`: extends PartialType(CreateRoomDto)
- [x] 9.4 Tests
  - Unit tests: `admin-hotels.service.spec.ts` (15 tests)
  - Unit tests: `admin-hotels.controller.spec.ts` (10 tests)
  - All 126 unit tests + 8 e2e tests passing
  - Build compiles cleanly

---

## B10: Tour Guide API (`/v1/admin/guides`)
**Source:** Combined Task 10

- [x] 10.1 Implement `AdminGuidesService`:
  - `getAllGuides()` — pagination with meta, filter by languages/specialties via relation filters
  - `getGuideById()` — includes user info, languages, specialties, assignments, reviews, average rating
  - `createGuide()` — validates user exists and no existing guide profile, creates guide + guide_languages + guide_specialities records
  - `updateGuide()` — updates guide fields, replaces languages/specialties when provided
  - `getGuideAssignments()` — returns booking_items for guide with booking reference and customer info
  - `getGuideAvailability()` — checks booking_items for overlapping non-cancelled bookings in date range
- [x] 10.2 Create `AdminGuidesController`:
  - `GET /v1/admin/guides` — query params: languages, specialties, page, limit
  - `GET /v1/admin/guides/:id`
  - `POST /v1/admin/guides` — with `CreateGuideDto`, audit log: CREATE_GUIDE
  - `PATCH /v1/admin/guides/:id` — with `UpdateGuideDto`, audit log: UPDATE_GUIDE
  - `GET /v1/admin/guides/:id/assignments`
  - `GET /v1/admin/guides/:id/availability` — query params: start_date, end_date
  - Apply `@AdminRoles(OPERATIONS_MANAGER, SUPER_ADMIN)` guard
- [x] 10.3 Create guide admin DTOs:
  - `CreateGuideDto`: user_id, bio, languages, specialties, province, provinces, price_per_day_usd, avatar_url, images, is_verified, is_active with class-validator
  - `UpdateGuideDto`: extends PartialType(CreateGuideDto)
  - `GuideResponseDto`: all guide fields + user info + languages + specialties + assignment_count + review_count + average_rating
- [x] 10.4 Tests
  - Unit tests: `admin-guides.service.spec.ts` (15 tests)
  - Unit tests: `admin-guides.controller.spec.ts` (8 tests)
  - All 149 unit tests + 8 e2e tests passing
  - Build compiles cleanly

---

## B11: Emergency Alert API (`/v1/admin/emergency`)
**Source:** Combined Task 11

- [x] 11.1 Implement `AdminEmergencyService`:
  - `getAllEmergencyAlerts()` — pagination with meta, filters by status and alert_type, includes user and driver info
  - `getEmergencyAlertById()` — full detail with user and driver info
  - `acknowledgeAlert()` — validates alert is not resolved/cancelled, updates status to ACKNOWLEDGED with timestamp, publishes to Redis `emergency_alerts`
  - `resolveAlert()` — validates alert is not already resolved/cancelled, updates status to RESOLVED with timestamp and notes, publishes to Redis `emergency_alerts`
  - Redis publish on status change with payload: alert_id, alert_type, status, lat, lng, timestamp, action
- [x] 11.2 Create `AdminEmergencyController`:
  - `GET /v1/admin/emergency` — query params: status, alert_type, page, limit
  - `GET /v1/admin/emergency/:id`
  - `PATCH /v1/admin/emergency/:id` — with `UpdateEmergencyDto`, routes to acknowledgeAlert or resolveAlert based on status
  - Apply `@AdminRoles(OPERATIONS_MANAGER, SUPER_ADMIN)` guard
  - Audit log entries for ACKNOWLEDGE_EMERGENCY and RESOLVE_EMERGENCY actions
- [x] 11.3 Create emergency admin DTOs:
  - `UpdateEmergencyDto`: status (enum), acknowledged_by (UUID), notes with class-validator
  - `EmergencyDetailResponseDto`: all alert fields + user + driver
- [x] 11.4 Tests
  - Unit tests: `admin-emergency.service.spec.ts` (13 tests)
  - Unit tests: `admin-emergency.controller.spec.ts` (6 tests)
  - All 168 unit tests + 8 e2e tests passing
  - Build compiles cleanly

---

## B12: Customer Support API (`/v1/admin/customers`)
**Source:** Combined Task 12

- [x] 12.1 Implement `AdminCustomersService`:
  - `getAllCustomers()` — pagination with meta, search by name/email/phone with OR filter, includes booking and review counts
  - `getCustomerById()` — includes booking history, loyalty transactions, reviews, total spent, booking/review counts
  - `getCustomerReviews()` — reviews for a specific customer from `reviews` table
  - `adjustLoyaltyPoints()` — atomic transaction: updates `users.loyalty_points` and creates `loyalty_transactions` record with type `adjusted`, prevents negative balance
- [x] 12.2 Create `AdminCustomersController`:
  - `GET /v1/admin/customers` — query params: search, page, limit
  - `GET /v1/admin/customers/:id`
  - `GET /v1/admin/customers/:id/reviews`
  - `POST /v1/admin/loyalty/adjust` — with `AdjustLoyaltyDto`, audit log: ADJUST_LOYALTY
  - `AdminCustomersController` applies `@AdminRoles(SUPPORT_AGENT, OPERATIONS_MANAGER, SUPER_ADMIN)`
  - `AdminLoyaltyController` applies `@AdminRoles(OPERATIONS_MANAGER, SUPER_ADMIN)`
- [x] 12.3 Create customer admin DTOs:
  - `CustomerResponseDto`: id, email, full_name, phone, avatar_url, loyalty_points, is_student_verified, role, booking_count, review_count, total_spent_usd
  - `AdjustLoyaltyDto`: user_id (UUID), points (Int, min -10000, max 10000), description with class-validator
- [x] 12.4 Tests
  - Unit tests: `admin-customers.service.spec.ts` (9 tests)
  - Unit tests: `admin-customers.controller.spec.ts` (5 tests)
  - All 182 unit tests + 8 e2e tests passing
  - Build compiles cleanly

---

## B13: Discount Code API (`/v1/admin/discounts`)
**Source:** Combined Task 13

- [x] 13.1 Implement `AdminDiscountsService`:
  - `getAllDiscountCodes()` — pagination with meta, maps Decimal fields to Number
  - `createDiscountCode()` — validates code uniqueness (ConflictException on duplicate), generates UUID, casts dates
  - `updateDiscountCode()` — validates exists, checks code uniqueness on change, conditionally casts dates
  - `deactivateDiscountCode()` — sets `is_active` to false
  - `getAllStudentVerifications()` — pagination with meta, status filter, includes user info
  - `reviewStudentVerification()` — updates status + `reviewed_at` + `reviewed_by_id`, updates `users.is_student_verified` on approved/rejected
- [x] 13.2 Create `AdminDiscountsController`:
  - `GET /v1/admin/discounts` — query params: page, limit; returns standard envelope
  - `POST /v1/admin/discounts` — with `CreateDiscountCodeDto`, audit log: CREATE_DISCOUNT_CODE
  - `PATCH /v1/admin/discounts/:id` — with `UpdateDiscountCodeDto`, audit log: UPDATE_DISCOUNT_CODE
  - `PATCH /v1/admin/discounts/:id/deactivate` — audit log: DEACTIVATE_DISCOUNT_CODE
  - `GET /v1/admin/student-verifications` — query params: status, page, limit; returns standard envelope
  - `PATCH /v1/admin/student-verifications/:id` — with `ReviewStudentVerificationDto`, audit log: REVIEW_STUDENT_VERIFICATION
  - Apply `@AdminRoles(OPERATIONS_MANAGER, SUPER_ADMIN)` guard
  - Uses `CurrentUser('sub')` for audit log userId
- [x] 13.3 Create discount admin DTOs:
  - `CreateDiscountCodeDto`: code, discount_type (enum), value, max_uses, min_booking_usd, valid_from, valid_until, booking_type (enum), is_active with class-validator
  - `UpdateDiscountCodeDto`: extends PartialType(CreateDiscountCodeDto)
  - `ReviewStudentVerificationDto`: status (verification_status enum), review_notes with class-validator
- [x] 13.4 Tests
  - Unit tests: `admin-discounts.service.spec.ts` (16 tests) — getAll, create, update, deactivate, student verifications, review, audit log
  - Unit tests: `admin-discounts.controller.spec.ts` (10 tests) — all endpoints, audit logging, standard envelope
  - All 208 unit tests + 8 e2e tests passing
  - Build compiles cleanly

---

## B14: Analytics & Reporting API (`/v1/admin/analytics`)
**Source:** Combined Task 14

- [x] 14.1 Implement `AdminAnalyticsService`:
  - `getRevenueAnalytics()` — aggregates `booking_items` by `booking_type` using Prisma `groupBy` with `_sum` and `_count`, supports date range filter
  - `getBookingStatistics()` — counts bookings by status, plus today/this_week/this_month totals
  - `getDriverPerformance()` — lists all drivers with total assignments and completed trip counts
  - `getPopularDestinations()` — top 10 trips by `booking_items` count, includes English translation title
  - `getHotelOccupancy()` — total rooms vs occupied room-nights over 30 days, calculates occupancy rate percentage
  - `getGuideUtilization()` — total guides vs guides with bookings, calculates utilization rate percentage
  - `getAIAssistedBookings()` — heuristic: bookings where user had AI chat session within 24h before booking, returns conversion rate
  - `getAIPerformanceMetrics()` — total AI sessions, avg messages per session (via `$queryRaw`), bookings converted, conversion rate
  - `exportData()` — generates CSV or JSON for any metric (revenue, bookings, drivers, destinations, hotels, guides, ai), includes `toCsv` helper
  - `createAuditLog()` helper for audit trail entries
- [x] 14.2 Create `AdminAnalyticsController`:
  - `GET /v1/admin/analytics/revenue` — query params: start_date, end_date; returns standard envelope
  - `GET /v1/admin/analytics/bookings` — returns standard envelope
  - `GET /v1/admin/analytics/drivers` — returns standard envelope
  - `GET /v1/admin/analytics/destinations` — returns standard envelope
  - `GET /v1/admin/analytics/hotels` — returns standard envelope
  - `GET /v1/admin/analytics/guides` — returns standard envelope
  - `GET /v1/admin/analytics/ai-bookings` — returns standard envelope
  - `GET /v1/admin/analytics/ai-performance` — returns standard envelope
  - `GET /v1/admin/analytics/export` — query params: format, metric, start_date, end_date; audit log: EXPORT_DATA
  - Apply `@AdminRoles(OPERATIONS_MANAGER, SUPER_ADMIN)` guard
  - Uses `CurrentUser('sub')` for audit log userId on export
- [x] 14.3 Create analytics DTOs:
  - `RevenueAnalyticsDto`, `BookingStatisticsDto`, `DriverPerformanceDto` — parameter DTOs with class-validator decorators
  - `ExportDataDto` — format, metric, start_date, end_date with validation
- [x] 14.4 Tests
  - Unit tests: `admin-analytics.service.spec.ts` (14 tests) — revenue, bookings, drivers, destinations, hotels, guides, AI bookings, AI performance, export, audit log
  - Unit tests: `admin-analytics.controller.spec.ts` (10 tests) — all endpoints, standard envelope, export audit logging
  - All 232 unit tests + 8 e2e tests passing
  - Build compiles cleanly

---

## B15: Admin User Management API (`/v1/admin/users`)
**Source:** Combined Task 15

- [x] 15.1 Implement `AdminUsersService`:
  - `getAllAdminUsers()` — joins `admin_users` with `users` table, returns merged data (email, full_name, phone, role, admin_role, permissions, is_active)
  - `createAdminUser()` — checks for existing user by email; if exists, updates role to 'admin' and creates `admin_users` record; if not, creates new User with `role: 'admin'` and `admin_users` record; throws ConflictException if already an admin
  - `updateAdminUser()` — updates admin_role, permissions, is_active; invalidates Redis cache; throws NotFoundException if missing
  - `deactivateAdminUser()` — sets `is_active` to false, revokes all active refresh tokens for the user, clears Redis cache; throws NotFoundException if missing
  - `createAuditLog()` helper for audit trail entries
  - Redis caching: `cacheAdminPermissions()` writes `admin:permissions:{userId}` with 5-minute TTL
- [x] 15.2 Create `AdminUsersController`:
  - `GET /v1/admin/users` — returns standard envelope
  - `POST /v1/admin/users` — with `CreateAdminUserDto`, audit log: CREATE_ADMIN_USER
  - `PATCH /v1/admin/users/:id` — with `UpdateAdminUserDto`, audit log: UPDATE_ADMIN_USER
  - `PATCH /v1/admin/users/:id/deactivate` — audit log: DEACTIVATE_ADMIN_USER
  - Apply `@AdminRoles(SUPER_ADMIN)` guard
  - Uses `CurrentUser('sub')` for audit log userId
- [x] 15.3 Create admin user DTOs:
  - `CreateAdminUserDto`: email, full_name, phone, admin_role (enum), permissions with class-validator
  - `UpdateAdminUserDto`: extends PartialType(CreateAdminUserDto)
- [x] 15.4 Tests
  - Unit tests: `admin-users.service.spec.ts` (11 tests) — getAll, create (existing user + new user + conflict), update, deactivate, audit log
  - Unit tests: `admin-users.controller.spec.ts` (4 tests) — all endpoints, standard envelope, audit logging
  - All 247 unit tests + 8 e2e tests passing
  - Build compiles cleanly

---

## B16: Audit Logging API (`/v1/admin/audit-logs`)
**Source:** Combined Task 16

- [x] 16.1 Implement `AdminAuditService`:
  - `getAllAuditLogs()` — pagination with meta, filters by date_range, admin_user_id (user_id), action_type (event_type), includes user email/full_name, returns up to 5000 records
  - `createAuditLog()` — creates manual audit entry with event_type, entity_type, entity_id, ipAddress, userAgent, metadata
  - `exportAuditLogs()` — generates CSV from filtered audit logs (up to 5000 rows), includes `toCsv` helper with comma-escaping
  - `AuditInterceptor` — automatic audit logging interceptor for POST/PATCH/PUT/DELETE operations; infers entity type from URL path and action from HTTP method; silently fails on errors to avoid breaking requests
- [x] 16.2 Create `AdminAuditController`:
  - `GET /v1/admin/audit-logs` — query params: start_date, end_date, admin_user_id, action_type, page, limit; returns standard envelope
  - `POST /v1/admin/audit-logs` — with `CreateAuditLogDto` for manual entries; returns standard envelope
  - `GET /v1/admin/audit-logs/export` — query params: start_date, end_date, admin_user_id, action_type; returns CSV content in standard envelope
  - Apply `@AdminRoles(SUPER_ADMIN)` guard
- [x] 16.3 Create audit DTOs:
  - `CreateAuditLogDto`: event_type (audit_event_type enum), entity_type, entity_id (UUID), ip_address, user_agent, metadata with class-validator
- [x] 16.4 Tests
  - Unit tests: `admin-audit.service.spec.ts` (9 tests) — getAll with filters, create, export CSV, empty export
  - Unit tests: `admin-audit.controller.spec.ts` (3 tests) — getAll, create, export endpoints with standard envelope
  - All 258 unit tests + 8 e2e tests passing
  - Build compiles cleanly

---

## B17: Dashboard Overview API (`/v1/admin/dashboard`)
**Source:** Combined Task 17

- [x] 17.1 Implement `AdminDashboardService`:
  - `getDashboardOverview(role?)` — aggregates 8 metrics in parallel for performance
  - `total_bookings_today` / `total_revenue_today` — from `bookings` created today
  - `active_drivers_count` — drivers with status AVAILABLE or BUSY
  - `booking_trends` — 30-day daily booking counts from `$queryRaw`, zero-filled for missing days
  - `pending_actions` — unassigned bookings (no PENDING/ACCEPTED driver assignments) + upcoming maintenance (next 7 days, status SCHEDULED)
  - `recent_emergencies` — last 5 emergency alerts with user info
  - `driver_summary` — count by status (AVAILABLE, BUSY, OFFLINE)
  - `upcoming_bookings` — bookings starting within next 24 hours, with customer info
  - `filterByRole()` — FLEET_MANAGER sees fleet metrics only, SUPPORT_AGENT sees bookings/customer metrics only, SUPER_ADMIN/OPERATIONS_MANAGER sees everything
- [x] 17.2 Create `AdminDashboardController`:
  - `GET /v1/admin/dashboard` — reads `req.adminUser.adminRole` from AdminRoleGuard and passes to service; returns standard envelope
  - No `@AdminRoles()` decorator (AdminRoleGuard allows all roles when none specified)
- [x] 17.3 Create dashboard DTOs:
  - `DashboardOverviewDto`, `BookingTrendDto`, `PendingActionDto`
- [x] 17.4 Tests
  - Unit tests: `admin-dashboard.service.spec.ts` (5 tests) — full overview, FLEET_MANAGER filter, SUPPORT_AGENT filter, no role, zero-filled trends
  - Unit tests: `admin-dashboard.controller.spec.ts` (3 tests) — envelope, role passing, no adminUser fallback
  - All 266 unit tests + 8 e2e tests passing
  - Build compiles cleanly

---

## B18: Data Export & Backup API
**Source:** Combined Task 18

- [x] 18.1 Implement `AdminExportService`:
  - `exportBookings({ startDate, endDate, format })` — queries bookings with customer/payment info, supports CSV (default) and JSON output, comma-escaping handled
  - `exportDrivers()` — queries drivers with completed assignment counts, returns CSV
  - `exportPayments()` — queries payments with customer/booking info, encrypts CSV with AES-256-GCM using `EXPORT_ENCRYPTION_KEY` from env; exposes `decrypt()` method for verification
  - `triggerBackup(userId)` — creates `backups` table record with generated Supabase URL placeholder
  - `getBackups()` — lists all backups ordered by createdAt desc
  - `toCsv()` helper with comma and quote escaping
  - `encrypt()` / `decrypt()` using Node.js `crypto` (scrypt key derivation, AES-256-GCM with auth tag)
- [x] 18.2 Create `AdminExportController`:
  - `GET /v1/admin/export/bookings` — query params: start_date, end_date, format; returns standard envelope
  - `GET /v1/admin/export/drivers` — returns standard envelope
  - `GET /v1/admin/export/payments` — returns encrypted CSV in standard envelope
  - `POST /v1/admin/backup` — uses `CurrentUser('sub')` for created_by_admin_id; returns standard envelope
  - `GET /v1/admin/backups` — returns standard envelope
  - Apply `@AdminRoles(SUPER_ADMIN)` guard
- [x] 18.3 Create export DTOs:
  - `ExportRequestDto`: format (enum csv/json), metric, start_date, end_date with class-validator
  - `BackupResponseDto`: id, backup_file_url, created_by_admin_id, backup_size_bytes, created_at with class-validator
- [x] 18.4 Tests
  - Unit tests: `admin-export.service.spec.ts` (8 tests) — bookings CSV/JSON/export with filters, drivers, encrypted payments (round-trip decrypt), trigger backup, get backups
  - Unit tests: `admin-export.controller.spec.ts` (5 tests) — all endpoints, standard envelope, backup userId fallback
  - All 279 unit tests + 8 e2e tests passing
  - Build compiles cleanly

---

## B19: AI Monitoring API
**Source:** Combined Task 19

- [x] 19.1 Implement `AdminAIMonitoringService`:
  - `getAIAssistedBookings()` — filters bookings created within 24h of an AI chat session for the same user; supports date range filtering
  - `getAISessionDetails()` — retrieves conversation from Redis (`ai:session:{sessionId}`, 7-day TTL); returns `{ expired: true }` if TTL expired but session exists in DB; returns `null` if session not found
  - `getAIBookingSuccessRate()` — calculates percentage of AI-assisted bookings with `confirmed` or `completed` status; breaks down counts by all booking statuses
  - `getAIPerformanceMetrics()` — computes average messages per session, average time from first AI session to booking creation (minutes), and conversion rate (AI-assisted bookings vs total)
- [x] 19.2 Create `AdminAIMonitoringController`:
  - `GET /v1/admin/ai-sessions/bookings` — returns AI-assisted bookings with standard envelope
  - `GET /v1/admin/ai-sessions/:sessionId` — returns session details; returns envelope with `success: false, message: "Session expired"` when Redis TTL expired
  - `GET /v1/admin/ai-sessions/metrics/success-rate` — returns success rate with standard envelope
  - `GET /v1/admin/ai-sessions/metrics/performance` — returns performance metrics with standard envelope
  - `@AdminRoles(OPERATIONS_MANAGER, SUPER_ADMIN)` guard applied at controller level
  - Throws `NotFoundException` when session does not exist in DB
- [x] 19.3 Tests:
  - `admin-ai-monitoring.service.spec.ts` — 10 tests covering all 4 service methods including date filtering, Redis cache hit/miss, expired TTL, and empty data scenarios
  - `admin-ai-monitoring.controller.spec.ts` — 6 tests covering all 4 endpoints including envelope format, session expired response, and NotFoundException
  - All 295 unit tests + 8 e2e tests passing. Build compiles cleanly.

---

## B20: WebSocket Gateway (`/v1/admin/ws`)
**Source:** Combined Task 20

- [x] 20.1 Implement `AdminGateway`:
  - WebSocket gateway at `/v1/admin/ws` with Socket.io namespace
  - JWT authentication for WebSocket connections: extracts token from `Authorization` header or `token` query param, verifies with `JwtService`, queries `admin_users` for active role, rejects inactive/non-admin users
  - Subscribes to Redis patterns: `admin_events`, `driver_status_changed:*`, `emergency_alerts`, `driver_assignments`
  - Broadcasts events to connected admin clients with typed envelope `{ event, data, timestamp }`
  - Room-based broadcasting by admin role: clients auto-join `room:{AdminRole}` and `room:all`; DRIVER_STATUS_UPDATE sent to FLEET_MANAGER, OPERATIONS_MANAGER, SUPER_ADMIN; EMERGENCY_ALERT sent to OPERATIONS_MANAGER, SUPER_ADMIN; ADMIN_EVENT sent to all
  - Connection/disconnection events tracked in `connectedAdmins` Map; emits `connected` event to client on successful auth
  - Public methods: `broadcastToRoom()`, `broadcastToAll()`, `broadcastToRole()`, `getConnectedClients()`
- [x] 20.2 Implement Redis pub/sub integration:
  - `RedisService` extended with `publish(channel, message)`, `subscribe(channel, callback)`, and `psubscribe(pattern, callback)` methods
  - Existing services (`AdminDriversService`, `AdminEmergencyService`) already publish to `driver_status_changed:{driver_id}` and `emergency_alerts` channels via `redis.getClient().publish()`
- [x] 20.3 Create WebSocket event DTOs:
  - `DriverStatusUpdateEvent`, `BookingCreatedEvent`, `EmergencyAlertEvent`, `DriverAssignmentEvent` in `src/admin/dto/websocket-events.dto.ts`
- [x] 20.4 Tests:
  - `admin.gateway.spec.ts` — 15 tests covering afterInit, handleConnection (valid token, query token, missing token, invalid token, inactive admin, non-admin), handleDisconnect, broadcastEvent (driver status, emergency, admin events, non-JSON), public broadcast methods
  - All 310 unit tests + 8 e2e tests passing. Build compiles cleanly.

---

## B21: Telegram Webhook API
**Source:** Combined Task 7 + Telegram specs

- [x] 21.1 Create Telegram module:
  - `src/telegram/telegram.module.ts` — module definition, exported and imported into `AppModule`
  - `src/telegram/telegram.controller.ts` — webhook endpoint
  - `src/telegram/telegram.service.ts` — business logic
- [x] 21.2 Implement `TelegramService`:
  - `handleDriverStatusUpdate()` — finds driver by `telegram_id`; updates existing driver (status, `lastStatusUpdate`, `lastTelegramActivity`, optional `vehicle_id` and `driver_name`) or creates new driver with auto-generated `driverId` (`DRV-{telegram_id}`) and 6-digit PIN
  - Publishes status change to Redis channel `driver_status_changed:{driver_id}`
  - Creates audit log entry with `source: 'telegram_webhook'` metadata
- [x] 21.3 Create `TelegramController`:
  - `POST /v1/telegram/driver-status` — webhook endpoint with standard API envelope response
  - Validates webhook signature via HMAC-SHA256 when `TELEGRAM_WEBHOOK_SECRET` is configured; rejects with `UnauthorizedException` on invalid signature
  - Parses payload via `DriverStatusWebhookDto` with `class-validator`
  - Calls `TelegramService.handleDriverStatusUpdate()`
  - Returns `{ success: true, data, message: 'Driver status updated', error: null }`
- [x] 21.4 Create telegram DTOs:
  - `DriverStatusWebhookDto` with `telegram_id`, `vehicle_id` (optional), `driver_name`, `status` (DriverStatus enum)
- [x] 21.5 Tests:
  - `telegram.service.spec.ts` — 5 tests covering update existing driver, create new driver, update with vehicle_id, Redis publish, audit log creation
  - `telegram.controller.spec.ts` — 5 tests covering webhook processing, vehicle_id passthrough, signature skip when no secret, valid signature verification, invalid signature rejection
  - All 320 unit tests + 8 e2e tests passing. Build compiles cleanly.

---

## B22: Telegram Bot Full Module
**Source:** Telegram specs

- [x] 22.1 Telegram webhook handler:
  - `POST /v1/telegram/webhook` — receives Telegram Bot API updates; validates `x-telegram-bot-api-secret-token` via `WebhookSecretGuard`; routes to `MessageHandler` for command/callback/location processing
  - Rate limiting: 30 req/min per `telegram_id` via Redis `INCR`/`EXPIRE`
  - Idempotency via `update_id` deduplication with 1-hour Redis TTL
- [x] 22.2 Driver registration endpoint:
  - `POST /v1/telegram/register` — `telegram_id`, `driver_id`, `pin`; verifies driver exists and PIN matches (bcrypt); updates `drivers.telegram_id`; stores mapping in Redis `telegram_driver:{telegram_id}` (30d TTL); creates audit log
- [x] 22.3 Driver status endpoints:
  - `POST /v1/telegram/status` — updates driver status; blocks `OFFLINE` if active assignments exist (409 Conflict); publishes to Redis; creates audit log
  - `GET /v1/telegram/driver-info` — returns driver profile with active assignment count
- [x] 22.4 Trip assignment endpoints:
  - `GET /v1/telegram/assignments/active`, `POST /v1/telegram/assignments/:id/accept`, `POST /v1/telegram/assignments/:id/reject` (with optional reason), `POST /v1/telegram/assignments/:id/start`, `POST /v1/telegram/assignments/:id/complete`
  - Auto-reject after 5 minutes via Bull queue (`assignment-timeout`); `queueAssignmentTimeout()` adds delayed job
  - Reject publishes `ASSIGNMENT_REJECTED` event to Redis for WebSocket broadcast
- [x] 22.5 Trip history & earnings endpoints:
  - `GET /v1/telegram/assignments/history` — pagination with limit/offset
  - `GET /v1/telegram/earnings/today` and `/v1/telegram/earnings/week` — counts completed assignments
- [x] 22.6 Location endpoint:
  - `POST /v1/telegram/location` — stores in Redis `driver_location:{driver_id}` with 5-min TTL; publishes to `driver_location_updated:{driver_id}`
- [x] 22.7 Emergency & support endpoints:
  - `POST /v1/telegram/emergency` — creates `emergency_alerts` record (`sos` type, `triggered` status); notifies admin via Redis
  - `POST /v1/telegram/support` — creates `support_tickets` record
- [x] 22.8 Settings endpoint:
  - `PATCH /v1/telegram/settings` — updates driver `preferred_language`
- [x] 22.9 Broadcast endpoints:
  - `POST /v1/telegram/broadcast` — queues in Bull `broadcast` queue at 30 msg/sec; tracks `sent_count` / `failed_count`
  - `GET /v1/telegram/broadcasts` — lists recent broadcasts
- [x] 22.10 Telegram module folder structure:
  - `handlers/`: `command.handler.ts` (all bot commands), `callback.handler.ts` (inline buttons), `location.handler.ts` (live location), `message.handler.ts` (router + rate limit + dedup)
  - `dto/`: `webhook-update.dto.ts`, `register-driver.dto.ts`, `status-update.dto.ts`, `assignment-action.dto.ts`, `location-update.dto.ts`, `broadcast-message.dto.ts`
  - `guards/`: `telegram-auth.guard.ts` (validates telegram_id in Redis/DB), `webhook-secret.guard.ts` (secret token header check)
  - `jobs/`: `broadcast.processor.ts` (30 msg/sec rate limit), `assignment-timeout.processor.ts` (5-min auto-reject), `location-cleanup.processor.ts`
  - `locales/`: `en.json`, `km.json`, `zh.json`
- [x] 22.11 Dependencies:
  - Installed `@nestjs/bullmq` and `bullmq`
  - `BullModule.forRoot()` configured in `AppModule` with Redis connection
  - `BullModule.registerQueue()` in `TelegramModule` for `broadcast`, `assignment-timeout`, `location-cleanup`
- [x] 22.12 Tests:
  - `telegram.service.spec.ts` — 15 tests covering webhook (rate limit, dedup), driver status update, registration (valid/invalid PIN), assignment accept/reject/timeout queue, location, broadcast
  - `telegram.controller.spec.ts` — 20 tests covering all 20 endpoints with standard envelope validation
  - All 345 unit tests + 8 e2e tests passing. Build compiles cleanly.

---

## B23: Backend Testing
**Source:** Combined Task 38

- [x] 23.1 Unit tests for backend services (Jest with mocked Prisma client):
  - AdminDriversService, AdminVehiclesService, AdminBookingsService, AdminAssignmentsService — 38 service/controller spec files, 345 unit tests passing
  - TelegramService webhook handling — `telegram.service.spec.ts` + `telegram.controller.spec.ts` with rate limiting, deduplication, driver registration, status updates, assignments, broadcast tests
- [x] 23.2 Integration tests for backend endpoints (supertest):
  - Admin authentication and authorization — `test/auth.e2e-spec.ts` (7 tests)
  - Driver management endpoints — `test/admin.e2e-spec.ts` (driver CRUD, vehicle CRUD, maintenance, bookings, assignments)
  - Vehicle and maintenance endpoints — `test/admin.e2e-spec.ts`
  - Booking operations endpoints — `test/admin.e2e-spec.ts`
  - WebSocket gateway — `test/websocket.e2e-spec.ts` (connection auth, Redis pub/sub broadcasting)
- Total: 345 unit tests + 33 e2e tests passing. TypeScript build compiles cleanly.
