# Telegram Bot Tasks — DerLg Transportation Management System

> Source: `/docs/specs/telegram/requirements.md` + `/docs/specs/telegram/design.md` + `/docs/specs/telegram/integration.md`
> Status: **Implementation complete (✅)** — build passes, all 352 tests pass. Manual BotFather registration and webhook setup pending.

---

## Overview

The Telegram Bot enables transportation drivers to manage availability and trip assignments via mobile phones without a dedicated app. It integrates with the System Admin Panel through shared database tables, Redis pub/sub, and WebSocket real-time updates.

---

## T1: Core Bot Setup & Configuration

- [x] 1.1 Register bot with BotFather:
  - Create new bot on Telegram
  - Obtain bot token
  - Configure bot name, description, commands list
- [x] 1.2 Environment variables:
  - `TELEGRAM_BOT_TOKEN` — from BotFather
  - `TELEGRAM_WEBHOOK_URL` — `https://your-domain.com/v1/telegram/webhook`
  - `TELEGRAM_SECRET_TOKEN` — random 32-char secret for webhook validation
  - `TELEGRAM_WEBHOOK_MAX_CONNECTIONS` — 40
  - `TELEGRAM_BOT_ENABLED=true`
  - `TELEGRAM_LOCATION_TRACKING_ENABLED=true`
  - `TELEGRAM_BROADCAST_ENABLED=true`
- [x] 1.3 Set webhook URL via Telegram Bot API:
  - Use `setWebhook` with `secret_token` parameter
  - HTTPS with valid SSL certificate (required by Telegram)
  - Verify webhook is set correctly

---

## T2: NestJS Telegram Module Structure

- [x] 2.1 Create `TelegramModule`:
  - `src/telegram/telegram.module.ts` — module definition with imports (Bull, Redis, Prisma)
  - `src/telegram/telegram.controller.ts` — webhook endpoint controller
  - `src/telegram/telegram.service.ts` — core bot orchestration
- [x] 2.2 Create handlers:
  - `src/telegram/handlers/command.handler.ts` — command routing (/start, /online, /offline, /status, /mytrip, /history, /emergency, /support, /help)
  - `src/telegram/handlers/callback.handler.ts` — inline button callbacks (accept/reject trip, start/complete trip)
  - `src/telegram/handlers/location.handler.ts` — location update processing
  - `src/telegram/handlers/message.handler.ts` — text message processing (registration credentials, support descriptions)
- [x] 2.3 Create services:
  - `src/telegram/services/bot-sender.service.ts` — Telegram API message sender (sendMessage, sendPhoto, editMessage)
  - `src/telegram/services/session.service.ts` — Redis-based session manager
- [x] 2.4 Create DTOs:
  - `src/telegram/dto/webhook-update.dto.ts` — Telegram Update object validation
  - `src/telegram/dto/register-driver.dto.ts` — registration payload
  - `src/telegram/dto/status-update.dto.ts` — status change payload
  - `src/telegram/dto/assignment-action.dto.ts` — accept/reject payload
  - `src/telegram/dto/location-update.dto.ts` — location coordinates
  - `src/telegram/dto/broadcast-message.dto.ts` — broadcast payload
- [x] 2.5 Create guards:
  - `src/telegram/guards/telegram-auth.guard.ts` — validate telegram_id exists in drivers table
  - `src/telegram/guards/webhook-secret.guard.ts` — validate Telegram secret token in header
- [x] 2.6 Create job processors (Bull queue):
  - `src/telegram/jobs/broadcast.processor.ts` — process broadcast queue (30 msg/sec rate limit)
  - `src/telegram/jobs/assignment-timeout.processor.ts` — auto-reject assignment after 5 minutes
  - `src/telegram/jobs/location-cleanup.processor.ts` — clean old location data from Redis

---

## T3: Webhook Security & Rate Limiting

- [x] 3.1 Webhook endpoint: `POST /v1/telegram/webhook`
  - Receives updates from Telegram servers (messages, callback queries, location updates)
  - Immediate 200 OK response (acknowledge within 1 second)
  - Async processing via Bull queue
- [x] 3.2 Secret token validation:
  - Check `X-Telegram-Bot-Api-Secret-Token` header
  - Return 403 Forbidden if invalid or missing
