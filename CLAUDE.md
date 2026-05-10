# DerLg System Admin — Project Documentation

> **Last updated:** 2026-05-10

## Purpose

The DerLg System Admin Panel is a standalone administrative web application for managing the DerLg Cambodia travel booking platform. It provides role-based access for four admin roles to manage transportation fleet, hotel inventory, tour guides, bookings, emergency alerts, discount codes, student verifications, and business analytics.

## Relationship to DerLg Main App

- **DerLg main app** (`/home/rayu/DerLg`) — customer-facing Next.js + NestJS application
- **DerLg system admin** (`/home/rayu/derlg-system-admin`) — this repo, admin-facing standalone app

Both share the same **Supabase PostgreSQL database**. The admin app reads from and writes to the same tables, plus maintains its own admin-specific tables (`drivers`, `driver_assignments`, `vehicle_maintenance`, `admin_users`, `backups`).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS v4 |
| UI components | Custom (no shadcn/ui dependency yet) |
| State (client) | Zustand v5 with persist middleware |
| State (server) | TanStack React Query v5 |
| Forms | React Hook Form v7 + Zod v4 |
| HTTP client | Axios with interceptor-based token refresh |
| Charts | Recharts v3 |
| Icons | Lucide React |
| Backend framework | NestJS 11 |
| ORM | Prisma |
| Database | PostgreSQL (Supabase) |
| Realtime | WebSocket + Redis pub/sub |
| Date handling | date-fns v4 |

## Project Structure

```
derlg-system-admin/
├── app/                        # Next.js App Router pages
│   ├── login/page.tsx          # Admin login (email + password)
│   ├── page.tsx                # Redirect to /login
│   └── admin/
│       ├── layout.tsx          # Admin shell (sidebar + topbar + WS provider)
│       ├── dashboard/page.tsx  # Overview KPI page
│       ├── drivers/page.tsx    # Driver list + CRUD
│       ├── vehicles/page.tsx   # Fleet management
│       ├── bookings/page.tsx   # Booking operations
│       ├── hotels/page.tsx     # Hotel inventory
│       ├── guides/page.tsx     # Tour guide profiles
│       ├── emergency/page.tsx  # Emergency alerts + map
│       ├── customers/page.tsx  # Customer profiles
│       ├── discounts/page.tsx  # Discount codes + student verifications
│       ├── analytics/page.tsx  # Business intelligence
│       ├── users/page.tsx      # Admin user management (SUPER_ADMIN only)
│       ├── audit-logs/page.tsx # Audit trail viewer (SUPER_ADMIN only)
│       └── ai-monitoring/page.tsx # AI session viewer
├── components/
│   ├── layout/AdminLayout.tsx  # Main admin shell component
│   ├── admin/                  # Feature-specific components (20+ files)
│   ├── shared/                 # Reusable DataTable, StatusBadge, etc.
│   └── QueryProvider.tsx       # React Query client provider
├── hooks/
│   └── useAdminWebSocket.ts    # WebSocket hook with reconnect
├── lib/
│   └── api.ts                  # Axios instance + typed API client functions
├── store/
│   └── adminStore.ts           # Zustand: auth, notification, UI stores
├── backend_admin/              # NestJS admin API
│   └── src/                    # Currently scaffold only (default boilerplate)
├── docs/
│   ├── architecture/           # Architecture diagrams
│   ├── reference/              # DerLg main app reference docs
│   └── prisma-schema.prisma    # Database schema (admin models)
├── requirements.md             # 20 requirements with acceptance criteria
├── design.md                   # Visual/interaction design spec
├── tasks.md                    # 39 implementation tasks
└── admin.all.combination.task.md # All specs merged inline
```

## API Envelope Convention

All API responses use the DerLg standard envelope:
```json
{ "success": true, "data": {}, "message": "ok", "error": null }
```

The Axios interceptor in `lib/api.ts` unwraps this automatically — frontend code receives `data` directly.

## Auth Flow

1. Admin logs in at `/login` → `POST /v1/auth/login`
2. Backend returns `{ accessToken, user }` + `httpOnly` refresh cookie
3. `useAuthStore` persists user + token to localStorage via Zustand persist
4. Axios interceptor attaches `Authorization: Bearer <token>` to all requests
5. On 401 → interceptor calls `POST /v1/auth/refresh`, retries original request
6. On refresh failure → clears auth, redirects to `/login`

## Admin Roles

| Role | Scope |
|------|-------|
| SUPER_ADMIN | Full access: all features + user management + audit logs + backups |
| OPERATIONS_MANAGER | Fleet, inventory, bookings, emergency, customers, analytics |
| FLEET_MANAGER | Drivers CRUD, vehicles CRUD, maintenance, driver assignments |
| SUPPORT_AGENT | Bookings (view/modify/cancel), customer profiles only |

## Current State (2026-05-10)

- **Frontend**: All 13 admin routes scaffolded with placeholder pages. Dashboard has full implementation with mock data fallback. Login page complete with auth flow. WebSocket hook functional. API client complete with all 16 typed endpoint groups.
- **Backend**: Scaffold only — default NestJS boilerplate. No admin-specific controllers or services yet.
- **Database**: Schema designed (4 admin tables defined in `docs/prisma-schema.prisma`), not yet migrated.
- **Docs**: Requirements (20 items), design, 39 tasks, and architecture diagrams complete.

## Implementation Roadmap

See `tasks.md` for the full 39-task breakdown. High-level phases:

1. Backend: Database migration + admin module scaffold + auth guards
2. Backend: Driver + Vehicle + Maintenance CRUD + Telegram webhook
3. Backend: Hotel + Guide + Booking admin endpoints
4. Backend: Emergency + Customer + Discount + Analytics endpoints
5. Frontend: Replace placeholders with real API-connected pages
6. Integration: WebSocket pub/sub, real-time dashboard
7. Quality: Tests, i18n, polish

## Key Design Decisions

1. **Standalone repo, shared database** — admin is deployed independently but reads/writes same PG
2. **Small composable endpoints** — dashboard fires 8 parallel GETs instead of one mega-endpoint
3. **Role-based guards** — Two-layer: AdminGuard (JWT role check) + AdminRoleGuard (admin_users.admin_role)
4. **Redis for real-time** — Telegram webhook → Redis pub/sub → WebSocket broadcast to admin UI
5. **No direct DB from frontend** — all data access through NestJS backend