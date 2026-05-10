# DerLg System Admin — Architecture Diagrams

> Generated: 2026-05-10

## 1. System Context

```mermaid
flowchart TB
    subgraph AdminRepo["derlg-system-admin (this repo)"]
        direction TB
        FE_Admin["Next.js Admin Frontend<br/>Port 3002"]
        BE_Admin["NestJS Admin Backend<br/>Port 3003"]
    end

    subgraph DerLg["DerLg Main (derlg-com/derlg)"]
        FE["Next.js Customer App<br/>Port 3000"]
        BE["NestJS Main API<br/>Port 3001"]
    end

    subgraph Data["Shared Data Stores"]
        PG[("PostgreSQL<br/>Supabase")]
        Redis[("Redis<br/>Upstash")]
        Storage[("Supabase Storage")]
    end

    subgraph External["External"]
        Telegram["Telegram Bot"]
        Stripe["Stripe"]
    end

    FE_Admin -->|"REST /v1/admin/*"| BE_Admin
    FE_Admin -->|"WebSocket"| BE_Admin
    BE_Admin -->|"Prisma"| PG
    BE_Admin -->|"Pub/Sub + Cache"| Redis
    BE_Admin -->|"Files"| Storage
    Telegram -->|"Webhook POST /v1/telegram/driver-status"| BE_Admin
    BE_Admin -->|"Read bookings/users"| PG
```

## 2. Driver Assignment Flow

```mermaid
sequenceDiagram
    participant Admin as Admin UI
    participant BE as NestJS Admin Backend
    participant PG as PostgreSQL
    participant Redis as Redis

    Admin->>BE: POST /v1/admin/assignments { driver_id, booking_id, vehicle_id }
    BE->>PG: SELECT status FROM drivers WHERE id = ?
    alt Driver is AVAILABLE
        PG-->>BE: status = AVAILABLE
        BE->>PG: BEGIN TRANSACTION
        BE->>PG: INSERT INTO driver_assignments
        BE->>PG: UPDATE drivers SET status = 'BUSY'
        BE->>PG: COMMIT
        BE->>Redis: PUBLISH driver_status_changed:{driver_id} { status: BUSY }
        BE-->>Admin: 201 Created { assignment }
    else Driver not AVAILABLE
        PG-->>BE: status = BUSY or OFFLINE
        BE-->>Admin: 409 Conflict "Driver not available"
    end
```

## 3. Telegram → Real-Time Status Sync

```mermaid
sequenceDiagram
    participant Driver as Driver (Telegram)
    participant Bot as Telegram Bot
    participant BE as NestJS Backend
    participant PG as PostgreSQL
    participant Redis as Redis
    participant Admin as Admin UI (WebSocket)

    Driver->>Bot: /online vehicle_id: ABC driver_name: Sok
    Bot->>BE: POST /v1/telegram/driver-status { telegram_id, vehicle_id, driver_name, status: AVAILABLE }
    BE->>PG: UPSERT INTO drivers (telegram_id) SET status = AVAILABLE, last_status_update = now()
    BE->>PG: INSERT INTO audit_logs { action_type: DRIVER_STATUS_UPDATE, ... }
    BE->>Redis: PUBLISH driver_status_changed:{driver_id} { driver_id, status: AVAILABLE, driver_name }
    Redis-->>Admin: WebSocket message { event: DRIVER_STATUS_CHANGED }
    Admin->>Admin: Update driver row in DataTable
    Admin->>Admin: Show notification toast
```

## 4. Emergency Alert Flow

```mermaid
sequenceDiagram
    participant User as Traveler (PWA)
    participant MainBE as DerLg Main Backend
    participant PG as PostgreSQL
    participant Redis as Redis
    participant AdminBE as Admin Backend
    participant AdminUI as Admin UI

    User->>MainBE: POST /v1/emergency/sos { lat, lng, type }
    MainBE->>PG: INSERT INTO emergency_alerts
    MainBE->>Redis: PUBLISH emergency_alerts { alert_id, type, user_id, lat, lng }
    Redis-->>AdminBE: Subscribe to emergency_alerts
    AdminBE->>AdminUI: WebSocket message { event: EMERGENCY_ALERT }
    AdminUI->>AdminUI: Play sound alert (browser Notification API)
    AdminUI->>AdminUI: Show urgent banner notification

    Note over AdminUI: Admin clicks "Acknowledge"

    AdminUI->>AdminBE: PATCH /v1/admin/emergency/{id} { status: ACKNOWLEDGED }
    AdminBE->>PG: UPDATE emergency_alerts SET status, acknowledged_at, acknowledged_by
    Note over AdminUI: Admin clicks "Resolve"

    AdminUI->>AdminBE: PATCH /v1/admin/emergency/{id} { status: RESOLVED, resolution_notes }
    AdminBE->>PG: UPDATE emergency_alerts SET status, resolved_at, resolution_notes
```