- [x] 3.3 Payload validation:
  - Validate structure matches Telegram Update object schema
  - Return 400 Bad Request if malformed
- [x] 3.4 Rate limiting:
  - 30 requests per minute per telegram_id using Redis counter (`telegram_rate:{telegram_id}`)
  - Return 429 Too Many Requests if exceeded
  - Bot displays: "⚠️ Too many requests. Please wait a moment."
- [x] 3.5 Idempotency:
  - Check `update_id` in Redis to prevent duplicate processing
  - Store processed update_ids with TTL
- [x] 3.6 Logging:
  - Log all webhook requests with telegram_id, update_type, timestamp
  - Error logging to Sentry

---

## T4: Driver Registration Flow

- [x] 4.1 `/start` command (first time):
  - Welcome message with registration instructions
  - Prompt for credentials in format: `driver_id: <ID> pin: <PIN>`
  - Example: "driver_id: DRV001 pin: 1234"
- [x] 4.2 Credential validation:
  - Call Backend_API POST /v1/telegram/register
  - Backend verifies driver_id exists in drivers table
  - Backend verifies pin matches drivers.auth_pin (bcrypt)
  - Return 401 Unauthorized if invalid
- [x] 4.3 Registration success:
  - Update drivers.telegram_id with user's telegram_id
  - Store mapping in Redis: `telegram_driver:{telegram_id}` (30 days TTL)
  - Create audit_logs record: action_type = DRIVER_TELEGRAM_REGISTERED
  - Display confirmation with driver name, assigned vehicle, current status
- [x] 4.4 `/start` command (registered user):
  - Display status dashboard instead of registration prompt
  - Show current status, vehicle, last update time
  - Inline keyboard: [Go Online] [Go Offline] [View Trips]
- [x] 4.5 Session state management:
  - Redis key: `telegram_session:{telegram_id}`
  - Type: Hash, TTL: 1 hour
  - Fields: state, data, last_command

---

## T5: Driver Status Management

- [x] 5.1 `/online` command:
  - Call POST /v1/telegram/status with status: AVAILABLE
  - Backend updates drivers.status to AVAILABLE, last_status_update to now
  - Publish to Redis: `driver_status_changed:{driver_id}`
  - Bot responds: "✅ You are now ONLINE and available for trips"
  - Inline keyboard: [Go Offline] [View Trips]
- [x] 5.2 `/offline` command:
  - Call POST /v1/telegram/status with status: UNAVAILABLE
  - Backend verifies no active assignments (driver_assignments with completion_timestamp IS NULL)
  - If active assignments exist: return 409 Conflict
  - Bot displays: "❌ Cannot go offline. You have an active trip. Complete it first."
  - If no active assignments: update status to UNAVAILABLE
  - Bot confirms: "✅ You are now OFFLINE"
  - Inline keyboard: [Go Online]
- [x] 5.3 `/status` command:
  - Call GET /v1/telegram/driver-info?telegram_id={id}
  - Display current status, assigned vehicle name, last status update time
  - Inline keyboard: [Go Online] [Go Offline] [View Trips]
- [x] 5.4 Inline button callbacks:
  - `status:online` → go online
  - `status:offline` → go offline
  - `status:view` → view detailed status
- [x] 5.5 Audit logging:
  - Create audit_logs records for all status changes: action_type = DRIVER_STATUS_CHANGE

---

## T6: Trip Assignment Notifications

- [x] 6.1 Assignment creation trigger:
  - When admin assigns driver via POST /v1/admin/assignments
  - Backend creates driver_assignment record
  - Backend retrieves driver's telegram_id from drivers table
  - Backend sends Telegram message via Bot API sendMessage
- [x] 6.2 Notification message content:
  - Pickup location, destination, pickup time
  - Customer name, number of passengers
  - Booking reference
  - Inline keyboard: [Accept Trip] [Reject Trip]
  - Countdown: "⏰ Please respond within 5 minutes"
- [x] 6.3 Driver accepts trip:
  - Driver taps [Accept Trip] → callback query to webhook
  - Call POST /v1/telegram/assignments/:id/accept
  - Backend updates assignment status to ACCEPTED, driver status to BUSY
  - Bot sends: "✅ Trip accepted. Customer has been notified. Pickup at {location} at {time}"
  - Inline keyboard: [Start Trip] [View Details] [Contact Support]
