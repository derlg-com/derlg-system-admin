# DerLg System Admin — Project Documentation

> **Last updated:** 2026-05-10

## Purpose

The DerLg System Admin Panel is a standalone administrative web application for managing the DerLg Cambodia travel booking platform. It provides role-based access for four admin roles to manage transportation fleet, hotel inventory, tour guides, bookings, emergency alerts, discount codes, student verifications, and business analytics.

It also includes a **Telegram Transportation Management System** — a Telegram Bot that lets drivers update availability and accept/reject trips from their phones without installing an app, with real-time sync back to the admin panel via Redis pub/sub and WebSocket.

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
| Language | English only (no i18n) |

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
│   ├── telegram/             # NEW: Telegram integration routes
│   │   ├── broadcast/page.tsx    # Broadcast composer + history
│   │   ├── analytics/page.tsx    # Bot usage analytics
│   │   └── support/page.tsx     # Driver support tickets
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
│   ├── api.yaml                     # OpenAPI 3.1 spec (60+ admin + telegram endpoints)
│   ├── prisma-schema.prisma         # Database schema (7 admin tables + enums)
│   ├── architecture/
│   │   └── admin-architecture.md    # 11 Mermaid diagrams (admin + telegram flows)
│   ├── reference/                   # DerLg main app reference docs
│   │   ├── prd.md                   #   Product requirements
│   │   ├── feature-decisions.md     #   Feature registry
│   │   ├── architecture-overview.md #   System architecture
│   │   ├── architecture-data.md     #   Data architecture
│   │   └── architecture-services.md #   Service boundaries
│   └── specs/
│       ├── system-admin/            # Admin panel specs
│       │   ├── requirements.md      #   20 requirements
│       │   ├── design.md            #   Component design spec
│       │   ├── tasks.md             #   39 implementation tasks
│       │   └── combined.md          #   All specs merged inline
│       └── telegram/                # Telegram transport management specs
│           ├── requirements.md      #   18 requirements
│           ├── design.md            #   Bot interface + module design
│           └── integration.md       #   Admin-telegram integration summary
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
- **Database**: Schema designed (7 admin tables: drivers, driver_assignments, vehicle_maintenance, admin_users, support_tickets, broadcast_messages, backups). Not yet migrated.
- **Docs**: Full spec suite — 20 admin requirements, 18 Telegram requirements, 11 architecture diagrams, 60+ endpoint OpenAPI spec. Telegram integration specs copied.

## Implementation Roadmap

See `docs/specs/system-admin/tasks.md` for 39 tasks and `docs/specs/telegram/requirements.md` for Telegram phases. High-level phases:

1. **Foundation:** Database migration (7 admin tables) + admin module scaffold + auth guards
2. **Transportation core:** Driver CRUD + Vehicle CRUD + Maintenance CRUD
3. **Telegram integration:** Webhook handler, driver registration (PIN auth), bot commands (/online, /offline, /status)
4. **Trip lifecycle:** Driver assignments with Telegram notification, accept/reject flow, start/complete tracking
5. **Fleet visibility:** Real-time dashboard via Redis pub/sub, WebSocket driver status sync, live location tracking
6. **Inventory:** Hotel + Guide + Booking admin CRUD endpoints
7. **Operations:** Emergency alerts + Customer profiles + Discount codes + Student verifications
8. **Communication:** Broadcast messaging (Bull queue), support ticket management
9. **Intelligence:** Analytics + Admin user management + Audit logs + Data export
10. **Frontend:** Replace placeholder pages with API-connected components, Telegram broadcast/support/analytics pages
11. **Quality:** Tests (unit + integration + E2E), Sentry monitoring

## Key Design Decisions

1. **Standalone repo, shared database** — admin is deployed independently but reads/writes same PG
2. **Small composable endpoints** — dashboard fires 8 parallel GETs instead of one mega-endpoint
3. **Role-based guards** — Two-layer: AdminGuard (JWT role check) + AdminRoleGuard (admin_users.admin_role)
4. **Redis for real-time** — Telegram webhook → Redis pub/sub → WebSocket broadcast to admin UI
5. **No direct DB from frontend** — all data access through NestJS backend
6. **Telegram bot for driver workflow** — No native app needed; drivers use familiar Telegram via PIN auth, inline keyboards, and real-time WebSocket sync
7. **Async processing via Bull** — Broadcast messages and assignment timeouts use Redis-backed job queues
8. **English only** — All bot responses and admin UI strings are in English