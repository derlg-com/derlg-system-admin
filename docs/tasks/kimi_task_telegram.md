# Telegram Bot Tasks — DerLg Transportation Management System

> Source: `/docs/specs/telegram/requirements.md` + `/docs/specs/telegram/design.md` + `/docs/specs/telegram/INTEGRATION.md`
> Status: **All tasks pending (⬜)** — no Telegram module, no handlers, no services, no DTOs, no webhook endpoint. The bot does not exist.

---

## Overview

The Telegram Bot enables transportation drivers to manage availability and trip assignments via mobile phones without a dedicated app. It integrates with the System Admin Panel through shared database tables, Redis pub/sub, and WebSocket real-time updates.

---

## T1: Core Bot Setup & Configuration

- [ ] 1.1 Register bot with BotFather:
  - Create new bot on Telegram
  - Obtain bot token
  - Configure bot name, description, commands list
- [ ] 1.2 Environment variables:
  - `TELEGRAM_BOT_TOKEN` — from BotFather
  - `TELEGRAM_WEBHOOK_URL` — `https://your-domain.com/v1/telegram/webhook`
  - `TELEGRAM_SECRET_TOKEN` — random 32-char secret for webhook validation
  - `TELEGRAM_WEBHOOK_MAX_CONNECTIONS` — 40
  - `TELEGRAM_BOT_ENABLED=true`
  - `TELEGRAM_LOCATION_TRACKING_ENABLED=true`
  - `TELEGRAM_BROADCAST_ENABLED=true`
- [ ] 1.3 Set webhook URL via Telegram Bot API:
  - Use `setWebhook` with `secret_token` parameter
  - HTTPS with valid SSL certificate (required by Telegram)
  - Verify webhook is set correctly

---

## T2: NestJS Telegram Module Structure

- [ ] 2.1 Create `TelegramModule`:
  - `src/telegram/telegram.module.ts` — module definition with imports (Bull, Redis, Prisma)
  - `src/telegram/telegram.controller.ts` — webhook endpoint controller
  - `src/telegram/telegram.service.ts` — core bot orchestration
- [ ] 2.2 Create handlers:
  - `src/telegram/handlers/command.handler.ts` — command routing (/start, /online, /offline, /status, /mytrip, /history, /emergency, /support, /help)
  - `src/telegram/handlers/callback.handler.ts` — inline button callbacks (accept/reject trip, start/complete trip)
  - `src/telegram/handlers/location.handler.ts` — location update processing
  - `src/telegram/handlers/message.handler.ts` — text message processing (registration credentials, support descriptions)
- [ ] 2.3 Create services:
  - `src/telegram/services/bot-sender.service.ts` — Telegram API message sender (sendMessage, sendPhoto, editMessage)
  - `src/telegram/services/driver-status.service.ts` — status management logic (AVAILABLE/UNAVAILABLE/BUSY transitions)
  - `src/telegram/services/assignment.service.ts` — trip assignment operations (accept, reject, start, complete)
  - `src/telegram/services/broadcast.service.ts` — broadcast message handling
  - `src/telegram/services/registration.service.ts` — driver registration flow
- [ ] 2.4 Create DTOs:
  - `src/telegram/dto/webhook-update.dto.ts` — Telegram Update object validation
  - `src/telegram/dto/register-driver.dto.ts` — registration payload
  - `src/telegram/dto/status-update.dto.ts` — status change payload
  - `src/telegram/dto/assignment-action.dto.ts` — accept/reject payload
  - `src/telegram/dto/location-update.dto.ts` — location coordinates
  - `src/telegram/dto/broadcast-message.dto.ts` — broadcast payload
- [ ] 2.5 Create guards:
  - `src/telegram/guards/telegram-auth.guard.ts` — validate telegram_id exists in drivers table
  - `src/telegram/guards/webhook-secret.guard.ts` — validate Telegram secret token in header
- [ ] 2.6 Create job processors (Bull queue):
  - `src/telegram/jobs/broadcast.processor.ts` — process broadcast queue (30 msg/sec rate limit)
  - `src/telegram/jobs/assignment-timeout.processor.ts` — auto-reject assignment after 5 minutes
  - `src/telegram/jobs/location-cleanup.processor.ts` — clean old location data from Redis
