# DerLg Admin Panel User Guide

> Version: 1.0 | Last updated: 2026-05-17

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [User Roles and Permissions](#user-roles-and-permissions)
3. [Dashboard](#dashboard)
4. [Driver Management](#driver-management)
5. [Vehicle Fleet Management](#vehicle-fleet-management)
6. [Booking Operations](#booking-operations)
7. [Hotel Inventory](#hotel-inventory)
8. [Tour Guide Management](#tour-guide-management)
9. [Emergency Alerts](#emergency-alerts)
10. [Customer Support](#customer-support)
11. [Discount Codes](#discount-codes)
12. [Analytics and Reporting](#analytics-and-reporting)
13. [Admin User Management](#admin-user-management)
14. [Telegram Integration](#telegram-integration)
15. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Login

1. Navigate to `https://admin.derlg.com/login`
2. Enter your email and password
3. Click **Sign In**

Your session is valid for 15 minutes. The system automatically refreshes your token in the background. If your session expires, you will be redirected to the login page.

### Navigation

The admin panel uses a sidebar navigation layout:

- **Left sidebar**: Menu items filtered by your role permissions
- **Top bar**: Your profile, notification bell, WebSocket connection status, and logout button
- **Main content**: Feature-specific pages and data tables

The sidebar can be collapsed on desktop using the arrow button at the bottom. On mobile, tap the hamburger menu to open the sidebar overlay.

### WebSocket Connection

A green dot in the top bar indicates a live WebSocket connection. This enables real-time updates for driver status changes, new bookings, and emergency alerts. If the connection drops, the dot turns red and the system attempts to reconnect automatically every 10 seconds (with exponential backoff up to 60 seconds).

---

## User Roles and Permissions

The admin panel supports four roles with progressively narrower access:

| Role | Access |
|------|--------|
| **SUPER_ADMIN** | Full access to all features, including user management, audit logs, and data export |
| **OPERATIONS_MANAGER** | Fleet, inventory, bookings, emergency alerts, customers, discounts, analytics |
| **FLEET_MANAGER** | Drivers, vehicles, maintenance, driver assignments |
| **SUPPORT_AGENT** | Bookings (view, modify, cancel) and customer profiles only |

Menu items you cannot access are hidden from the sidebar. If you attempt to access a restricted URL directly, you will see an access denied page.

---

## Dashboard

The dashboard is the landing page after login. It provides a real-time overview of today's operations.

### Metric Cards

- **Bookings Today**: Total bookings created today
- **Revenue Today**: Confirmed booking revenue in USD
- **Active Drivers**: Drivers currently AVAILABLE or BUSY
- **Open Emergencies**: Unresolved emergency alerts requiring attention

### Booking Trend Chart

A line chart showing daily booking counts for the past 30 days. Hover over data points to see exact counts.

### Pending Actions

- **Unassigned Bookings**: Transport bookings without a driver assignment
- **Upcoming Maintenance**: Vehicles scheduled for maintenance within 7 days

### Recent Emergency Alerts

The 5 most recent emergency alerts with type, customer name, and status badge. Click an alert to view details.

### Auto-Refresh

Dashboard data refreshes automatically every 60 seconds. You can also pull to refresh on mobile.

---

## Driver Management

> Accessible to: SUPER_ADMIN, OPERATIONS_MANAGER, FLEET_MANAGER

### Driver List

Navigate to **Drivers** in the sidebar to view all registered drivers.

**Columns:**
- Name
- Driver ID (e.g., DRV001)
- Vehicle assignment
- Status (AVAILABLE, BUSY, OFFLINE)
- Last status update
- Telegram registration status

**Filters:**
- **Status**: AVAILABLE, BUSY, OFFLINE
- **Telegram**: Registered, Not Registered
- **Search**: By name or driver ID

**Real-time updates**: Driver status changes made via the Telegram bot appear instantly without refreshing the page.

### Adding a New Driver

1. Click **Add Driver** in the top right
2. Fill in the form:
   - **Driver Name**: Full name
   - **Driver ID**: Unique identifier (e.g., DRV001)
   - **Phone**: Cambodian format (+855...)
   - **Vehicle**: Select from available vehicles
   - **Auth PIN**: Auto-generated 4-digit PIN for Telegram bot registration
3. Click **Save**
4. Share the Driver ID and PIN with the driver for Telegram bot registration

### Editing a Driver

1. Click the **Edit** icon on a driver row
2. Update fields as needed
3. Click **Save**

### Telegram Registration Status

- **Registered**: The driver has linked their Telegram account via the bot
- **Not Registered**: The driver has not yet registered. Click **Resend Credentials** to copy the Driver ID and PIN for sharing.

### Driver Detail View

Click a driver's name to view:
- Profile information
- Assigned vehicle details
- Assignment history
- Performance metrics (total trips, average rating)

---

## Vehicle Fleet Management

> Accessible to: SUPER_ADMIN, OPERATIONS_MANAGER, FLEET_MANAGER

### Vehicle List

Navigate to **Vehicles** in the sidebar.

**Columns:**
- Name
- Category (VAN, BUS, TUK_TUK)
- Capacity
- Tier (STANDARD, VIP)
- Price per day / per km
- Assigned driver

**Filters:**
- **Category**: VAN, BUS, TUK_TUK
- **Tier**: STANDARD, VIP
- **Search**: By vehicle name

### Adding a Vehicle

1. Click **Add Vehicle**
2. Fill in:
   - Name
   - Category
   - Capacity (number of passengers)
   - Tier
   - Price per day and per km
   - Features (multi-select: AC, WiFi, Luggage space, etc.)
   - Images (upload via drag-and-drop)
3. Click **Save**

### Maintenance Scheduling

1. Go to a vehicle's detail page
2. Click **Schedule Maintenance**
3. Enter:
   - Maintenance type (Oil change, Tire replacement, Inspection, etc.)
   - Scheduled date
   - Notes
4. Click **Schedule**

**Maintenance reminders** appear on the dashboard when maintenance is due within 3 days.

### Maintenance History

View past maintenance records with dates, types, costs, and status. The total maintenance cost per vehicle is calculated automatically.

---

## Booking Operations

> Accessible to: SUPER_ADMIN, OPERATIONS_MANAGER, SUPPORT_AGENT

### Booking List

Navigate to **Bookings** in the sidebar.

**Columns:**
- Booking reference (e.g., BK20240517001)
- Customer name
- Booking type (PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY)
- Status (RESERVED, CONFIRMED, CANCELLED, COMPLETED, REFUNDED)
- Travel date
- Total (USD)

**Filters:**
- **Type**: PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY
- **Status**: RESERVED, CONFIRMED, CANCELLED, COMPLETED, REFUNDED
- **Date range**: Travel date range
- **AI-assisted**: Show only AI-assisted bookings
- **Search**: By booking reference or customer email

### Booking Detail View

Click a booking reference to view complete details:

**Header:**
- Booking reference with status badge
- AI-assisted indicator (if applicable)
- Modify and Cancel buttons (only for RESERVED/CONFIRMED bookings)

**Booking Details:**
- Travel dates
- Passenger count (adults + children)
- Total amount
- Special requests and customizations

**Services:**
- Trip details
- Hotel details
- Vehicle details
- Guide details

**Customer:**
- Name, email, phone

**Payment History:**
- Payment method, status, amount, date

**Price Breakdown:**
- Subtotal
- Discount (if applicable)
- Total

### Modifying a Booking

1. Open the booking detail
2. Click **Modify**
3. Update travel dates, passenger count, or customizations
4. Click **Save**

### Cancelling a Booking

1. Open the booking detail
2. Click **Cancel**
3. Confirm the cancellation in the dialog
4. The system processes a refund automatically if payment was made

### Driver Assignment

For transport bookings:

1. Open the booking detail
2. In the right sidebar, find the **Assign Driver** section
3. Select an available driver from the dropdown
4. Click **Assign**

The system verifies:
- Driver status is AVAILABLE
- Vehicle capacity matches passenger count

Once assigned, the driver receives a Telegram notification with trip details and Accept/Reject buttons.

**Assignment Status:**
- **Pending**: Waiting for driver response (5-minute timeout)
- **Accepted**: Driver accepted the trip
- **Rejected**: Driver rejected the trip
- **Expired**: Driver did not respond within 5 minutes

---

## Hotel Inventory

> Accessible to: SUPER_ADMIN, OPERATIONS_MANAGER

### Hotel List

Navigate to **Hotels** in the sidebar.

**Columns:**
- Name
- Location
- Rating
- Room count

### Adding a Hotel

1. Click **Add Hotel**
2. Fill in:
   - Name and description
   - Location (use the map picker to set latitude/longitude)
   - Rating
   - Amenities
   - Check-in/check-out times
   - Cancellation policy
   - Images
3. Click **Save**

### Room Management

1. Go to a hotel's detail page
2. Click **Manage Rooms**
3. Add, edit, or delete rooms:
   - Name and description
   - Capacity
   - Price per night
   - Amenities
   - Images

### Room Availability

The calendar view shows booked dates for each room. Bookings with status CONFIRMED or RESERVED block the room for those dates.

---

## Tour Guide Management

> Accessible to: SUPER_ADMIN, OPERATIONS_MANAGER

### Guide List

Navigate to **Guides** in the sidebar.

**Columns:**
- Name
- Languages
- Specialties
- Rating
- Price per hour / per day

**Filters:**
- **Languages**: Multi-select (English, Khmer, Chinese, etc.)
- **Specialties**: Multi-select (Historical, Cultural, Adventure, etc.)

### Adding a Guide

1. Click **Add Guide**
2. Fill in:
   - Name and bio
   - Profile picture
   - Languages spoken
   - Specialties
   - Experience years
   - Certifications
   - Price per hour and per day
3. Click **Save**

### Guide Availability

The calendar shows confirmed bookings for each guide. Overlapping dates are blocked for new assignments.

---

## Emergency Alerts

> Accessible to: SUPER_ADMIN, OPERATIONS_MANAGER, SUPPORT_AGENT

### Alert List

Navigate to **Emergency** in the sidebar.

**Columns:**
- Alert type (SOS, MEDICAL, THEFT, LOST)
- Customer name
- Location (latitude/longitude)
- Status (SENT, ACKNOWLEDGED, RESOLVED)
- Time

**Filters:**
- **Status**: SENT, ACKNOWLEDGED, RESOLVED
- **Type**: SOS, MEDICAL, THEFT, LOST

### Active Emergency Banner

When SENT alerts exist, a prominent red banner appears at the top of the page: "Active emergency alerts requiring immediate attention."

### Alert Detail View

Click an alert to view:
- Alert type and message
- Customer contact information
- Location on a Leaflet.js map
- Assigned driver contact (if applicable)

### Responding to Alerts

1. Open the alert detail
2. Click **Acknowledge** to confirm you are handling the alert
3. After resolving the situation, click **Resolve** and add resolution notes

### Sound Notifications

New emergency alerts trigger a browser notification and sound. Toggle sound on/off using the speaker icon in the top right of the alert list.

---

## Customer Support

> Accessible to: SUPER_ADMIN, OPERATIONS_MANAGER, SUPPORT_AGENT

### Customer List

Navigate to **Customers** in the sidebar.

**Columns:**
- Name
- Email
- Phone
- Loyalty points
- Student verification status

**Search:** By name, email, or phone

### Customer Profile

Click a customer to view:
- Profile information
- Booking history
- Loyalty points balance and transaction history
- Reviews and feedback
- Emergency alerts history

### Loyalty Points Adjustment

1. Open a customer profile
2. Click **Adjust Points**
3. Enter points amount (positive to add, negative to deduct)
4. Add a description
5. Click **Save**

---

## Discount Codes

> Accessible to: SUPER_ADMIN, OPERATIONS_MANAGER

### Discount Code List

Navigate to **Discounts** in the sidebar.

**Columns:**
- Code
- Discount percentage
- Valid from/until dates
- Usage count / max usage
- Active status

### Creating a Discount Code

1. Click **Add Discount**
2. Fill in:
   - Code (unique, e.g., SUMMER2026)
   - Discount percentage (1-100)
   - Valid date range
   - Maximum usage count
3. Click **Save**

### Student Verification Queue

Navigate to **Discounts > Student Verifications**.

Pending verifications show:
- Student name
- Submitted at
- Status

### Reviewing a Verification

1. Click **Review** on a pending verification
2. View the uploaded student ID and selfie images side-by-side
3. Click **Approve** or **Reject**
4. If rejecting, add a reason

---

## Analytics and Reporting

> Accessible to: SUPER_ADMIN, OPERATIONS_MANAGER

### Analytics Dashboard

Navigate to **Analytics** in the sidebar.

**Metrics:**
- Revenue by booking type (PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY)
- Booking statistics (total, by status, cancellation rate)
- Driver performance (total trips, average rating, revenue generated)
- Popular destinations
- Hotel occupancy rate
- Guide utilization rate

**Charts:**
- Revenue bar chart by booking type
- Booking trend line chart
- Driver performance table (sortable)

### Date Range Selector

Select a date range (7, 14, 30, 90 days) to filter all metrics.

### Export

Click **Export** to download a CSV or PDF report for the selected date range and metric type.

---

## Admin User Management

> Accessible to: SUPER_ADMIN only

### Admin User List

Navigate to **Admin Users** in the sidebar.

**Columns:**
- Name
- Email
- Admin role
- Permissions
- Active status

### Creating an Admin User

1. Click **Add Admin**
2. Fill in:
   - Email
   - Name
   - Admin role (SUPER_ADMIN, OPERATIONS_MANAGER, FLEET_MANAGER, SUPPORT_AGENT)
   - Permissions (checkboxes)
3. Click **Save**

**Role presets:**
- SUPER_ADMIN: All permissions
- OPERATIONS_MANAGER: Fleet, inventory, bookings, emergency, customers, discounts, analytics
- FLEET_MANAGER: Drivers, vehicles, maintenance
- SUPPORT_AGENT: Bookings, customers

### Deactivating an Admin

1. Click **Edit** on an admin user
2. Toggle **Active** off
3. Click **Save**

All active sessions for that user are revoked immediately.

---

## Telegram Integration

> Accessible to: SUPER_ADMIN, OPERATIONS_MANAGER, FLEET_MANAGER

### Broadcast Messages

Navigate to **Telegram > Broadcast**.

Compose and send messages to driver groups:

1. Enter your message
2. Optionally upload an image
3. Select audience:
   - All Drivers
   - Online Only
   - Offline Only
   - By Vehicle Type (VAN, BUS, TUK_TUK)
4. Preview the message
5. Click **Send**

**Broadcast History:**
View past broadcasts with delivery status (sent count, failed count, completion status).

### Analytics

Navigate to **Telegram > Analytics**.

**Metrics:**
- Total registered drivers
- Active drivers (used bot in last 24h)
- Average response time to assignments
- Command usage frequency

**Charts:**
- Daily active drivers (line chart)
- Command usage breakdown (pie chart)
- Assignment acceptance rate (bar chart)

### Support Tickets

Navigate to **Telegram > Support**.

View support tickets created by drivers via the Telegram bot `/support` command.

**Columns:**
- Ticket ID
- Driver name
- Message
- Status (OPEN, IN_PROGRESS, RESOLVED)
- Priority (LOW, MEDIUM, HIGH, URGENT)
- Created at

**Actions:**
- **Assign**: Assign to a support agent
- **Resolve**: Mark as resolved

New tickets appear in real-time via WebSocket notification.

---

## Troubleshooting

### Cannot log in

- Verify your email and password
- Check that your account has role ADMIN or SUPPORT in the system
- Contact a SUPER_ADMIN if your account is deactivated

### Data not loading

- Check the WebSocket connection indicator (top bar)
- Refresh the page
- Check your network connection
- Verify API server is reachable

### Driver status not updating

- Ensure the driver has registered their Telegram account
- Check that the WebSocket connection is active
- Verify the driver used the `/online` or `/offline` command correctly

### Assignment notifications not received by driver

- Verify the driver has a registered Telegram account (telegram_id is set)
- Check that the driver is not blocked by the bot
- Verify the bot token and webhook are configured correctly

### Emergency alerts not appearing

- Check browser notification permissions
- Verify sound is enabled
- Ensure WebSocket connection is active

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + K` | Open command palette |
| `Ctrl + /` | Toggle sidebar |
| `Esc` | Close modal or dropdown |

---

## Support

For technical issues or feature requests, contact the development team at `dev@derlg.com`.