## 5. Dashboard Composition Pattern

```mermaid
sequenceDiagram
    participant AdminUI as Admin Dashboard Page
    participant BE as NestJS Admin Backend
    participant PG as PostgreSQL

    Note over AdminUI: Page mounts — fire 8 parallel queries via React Query

    par Parallel Requests
        AdminUI->>BE: GET /v1/admin/bookings/today-count
        BE->>PG: SELECT COUNT(*) FROM bookings WHERE created_at::date = today
        PG-->>BE: 12
        BE-->>AdminUI: { count: 12 }
    and
        AdminUI->>BE: GET /v1/admin/bookings/today-revenue
        BE->>PG: SELECT SUM(total_usd) FROM bookings WHERE created_at::date = today AND status = CONFIRMED
        PG-->>BE: 2450.00
        BE-->>AdminUI: { total_usd: 2450.00 }
    and
        AdminUI->>BE: GET /v1/admin/drivers/count?status=AVAILABLE
        BE->>PG: SELECT COUNT(*) FROM drivers WHERE status = 'AVAILABLE'
        PG-->>BE: 5
        BE-->>AdminUI: { count: 5 }
    and
        AdminUI->>BE: GET /v1/admin/drivers/count?status=BUSY
        BE->>PG: SELECT COUNT(*) FROM drivers WHERE status = 'BUSY'
        PG-->>BE: 3
        BE-->>AdminUI: { count: 3 }
    and
        AdminUI->>BE: GET /v1/admin/bookings/trend?days=30
        BE->>PG: SELECT DATE(created_at), COUNT(*) FROM bookings GROUP BY DATE(created_at) ORDER BY 1
        PG-->>BE: [{date, count}, ...]
        BE-->>AdminUI: { data: [...] }
    and
        AdminUI->>BE: GET /v1/admin/bookings?unassigned=true&limit=5
        BE->>PG: SELECT * FROM bookings WHERE booking_type = TRANSPORT_ONLY AND id NOT IN (SELECT booking_id FROM driver_assignments WHERE completion_timestamp IS NULL)
        PG-->>BE: [...]
        BE-->>AdminUI: { data: [...] }
    and
        AdminUI->>BE: GET /v1/admin/maintenance/upcoming
        BE->>PG: SELECT * FROM vehicle_maintenance WHERE scheduled_date BETWEEN now() AND now() + INTERVAL '3 days'
        PG-->>BE: [...]
        BE-->>AdminUI: { data: [...] }
    and
        AdminUI->>BE: GET /v1/admin/emergency?status=SENT&limit=5
        BE->>PG: SELECT * FROM emergency_alerts WHERE status IN ('SENT','ACKNOWLEDGED') ORDER BY created_at DESC LIMIT 5
        PG-->>BE: [...]
        BE-->>AdminUI: { data: [...] }
    end

    Note over AdminUI: React Query aggregates all responses into dashboard UI
```

## 6. Admin Auth & Token Refresh

```mermaid
sequenceDiagram
    participant AdminUI as Admin UI
    participant BE as NestJS Admin Backend
    participant PG as PostgreSQL

    AdminUI->>BE: POST /v1/auth/login { email, password }
    BE->>PG: SELECT * FROM users WHERE email = ? AND role IN ('ADMIN', 'SUPPORT')
    BE->>PG: SELECT * FROM admin_users WHERE user_id = ?
    BE-->>AdminUI: 200 { accessToken, refreshToken (httpOnly cookie), user }

    Note over AdminUI: API client stores accessToken in memory<br/>Axios interceptor attaches Bearer token

    AdminUI->>BE: GET /v1/admin/drivers (Authorization: Bearer <token>)
    BE->>BE: AdminGuard checks user.role ∈ {ADMIN, SUPPORT}
    BE->>BE: AdminRoleGuard checks admin_users.admin_role for requested resource
    BE-->>AdminUI: 200 { success, data }

    Note over AdminUI: After 15 min, access token expires

    AdminUI->>BE: GET /v1/admin/drivers (Authorization: Bearer <expired>)
    BE-->>AdminUI: 401 Unauthorized
    AdminUI->>BE: POST /v1/auth/refresh (httpOnly cookie)
    BE->>PG: SELECT token_version FROM users WHERE id = ?
    BE-->>AdminUI: 200 { accessToken }
    AdminUI->>BE: GET /v1/admin/drivers (Authorization: Bearer <new>)
    BE-->>AdminUI: 200 { success, data }
```