- [ ] 2.7 Create interfaces:
  - `src/telegram/interfaces/telegram-context.interface.ts`
  - `src/telegram/interfaces/driver-session.interface.ts`
  - `src/telegram/interfaces/bot-message.interface.ts`

---

## T3: Webhook Security & Rate Limiting
**Source:** Telegram Requirement 9

- [ ] 3.1 Webhook endpoint: `POST /v1/telegram/webhook`
  - Receives updates from Telegram servers (messages, callback queries, location updates)
  - Immediate 200 OK response (acknowledge within 1 second)
  - Async processing via Bull queue
- [ ] 3.2 Secret token validation:
  - Check `X-Telegram-Bot-Api-Secret-Token` header
  - Return 403 Forbidden if invalid or missing
- [ ] 3.3 Payload validation:
  - Validate structure matches Telegram Update object schema
  - Return 400 Bad Request if malformed
- [ ] 3.4 Rate limiting:
  - 30 requests per minute per telegram_id using Redis counter (`telegram_rate:{telegram_id}`)
  - Return 429 Too Many Requests if exceeded
  - Bot displays: "⚠️ Too many requests. Please wait a moment."
- [ ] 3.5 Idempotency:
  - Check `update_id` in Redis to prevent duplicate processing
  - Store processed update_ids with TTL
- [ ] 3.6 Logging:
  - Log all webhook requests with telegram_id, update_type, timestamp
  - Error logging to Sentry

---

## T4: Driver Registration Flow
**Source:** Telegram Requirement 1

- [ ] 4.1 `/start` command (first time):
  - Welcome message with registration instructions
  - Prompt for credentials in format: `driver_id: <ID> pin: <PIN>`
  - Example: "driver_id: DRV001 pin: 1234"
- [ ] 4.2 Credential validation:
  - Call Backend_API POST /v1/telegram/register
  - Backend verifies driver_id exists in drivers table
  - Backend verifies pin matches drivers.auth_pin (bcrypt)
  - Return 401 Unauthorized if invalid
- [ ] 4.3 Registration success:
  - Update drivers.telegram_id with user's telegram_id
  - Store mapping in Redis: `telegram_driver:{telegram_id}` (30 days TTL)
  - Create audit_logs record: action_type = DRIVER_TELEGRAM_REGISTERED
  - Display confirmation with driver name, assigned vehicle, current status
- [ ] 4.4 `/start` command (registered user):
  - Display status dashboard instead of registration prompt
  - Show current status, vehicle, last update time
  - Inline keyboard: [Go Online] [Go Offline] [View Trips]
- [ ] 4.5 Session state management:
  - Redis key: `telegram_session:{telegram_id}`
  - Type: Hash, TTL: 1 hour
  - Fields: state, data, last_command

---

## T5: Driver Status Management
**Source:** Telegram Requirement 2

- [ ] 5.1 `/online` command:
  - Call POST /v1/telegram/status with status: AVAILABLE
  - Backend updates drivers.status to AVAILABLE, last_status_update to now
  - Publish to Redis: `driver_status_changed:{driver_id}`
  - Bot responds: "✅ You are now ONLINE and available for trips"
  - Inline keyboard: [Go Offline] [View Trips]
- [ ] 5.2 `/offline` command:
  - Call POST /v1/telegram/status with status: UNAVAILABLE
  - Backend verifies no active assignments (driver_assignments with completion_timestamp IS NULL)
  - If active assignments exist: return 409 Conflict
  - Bot displays: "❌ Cannot go offline. You have an active trip. Complete it first."
  - If no active assignments: update status to UNAVAILABLE
  - Bot confirms: "✅ You are now OFFLINE"
  - Inline keyboard: [Go Online]
- [ ] 5.3 `/status` command:
  - Call GET /v1/telegram/driver-info?telegram_id={id}
  - Display current status, assigned vehicle name, last status update time
  - Inline keyboard: [Go Online] [Go Offline] [View Trips]
- [ ] 5.4 Inline button callbacks:
  - `status:online` → go online
  - `status:offline` → go offline
  - `status:view` → view detailed status
