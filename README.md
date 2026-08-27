# DerLg System Admin Panel

Web administration interface for the **DerLg Cambodia** travel booking platform.
Fleet managers, operations managers, support agents and super admins use it to
manage transportation, hotels, tour guides, bookings, emergency alerts, customers
and the Telegram driver bot.

---

## Current state

This directory contains **only the frontend**.

The admin API previously lived here as a second NestJS service (`backend_admin/`,
port 5001) wired to its own remote Supabase project, with a Prisma schema that was
a stale snapshot of an older DerLg database. It could not read the live platform
data. That service has been merged into the main backend and removed.

| Component | Status | Location |
|-----------|--------|----------|
| Admin UI | Implemented | `frontend_admin/` |
| Admin API (`/v1/admin/*`) | Implemented | `backend/src/modules/admin/` |
| Telegram driver bot (`/v1/telegram/*`) | Implemented | `backend/src/modules/telegram/` |
| Object storage (`/v1/admin/storage/*`) | Implemented | `backend/src/modules/storage/` |
| Database | Shared with the public site | `backend/prisma/schema.prisma` |

An earlier version of this file described the backend as an "empty scaffold with
no modules and no API". That was already wrong — 18 controllers and 16 services
existed — and it is now moot, since that code lives in `backend/`.

---

## Architecture

```
┌───────────────────────────┐     ┌───────────────────────────┐
│  Admin panel (Next.js)    │     │  Public site (Next.js)    │
│  localhost:4010           │     │  localhost:4008           │
└────────────┬──────────────┘     └────────────┬──────────────┘
             │  /v1/admin/*                    │  /v1/*
             │  socket.io /v1/admin/ws         │
             └───────────────┬─────────────────┘
                             ▼
              ┌──────────────────────────────┐
              │   backend/ (NestJS)          │
              │   localhost:4007             │
              │   one Prisma client          │
              └──────┬───────────────┬───────┘
                     ▼               ▼
          ┌────────────────┐  ┌──────────────┐
          │  PostgreSQL    │  │  Redis       │
          │  :54322        │  │  :6379       │
          └────────────────┘  └──────────────┘
                     ▼               ▼
          ┌────────────────┐  ┌──────────────┐
          │  MinIO :9000   │  │ Telegram API │
          └────────────────┘  └──────────────┘
```

One database. One Prisma schema. One auth model. A booking created through the
public site appears in the admin panel immediately, because they are the same
rows read by the same client.

---

## Features

| Feature | Roles |
|---------|-------|
| **Dashboard** — bookings today, revenue, active drivers, 30-day trends, pending actions, emergency alerts | All |
| **Drivers** — profiles, live status (AVAILABLE/BUSY/OFFLINE), Telegram registration state | Fleet, Ops, Super |
| **Vehicle fleet** — vehicles (tuk-tuk/van/bus, tier, subtype), maintenance scheduling | Fleet, Ops, Super |
| **Assignments** — assign drivers to bookings with capacity validation, in one transaction | Fleet, Ops, Super |
| **Bookings** — list, detail, modify, cancel; booking method and per-item date ranges | Support, Ops, Super |
| **Hotels** — inventory, rooms, interval-overlap availability | Ops, Super |
| **Tour guides** — profiles, enum-backed languages and specialties, availability | Ops, Super |
| **Emergency alerts** — SOS/medical/theft/lost, Leaflet map, acknowledge/resolve | Ops, Super |
| **Customers** — profiles, booking history, loyalty adjustments, reviews | Support, Ops, Super |
| **Discounts** — promo codes, student verification queue | Ops, Super |
| **Analytics** — revenue by type, booking stats, driver performance, occupancy, CSV export | Ops, Super |
| **Admin users** — role management | Super only |
| **Audit logs** — full action history with CSV export | Super only |
| **AI monitoring** — AI-assisted bookings, session history, success rates | Ops, Super |
| **Telegram** — broadcasts, delivery analytics, driver support tickets | Ops, Super |
| **Real-time** — live driver status, new bookings, emergency alerts | All (filtered by role) |

### Telegram driver bot

PIN registration (bcrypt), `/online` `/offline` `/status`, trip assignment
notifications with accept/reject, `/mytrip` start and complete, `/history` and
earnings, live location sharing during trips, `/emergency`, `/support`, and
admin broadcasts via a BullMQ queue.

---

## Getting started

### Prerequisites
Node.js 20+, Docker (Postgres, Redis, MinIO).

### Run everything from the repo root
```bash
./run-all.sh              # backend + public site + AI agent + admin panel
./run-all.sh admin        # admin panel only (backend must be running)
```

| Service | URL |
|---------|-----|
| Admin panel | http://localhost:4010 |
| Backend API | http://localhost:4007/v1 |
| Public site | http://localhost:4008 |
| MinIO console | http://localhost:9001 |

### First-time database setup
```bash
cd backend
npx prisma migrate deploy     # never `migrate dev`
npm run prisma:seed           # creates the admin accounts below
```

### Seeded logins

From `backend/prisma/seeds/12-admin-users.ts`. Password comes from
`SEED_ADMIN_PASSWORD`; in development it falls back to a known dev value, and the
seed refuses to run without the variable when `NODE_ENV=production`.

| Email | Role |
|-------|------|
| `admin@derlg.demo` | SUPER_ADMIN |
| `ops@derlg.demo` | OPERATIONS_MANAGER |
| `fleet@derlg.demo` | FLEET_MANAGER |
| `support@derlg.demo` | SUPPORT_AGENT |
| `inactive.admin@derlg.demo` | deactivated — exercises the rejection path |

### Frontend environment
```bash
cd frontend_admin
cp .env.local.example .env.local
npm install
npm run dev
```

`NEXT_PUBLIC_API_URL` is the backend origin **without** `/v1` — the client
appends it.

---

## Security model

- **One credential store.** Admins sign in through `/v1/auth/login` against
  `users.password_hash`. Nothing reads Supabase's internal `auth.users` table.
- **Two authorisation layers.** `RolesGuard` checks the coarse `users.role` claim
  in the JWT; `AdminRoleGuard` checks the `admin_users` grant in the database, so
  revoking admin rights takes effect without waiting for a token to expire.
- **Deactivation blocks sign-in**, not just individual routes.
- **WebSocket is authenticated.** The gateway verifies the JWT during the
  handshake and requires an active grant. Emergency alerts carry live GPS and are
  delivered only to OPERATIONS_MANAGER and SUPER_ADMIN.
- **Audit trail.** Every admin mutation writes an `audit_logs` row with redacted
  changed fields.
- **Storage.** Presigned URLs only, with an allowlisted bucket set and object keys
  validated against path traversal.
- **Rate limits** on every admin controller; broadcasts are limited harder because
  each call fans out one Telegram message per driver.

---

## Documentation

| Document | Purpose |
|----------|---------|
| `AGENTS.md` | Conventions and routing for this directory |
| `frontend_admin/AGENTS.md` | Frontend patterns |
| `backend/AGENTS.md` | Backend conventions |
| `backend/docs/admin-merge/` | How the merge was carried out, and every behaviour deliberately changed |
| `docs/specs/system-admin/` | Original requirements and design |
| `docs/specs/telegram/` | Telegram bot requirements and design |

---

*Built for DerLg Cambodia — travel booking platform*