- [x] 6.4 Driver rejects trip:
  - Driver taps [Reject Trip] → callback query with optional reason
  - Call POST /v1/telegram/assignments/:id/reject
  - Backend updates assignment status to REJECTED, driver status back to AVAILABLE
  - Notify Admin Panel via WebSocket that assignment was rejected
  - Bot sends: "❌ Trip rejected. Dispatch has been notified."
- [x] 6.5 Auto-reject timeout:
  - If driver does not respond within 5 minutes
  - Bull queue processor auto-rejects
  - Notify admin via WebSocket
  - Update assignment status to REJECTED
- [x] 6.6 Audit logging:
  - Create audit_logs records: action_type = TRIP_ACCEPTED or TRIP_REJECTED

---

## T7: Active Trip Management

- [x] 7.1 `/mytrip` command:
  - Call GET /v1/telegram/assignments/active?telegram_id={id}
  - Backend queries driver_assignments for ACCEPTED status with completion_timestamp IS NULL
  - If active trip exists: display booking ref, customer name, pickup, destination, time, phone, special requests
  - Inline keyboard: [Start Trip] [Complete Trip] [Contact Support]
  - If no active trip: "No active trips. Status: {current_status}" with [Go Online] button
- [x] 7.2 Start trip:
  - Driver taps [Start Trip]
  - Call POST /v1/telegram/assignments/:id/start
  - Backend updates trip_start_time, bookings.status to IN_PROGRESS
  - Bot confirms: "🚗 Trip started. Drive safely!"
  - Prompt: "📍 Share your live location for this trip?" [Share Location] [Skip]
  - Inline keyboard: [Complete Trip] [Emergency]
- [x] 7.3 Complete trip:
  - Driver taps [Complete Trip]
  - Call POST /v1/telegram/assignments/:id/complete
  - Backend updates completion_timestamp, bookings.status to COMPLETED, driver status to AVAILABLE
  - Publish to Redis: `driver_status_changed:{driver_id}` with status AVAILABLE
  - Bot displays: "✅ Trip completed! You are now available for new assignments."
  - Show trip summary: duration, distance (if available)
  - Inline keyboard: [View History] [Go Offline]
- [x] 7.4 Audit logging:
  - Create audit_logs records: action_type = TRIP_STARTED, TRIP_COMPLETED

---

## T8: Trip History & Earnings