- [ ] 5.5 Audit logging:
  - Create audit_logs records for all status changes: action_type = DRIVER_STATUS_CHANGE

---

## T6: Trip Assignment Notifications
**Source:** Telegram Requirement 3

- [ ] 6.1 Assignment creation trigger:
  - When admin assigns driver via POST /v1/admin/assignments
  - Backend creates driver_assignment record
  - Backend retrieves driver's telegram_id from drivers table
  - Backend sends Telegram message via Bot API sendMessage
- [ ] 6.2 Notification message content:
  - Pickup location, destination, pickup time
  - Customer name, number of passengers
  - Booking reference
  - Inline keyboard: [Accept Trip] [Reject Trip]
  - Countdown: "⏰ Please respond within 5 minutes"
- [ ] 6.3 Driver accepts trip:
  - Driver taps [Accept Trip] → callback query to webhook
  - Call POST /v1/telegram/assignments/:id/accept
  - Backend updates assignment status to ACCEPTED, driver status to BUSY
  - Bot sends: "✅ Trip accepted. Customer has been notified. Pickup at {location} at {time}"
  - Inline keyboard: [Start Trip] [View Details] [Contact Support]
- [ ] 6.4 Driver rejects trip:
  - Driver taps [Reject Trip] → callback query with optional reason
  - Call POST /v1/telegram/assignments/:id/reject
  - Backend updates assignment status to REJECTED, driver status back to AVAILABLE
  - Notify Admin Panel via WebSocket that assignment was rejected
  - Bot sends: "❌ Trip rejected. Dispatch has been notified."
- [ ] 6.5 Auto-reject timeout:
  - If driver does not respond within 5 minutes
  - Bull queue processor auto-rejects
  - Notify admin via WebSocket
  - Update assignment status to REJECTED
- [ ] 6.6 Audit logging:
  - Create audit_logs records: action_type = TRIP_ACCEPTED or TRIP_REJECTED

---

## T7: Active Trip Management
**Source:** Telegram Requirement 4

- [ ] 7.1 `/mytrip` command:
  - Call GET /v1/telegram/assignments/active?telegram_id={id}
  - Backend queries driver_assignments for ACCEPTED status with completion_timestamp IS NULL
  - If active trip exists: display booking ref, customer name, pickup, destination, time, phone, special requests
  - Inline keyboard: [Start Trip] [Complete Trip] [Contact Support]
  - If no active trip: "No active trips. Status: {current_status}" with [Go Online] button
- [ ] 7.2 Start trip:
  - Driver taps [Start Trip]
  - Call POST /v1/telegram/assignments/:id/start
  - Backend updates trip_start_time, bookings.status to IN_PROGRESS
  - Bot confirms: "🚗 Trip started. Drive safely!"
  - Prompt: "📍 Share your live location for this trip?" [Share Location] [Skip]
  - Inline keyboard: [Complete Trip] [Emergency]
- [ ] 7.3 Complete trip:
  - Driver taps [Complete Trip]
  - Call POST /v1/telegram/assignments/:id/complete
  - Backend updates completion_timestamp, bookings.status to COMPLETED, driver status to AVAILABLE
  - Publish to Redis: `driver_status_changed:{driver_id}` with status AVAILABLE
  - Bot displays: "✅ Trip completed! You are now available for new assignments."
  - Show trip summary: duration, distance (if available)
  - Inline keyboard: [View History] [Go Offline]
- [ ] 7.4 Audit logging:
  - Create audit_logs records: action_type = TRIP_STARTED, TRIP_COMPLETED

---

## T8: Trip History & Earnings
**Source:** Telegram Requirement 5

