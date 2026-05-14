# DerLg System Admin Panel

A comprehensive web-based administrative interface and Telegram Bot system for managing all operational aspects of the **DerLg Cambodia** travel booking platform. This system enables fleet managers, operations managers, support agents, and super admins to manage transportation, hotels, tour guides, bookings, emergency alerts, and real-time driver operations.

---

## 📋 Project Overview

The System Admin Panel is built as a full-stack application consisting of:

| Component | Technology | Status |
|-----------|-----------|--------|
| **Frontend** | Next.js 16 + React 19 + Tailwind CSS | 🔴 Stubbed (pages & components are placeholders) |
| **Backend** | NestJS + Prisma + Supabase PostgreSQL | 🔴 Empty scaffold (no modules, no API) |
| **Telegram Bot** | node-telegram-bot-api + NestJS module | 🔴 Not started |
| **Database** | Supabase PostgreSQL | 🔴 No schema (prisma/schema.prisma is empty) |

> **Current State:** The project has page shells, API client stubs, Zustand stores, and component placeholders. All backend APIs, database schema, and Telegram bot logic remain unimplemented.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                          │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  (app) Routes    │         │  (admin) Routes  │         │
│  │  /home, /chat    │         │  /admin/*        │         │
│  └──────────────────┘         └──────────────────┘         │
│           │                            │                     │
│           └────────────┬───────────────┘                     │
│                        │                                     │
└────────────────────────┼─────────────────────────────────────┘
                         │
                         │ HTTP / WebSocket
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                   NestJS Backend API                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ /v1/bookings │  │ /v1/admin/*  │  │ /v1/telegram │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                            │                  ▲               │
└────────────────────────────┼──────────────────┼───────────────┘
                             │                  │
                    ┌────────▼────────┐  ┌──────┴──────┐
                    │   Supabase      │  │  Telegram   │
                    │   PostgreSQL    │  │    Bot      │
                    └─────────────────┘  └─────────────┘
                             │
                    ┌────────▼────────┐
                    │  Redis (Upstash)│
                    │  Pub/Sub + Cache│
                    └─────────────────┘
```

---

## 🎯 Key Features

### Admin Panel (Web Interface)

| Feature | Description | Role Access |
|---------|-------------|-------------|
| **Dashboard** | Real-time metrics: bookings today, revenue, active drivers, 30-day trends, pending actions, emergency alerts | All roles |
| **Driver Management** | Create/edit driver profiles, real-time status tracking (AVAILABLE/BUSY/OFFLINE), Telegram registration status | Fleet Manager, Operations Manager, Super Admin |
| **Vehicle Fleet** | Manage vehicles (VAN/BUS/TUK_TUK), maintenance scheduling, availability tracking | Fleet Manager, Operations Manager, Super Admin |
| **Bookings** | Unified booking list, detail view, driver assignment with capacity validation, modifications, cancellations | Support Agent, Operations Manager, Super Admin |
| **Hotels** | Hotel inventory, room management, availability calendar, double-booking prevention | Operations Manager, Super Admin |
| **Tour Guides** | Guide profiles, language/specialty filters, assignment tracking, availability calendar | Operations Manager, Super Admin |
| **Emergency Alerts** | Real-time SOS/MEDICAL/THEFT/LOST alerts, Leaflet.js map tracking, acknowledge/resolve workflow | Operations Manager, Super Admin |
| **Customers** | Customer profiles, booking history, loyalty points management, reviews | Support Agent, Operations Manager, Super Admin |
| **Discount Codes** | Promo code management, student verification queue with image review | Operations Manager, Super Admin |
| **Analytics** | Revenue by booking type, booking statistics, driver performance, hotel occupancy, export CSV/PDF | Super Admin, Operations Manager |
| **Admin Users** | Role management (SUPER_ADMIN/OPERATIONS_MANAGER/SUPPORT_AGENT/FLEET_MANAGER), permissions | Super Admin only |
| **Audit Logs** | Complete action history with filters, JSON change tracking, CSV export | Super Admin only |
| **AI Monitoring** | Track AI-assisted bookings, session history, success rates, error corrections | Operations Manager, Super Admin |
| **Real-Time Updates** | WebSocket connection for live driver status, new bookings, emergency alerts | All roles |

### Telegram Bot (Driver Mobile Interface)

| Feature | Description |
|---------|-------------|
| **PIN Registration** | Drivers register with driver_id + 4-digit PIN (bcrypt) |
| **Status Commands** | `/online`, `/offline`, `/status` with inline keyboard |
| **Trip Notifications** | Instant assignment alerts with [Accept] [Reject] buttons |
| **Active Trip** | `/mytrip`, [Start Trip], [Complete Trip] with location sharing prompt |
| **History & Earnings** | `/history` with daily/weekly/monthly earnings summary |
| **Live Location** | Real-time location sharing during trips (60s updates, 5-min Redis TTL) |
| **Emergency** | `/emergency` sends alert to admin panel with emergency contacts |
| **Support** | `/support` creates tickets with priority detection |
| **Broadcast** | Admin sends targeted messages to driver groups |

---

## 🔐 Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **SUPER_ADMIN** | Full access to all features including user management and audit logs |
| **OPERATIONS_MANAGER** | Drivers, vehicles, bookings, hotels, guides, emergency, discounts, analytics, broadcasts |
| **FLEET_MANAGER** | Drivers, vehicles, maintenance, analytics (view-only) |
| **SUPPORT_AGENT** | Bookings (view/modify), customers (view/support), analytics (none) |

---

## 🛠️ Technology Stack

### Frontend
- **Framework:** Next.js 16.2.4 (App Router)
- **UI:** React 19.2.4, Tailwind CSS 4, shadcn/ui
- **State:** Zustand (auth, notifications, UI)
- **Server State:** React Query (TanStack)
- **Charts:** recharts
- **Maps:** Leaflet.js + react-leaflet
- **Forms:** React Hook Form + Zod

- **Real-Time:** Native WebSocket (ws:// or wss://)

### Backend
- **Framework:** NestJS 11
- **Database:** Supabase PostgreSQL
- **ORM:** Prisma 5
- **Auth:** JWT (access token 15min, refresh token in httpOnly cookie)
- **Cache/Messaging:** Redis (Upstash) — pub/sub, session storage, rate limiting
- **Queue:** Bull (Redis-based) — async broadcast, assignment timeouts
- **Storage:** Supabase Storage — images, backups
- **Encryption:** AES-256 for sensitive exports

### Telegram Bot
- **Library:** node-telegram-bot-api

- **Security:** Webhook secret token, bcrypt PIN hashing, rate limiting (30 req/min)

---

## 📁 Project Structure

```
derlg-system-admin/
├── backend_admin/              # NestJS backend (empty scaffold)
│   ├── prisma/
│   │   └── schema.prisma       # Empty — needs models
│   └── src/
│       ├── admin/              # Not created yet
│       ├── telegram/           # Not created yet
│       └── app.module.ts       # Default scaffold only
│
├── frontend_admin/             # Next.js frontend (stubbed)
│   ├── app/admin/              # Page shells exist
│   ├── components/admin/       # Component stubs exist
│   ├── lib/api.ts              # API client stubs
│   ├── store/adminStore.ts     # Zustand stores
│   └── hooks/useAdminWebSocket.ts  # WS hook stub
│
├── docs/
│   ├── specs/
│   │   ├── system-admin/       # 39 tasks, 20 requirements
│   │   │   ├── combined.md
│   │   │   ├── requirements.md
│   │   │   ├── design.md
│   │   │   └── tasks.md
│   │   └── telegram/           # 10 requirements, 7 phases
│   │       ├── requirements.md
│   │       ├── design.md
│   │       ├── INTEGRATION.md
│   │       └── README.md
│   └── tasks/                  # ⭐ Task files (created)
│       ├── kimi_task_backend.md
│       ├── kimi_task_frontend.md
│       └── kimi_task_telegram.md
│
└── README.md                   # This file
```

---

## 📋 Task Files

All pending work is documented in the task files under `docs/tasks/`:

| File | Domain | Task Count |
|------|--------|-----------|
| [`docs/tasks/kimi_task_backend.md`](docs/tasks/kimi_task_backend.md) | Backend APIs, Database, WebSocket, Redis, Telegram module | 23 tasks |
| [`docs/tasks/kimi_task_frontend.md`](docs/tasks/kimi_task_frontend.md) | Frontend pages, components, auth, WebSocket | 22 tasks |
| [`docs/tasks/kimi_task_telegram.md`](docs/tasks/kimi_task_telegram.md) | Telegram bot commands, handlers, security, monitoring | 16 tasks |

**Total: 61 distinct tasks** covering database schema, 23+ API endpoints, 40+ frontend components, 15 admin pages, a complete Telegram bot, WebSocket real-time system, Redis pub/sub, and testing.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (Supabase)
- Redis instance (Upstash)
- Telegram Bot token (from BotFather)

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Redis
REDIS_URL=redis://...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# JWT
JWT_SECRET=your_jwt_secret
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Supabase
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_WEBHOOK_URL=https://your-domain.com/v1/telegram/webhook
TELEGRAM_SECRET_TOKEN=random_32_char_secret

# Feature Flags
TELEGRAM_BOT_ENABLED=true
TELEGRAM_LOCATION_TRACKING_ENABLED=true
TELEGRAM_BROADCAST_ENABLED=true
```

### Development Commands

```bash
# Backend
cd backend_admin
npm install
npx prisma migrate dev
npm run start:dev

# Frontend
cd frontend_admin
npm install
npm run dev
```

---

## 📚 Documentation

- **[System Admin Panel Specs](docs/specs/system-admin/)** — 20 requirements, 39 tasks, design patterns
- **[Telegram Bot Specs](docs/specs/telegram/)** — 10 requirements, technical design, integration guide
- **[Backend Tasks](docs/tasks/kimi_task_backend.md)** — All backend implementation tasks
- **[Frontend Tasks](docs/tasks/kimi_task_frontend.md)** — All frontend implementation tasks
- **[Telegram Tasks](docs/tasks/kimi_task_telegram.md)** — All Telegram bot implementation tasks

---

## 📊 Success Metrics

### Technical
- WebSocket uptime: > 99%
- Status update latency: < 5 seconds
- Assignment notification delivery: > 99%
- Broadcast delivery rate: > 95%

### Business
- Driver registration rate: > 80% within 2 weeks
- Daily active drivers: > 60% of registered
- Assignment acceptance rate: > 85%
- Average response time: < 2 minutes

---

*Built for DerLg Cambodia — Travel Booking Platform*