- [x] 8.1 `/history` command:
  - Call GET /v1/telegram/assignments/history?telegram_id={id}&limit=10
  - Backend queries driver_assignments with completion_timestamp IS NOT NULL, ordered DESC
  - Display list of last 10 completed trips: date, booking ref, route, duration
  - Inline keyboard: [Today's Summary] [This Week] [This Month]
- [x] 8.2 Earnings endpoints:
  - `GET /v1/telegram/earnings/today` — today's summary
  - `GET /v1/telegram/earnings/week` — weekly summary
  - Backend calculates: total trips, total hours worked, estimated earnings
- [x] 8.3 Earnings display format:
  ```
  📊 Today's Summary
  ✅ Trips: {count}
  ⏱ Hours: {hours}
  💰 Earnings: ${amount}
  ```
- [x] 8.4 Weekly/Monthly summaries:
  - Same format as daily summary
  - Breakdown by day available via [View Details] button
- [x] 8.5 Empty state:
  - If no trips: "No trips completed in this period."

---

## T9: Location Sharing & Tracking

- [x] 9.1 Location sharing prompt:
  - On trip start: "📍 Share your live location for this trip?"
  - Inline buttons: [Share Location] [Skip]
- [x] 9.2 Location permission:
  - When driver taps [Share Location], request Telegram live location sharing
  - Telegram sends location updates to webhook every 60 seconds
- [x] 9.3 Location update processing:
  - Bot calls POST /v1/telegram/location with telegram_id, latitude, longitude, timestamp
  - Backend stores in Redis: `driver_location:{driver_id}` (Hash, 5-min TTL)
  - Publish to Redis: `driver_location_updated:{driver_id}`
- [x] 9.4 Admin Panel integration:
  - Admin Panel subscribes to location updates
  - Displays driver position on real-time map in emergency/booking detail views
- [x] 9.5 Location during active trip:
  - `/location` command displays current location and destination on map
  - Show estimated time to destination and distance remaining
  - If location not shared: prompt to enable with [Share Now] button
- [x] 9.6 Privacy compliance:
  - Do NOT store historical location data beyond current trip
  - Automatically delete location data when trip completes

---

## T10: Emergency & Support Features

- [x] 10.1 `/help` command:
  - Display list of available commands with descriptions
  - Include: /start, /online, /offline, /status, /mytrip, /history, /emergency, /support
- [x] 10.2 `/emergency` command:
  - Call POST /v1/telegram/emergency with telegram_id, location (if shared), timestamp
  - Backend creates emergency_alerts record with driver_id, alert_type DRIVER_EMERGENCY, status ACTIVE
  - Immediately notify Admin Panel via WebSocket with driver details and location
  - Bot responds: "🚨 Emergency alert sent to dispatch. They will contact you immediately. Stay safe!"
  - Display emergency contacts:
    - Police: 117
    - Ambulance: 119
    - Tourist Police: 012 942 484
- [x] 10.3 `/support` command:
  - Prompt: "Please describe your issue or question:"
  - Store next message in Redis session: `telegram_session:{telegram_id}:support_request`
  - When driver sends description: call POST /v1/telegram/support
  - Backend creates support_tickets record with driver_id, message, status OPEN
  - Priority based on keywords (URGENT, EMERGENCY, ACCIDENT = HIGH/URGENT)
  - Bot confirms: "✅ Support ticket #{ticket_id} created. Our team will respond within 30 minutes."
  - Admin Panel receives real-time WebSocket notification

---

## T11: Admin Broadcast Messaging

- [x] 11.1 Admin broadcast API:
  - `POST /v1/admin/telegram/broadcast` — message, image_url, target_filter, admin_user_id
  - `GET /v1/admin/telegram/broadcasts` — broadcast history
- [x] 11.2 Target audience options:
  - All Drivers
  - Online Drivers Only
  - Offline Drivers
  - Drivers by Vehicle Type (VAN, BUS, TUK_TUK)
- [x] 11.3 Broadcast processing:
  - Backend queries drivers table based on target_filter
  - Create broadcast_messages record with status PENDING
  - Queue broadcast job in Bull queue with telegram_ids array
  - Send at rate of 30 messages per second (Telegram API limit)
  - Update sent_count/failed_count after each message
  - Update status to COMPLETED when done
- [x] 11.4 Delivery tracking:
  - Admin Panel displays broadcast history with sent_count, failed_count, status
  - Real-time WebSocket updates: `broadcast:status` event
  - Bot displays broadcasts with header: "📢 Message from DerLg Dispatch:"
- [x] 11.5 Audit logging:
  - Create audit_logs record: action_type = BROADCAST_SENT, including message content and recipient count

---

## T12: Bot Message Templates

- [x] 12.1 Registration templates:
  - Welcome message (first-time /start)
  - Registration success confirmation
- [x] 12.2 Status update templates:
  - Online confirmation
  - Offline confirmation
  - Offline error (active trip)
- [x] 12.3 Trip assignment templates:
  - New trip assignment notification
  - Trip accepted confirmation
  - Trip rejected confirmation
  - Auto-reject notification
- [x] 12.4 Trip management templates:
  - Trip started confirmation
  - Trip completed summary
  - No active trips message
- [x] 12.5 Emergency & support templates:
  - Emergency alert sent confirmation
  - Support ticket created confirmation
- [x] 12.6 Help & system templates:
  - /help command response
  - Language changed confirmation
  - Error messages (invalid command, rate limit, unauthorized)
- [ ] 12.7 All templates in 3 languages (EN, KM, ZH)
  - Currently EN only; KM and ZH translations pending

---

## T14: Integration with Admin Panel

- [x] 13.1 WebSocket events FROM backend TO admin panel:
  - `driver:status:changed` — driver uses /online or /offline → update DriverList status badge
  - `driver:registered` — driver completes /start → update registration badge to ✅
  - `assignment:response` — driver accepts/rejects trip → update DriverAssignmentPanel status
  - `driver:location:updated` — driver shares location → update map marker position
  - `driver:emergency` — driver sends /emergency → show modal alert with sound
  - `driver:support:ticket` — driver creates support ticket → add to SupportTicketList
  - `broadcast:status` — broadcast delivery progress → update sent_count in BroadcastHistory
- [x] 13.2 Shared database tables:
  - `drivers` — created by admin panel, used by both
  - `driver_assignments` — created by admin panel, updated by bot
  - `support_tickets` — created by bot, managed by admin
  - `broadcast_messages` — created by admin, delivered by bot
- [x] 13.3 Redis data structures:
  - `telegram_session:{telegram_id}` — Hash, TTL 1 hour
  - `driver_location:{driver_id}` — Hash, TTL 5 minutes
  - `telegram_rate:{telegram_id}` — String counter, TTL 1 minute
  - `telegram_driver:{telegram_id}` — String, TTL 30 days

---

## T15: Testing & Monitoring

- [x] 14.1 Unit tests for backend services:
  - `telegram.service.spec.ts` — register driver, reject invalid PIN
  - `callback.handler.ts` — update status, prevent offline with active trip
  - `assignment.service.spec.ts` — accept/reject/complete trip
  - `broadcast.service.spec.ts` — queue and send broadcasts
- [x] 14.2 Integration tests for webhook processing:
  - Test command handlers (/start, /online, /status)
  - Test callback handlers (accept/reject buttons)
  - Test message handlers (registration credentials)
- [x] 14.3 Manual testing checklist:
  - Automated via `npm run test:telegram:manual` (script: `scripts/telegram-manual-test.ts`)
  - Tests command response time (< 2 seconds) for /start, /status, /help, /online
  - Tests inline button callbacks (status:online, status:offline, etc.)
  - Tests rate limiting (30 req/min per telegram_id)
  - Tests location update processing via webhook
  - Tests webhook secret validation (dev mode passthrough)
  - Tests idempotency (duplicate update_id rejection)
- [x] 14.4 Load testing:
  - Automated via `npm run test:telegram:load` (script: `scripts/telegram-load-test.ts`)
  - 100+ concurrent drivers sending /status commands
  - 150 concurrent driver stress test
  - Broadcast queue rate limit verification
  - Redis pub/sub: 100 status change events
  - Sustained 10-second load test with batched requests

---

## T16: Monitoring & Observability

- [x] 16.1 Error logging:
  - Integrate Sentry for error tracking
  - Log all webhook processing errors
  - Alert on high error rates
- [x] 16.2 Metrics:
  - Webhook request count
  - Command usage frequency
  - Assignment acceptance rate
  - Average response time to assignments
  - Broadcast delivery rate
  - Bot uptime (target: 99.5%)
- [x] 16.3 Health checks:
  - Webhook endpoint health
  - Redis connection health
  - Telegram API connection health
  - Database connection health

---

## Implementation Summary

### Files Created
- `src/telegram/services/bot-sender.service.ts` — Telegram Bot API HTTP client
- `src/telegram/services/session.service.ts` — Redis session manager
- `scripts/telegram-manual-test.ts` — Automated T15.3 manual testing checklist
- `scripts/telegram-load-test.ts` — Automated T15.4 load testing

### Files Rewritten/Modified
- `src/telegram/telegram.module.ts` — registered new services and exports
- `src/telegram/telegram.controller.ts` — webhook reply sending via BotSenderService
- `src/telegram/telegram.service.ts` — business logic, assignment notifications, broadcast
- `src/telegram/handlers/command.handler.ts` — rich messages with inline keyboards
- `src/telegram/handlers/callback.handler.ts` — all callback actions
- `src/telegram/handlers/message.handler.ts` — session-aware routing
- `src/telegram/jobs/broadcast.processor.ts` — real Telegram API calls
- `src/admin/services/admin-assignments.service.ts` — triggers Telegram notifications
- `src/admin/admin.module.ts` — imports TelegramModule

### Test Files Updated
- `src/admin/services/admin-assignments.service.spec.ts` — added TelegramService mock
- `src/telegram/telegram.service.spec.ts` — added BotSenderService mock, $transaction mock
- `src/telegram/telegram.controller.spec.ts` — added BotSenderService mock

### Build & Test Results
- `npm run build` — ✅ passes (0 errors)
- `npm run test` — ✅ 39 suites, 352 tests passed

### Remaining Work
1. **Manual setup**: Register bot with BotFather, set env vars in production, call `setWebhook`
2. **Multilingual support**: Add KM and ZH translations for all bot message templates
3. **Manual testing**: End-to-end testing with real Telegram app and drivers