- [ ] 8.1 `/history` command:
  - Call GET /v1/telegram/assignments/history?telegram_id={id}&limit=10
  - Backend queries driver_assignments with completion_timestamp IS NOT NULL, ordered DESC
  - Display list of last 10 completed trips: date, booking ref, route, duration
  - Inline keyboard: [Today's Summary] [This Week] [This Month]
- [ ] 8.2 Earnings endpoints:
  - `GET /v1/telegram/earnings/today` — today's summary
  - `GET /v1/telegram/earnings/week` — weekly summary
  - Backend calculates: total trips, total hours worked, estimated earnings
- [ ] 8.3 Earnings display format:
  ```
  📊 Today's Summary
  ✅ Trips: {count}
  ⏱ Hours: {hours}
  💰 Earnings: ${amount}
  ```
- [ ] 8.4 Weekly/Monthly summaries:
  - Same format as daily summary
  - Breakdown by day available via [View Details] button
- [ ] 8.5 Empty state:
  - If no trips: "No trips completed in this period."

---

## T9: Location Sharing & Tracking
**Source:** Telegram Requirement 7

- [ ] 9.1 Location sharing prompt:
  - On trip start: "📍 Share your live location for this trip?"
  - Inline buttons: [Share Location] [Skip]
- [ ] 9.2 Location permission:
  - When driver taps [Share Location], request Telegram live location sharing
  - Telegram sends location updates to webhook every 60 seconds
- [ ] 9.3 Location update processing:
  - Bot calls POST /v1/telegram/location with telegram_id, latitude, longitude, timestamp
  - Backend stores in Redis: `driver_location:{driver_id}` (Hash, 5-min TTL)
  - Publish to Redis: `driver_location_updated:{driver_id}`
- [ ] 9.4 Admin Panel integration:
  - Admin Panel subscribes to location updates
  - Displays driver position on real-time map in emergency/booking detail views
- [ ] 9.5 Location during active trip:
  - `/location` command displays current location and destination on map
  - Show estimated time to destination and distance remaining
  - If location not shared: prompt to enable with [Share Now] button
- [ ] 9.6 Privacy compliance:
  - Do NOT store historical location data beyond current trip
  - Automatically delete location data when trip completes

---

## T10: Emergency & Support Features
**Source:** Telegram Requirement 6

- [ ] 10.1 `/help` command:
  - Display list of available commands with descriptions
  - Include: /start, /online, /offline, /status, /mytrip, /history, /emergency, /support
- [ ] 10.2 `/emergency` command:
  - Call POST /v1/telegram/emergency with telegram_id, location (if shared), timestamp
  - Backend creates emergency_alerts record with driver_id, alert_type DRIVER_EMERGENCY, status ACTIVE
  - Immediately notify Admin Panel via WebSocket with driver details and location
  - Bot responds: "🚨 Emergency alert sent to dispatch. They will contact you immediately. Stay safe!"
  - Display emergency contacts:
    - Police: 117
    - Ambulance: 119
    - Tourist Police: 012 942 484
- [ ] 10.3 `/support` command:
  - Prompt: "Please describe your issue or question:"
  - Store next message in Redis session: `telegram_session:{telegram_id}:support_request`
  - When driver sends description: call POST /v1/telegram/support
  - Backend creates support_tickets record with driver_id, message, status OPEN
  - Priority based on keywords (URGENT, EMERGENCY, ACCIDENT = HIGH/URGENT)
  - Bot confirms: "✅ Support ticket #{ticket_id} created. Our team will respond within 30 minutes."
  - Admin Panel receives real-time WebSocket notification

---


---

## T11: Admin Broadcast Messaging
**Source:** Telegram Requirement 10

- [ ] 11.1 Admin broadcast API:
  - `POST /v1/admin/telegram/broadcast` — message, image_url, target_filter, admin_user_id
  - `GET /v1/admin/telegram/broadcasts` — broadcast history
- [ ] 11.2 Target audience options:
  - All Drivers
  - Online Drivers Only
  - Offline Drivers
  - Drivers by Vehicle Type (VAN, BUS, TUK_TUK)
- [ ] 11.3 Broadcast processing:
  - Backend queries drivers table based on target_filter
  - Create broadcast_messages record with status PENDING
  - Queue broadcast job in Bull queue with telegram_ids array
  - Send at rate of 30 messages per second (Telegram API limit)
  - Update sent_count/failed_count after each message
  - Update status to COMPLETED when done
- [ ] 11.4 Delivery tracking:
  - Admin Panel displays broadcast history with sent_count, failed_count, status
  - Real-time WebSocket updates: `broadcast:status` event
  - Bot displays broadcasts with header: "📢 Message from DerLg Dispatch:"
- [ ] 11.5 Audit logging:
  - Create audit_logs record: action_type = BROADCAST_SENT, including message content and recipient count

---

## T12: Bot Message Templates
**Source:** Telegram design.md

- [ ] 12.1 Registration templates:
  - Welcome message (first-time /start)
  - Registration success confirmation
- [ ] 12.2 Status update templates:
  - Online confirmation
  - Offline confirmation
  - Offline error (active trip)
- [ ] 12.3 Trip assignment templates:
  - New trip assignment notification
  - Trip accepted confirmation
  - Trip rejected confirmation
  - Auto-reject notification
- [ ] 12.4 Trip management templates:
  - Trip started confirmation
  - Trip completed summary
  - No active trips message
- [ ] 12.5 Emergency & support templates:
  - Emergency alert sent confirmation
  - Support ticket created confirmation
- [ ] 12.6 Help & system templates:
  - /help command response
  - Language changed confirmation
  - Error messages (invalid command, rate limit, unauthorized)
- [ ] 12.7 All templates in 3 languages (EN, KM, ZH)

---

## T14: Integration with Admin Panel
**Source:** INTEGRATION.md

- [ ] 13.1 WebSocket events FROM backend TO admin panel:
  - `driver:status:changed` — driver uses /online or /offline → update DriverList status badge
  - `driver:registered` — driver completes /start → update registration badge to ✅
  - `assignment:response` — driver accepts/rejects trip → update DriverAssignmentPanel status
  - `driver:location:updated` — driver shares location → update map marker position
  - `driver:emergency` — driver sends /emergency → show modal alert with sound
  - `driver:support:ticket` — driver creates support ticket → add to SupportTicketList
  - `broadcast:status` — broadcast delivery progress → update sent_count in BroadcastHistory
- [ ] 13.2 Shared database tables:
  - `drivers` — created by admin panel, used by both
  - `driver_assignments` — created by admin panel, updated by bot
  - `support_tickets` — created by bot, managed by admin
  - `broadcast_messages` — created by admin, delivered by bot
- [ ] 13.3 Redis data structures:
  - `telegram_session:{telegram_id}` — Hash, TTL 1 hour
  - `driver_location:{driver_id}` — Hash, TTL 5 minutes
  - `telegram_rate:{telegram_id}` — String counter, TTL 1 minute
  - `telegram_driver:{telegram_id}` — String, TTL 30 days

---

## T15: Testing & Monitoring
**Source:** Telegram requirements.md Testing Strategy

- [ ] 14.1 Unit tests for backend services:
  - `telegram.service.spec.ts` — register driver, reject invalid PIN
  - `driver-status.service.spec.ts` — update status, prevent offline with active trip
  - `assignment.service.spec.ts` — accept/reject/complete trip
  - `broadcast.service.spec.ts` — queue and send broadcasts
- [ ] 14.2 Integration tests for webhook processing:
  - Test command handlers (/start, /online, /status)
  - Test callback handlers (accept/reject buttons)
  - Test message handlers (registration credentials)
- [ ] 14.3 Manual testing checklist:
  - Bot responds to all commands within 2 seconds
  - Status updates reflect in Admin Panel within 5 seconds
  - Assignment notifications delivered within 5 seconds
  - Auto-reject works after 5 minutes
  - Rate limiting blocks after 30 req/min
  - Location updates received every 60 seconds
- [ ] 14.4 Load testing:
  - Test with 100+ concurrent drivers
  - Verify broadcast sends at 30 msg/sec
  - Check Redis pub/sub performance

---

## T16: Monitoring & Observability

- [ ] 16.1 Error logging:
  - Integrate Sentry for error tracking
  - Log all webhook processing errors
  - Alert on high error rates
- [ ] 16.2 Metrics:
  - Webhook request count
  - Command usage frequency
  - Assignment acceptance rate
  - Average response time to assignments
  - Broadcast delivery rate
  - Bot uptime (target: 99.5%)
- [ ] 16.3 Health checks:
  - Webhook endpoint health
  - Redis connection health
  - Telegram API connection health
  - Database connection health
