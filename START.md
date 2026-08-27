# 🚀 DerLg System Admin — Quick Start

> The admin panel is **frontend-only**. Its API lives inside the main backend at
> `/v1/admin/*`. The old standalone NestJS service on port 5001 no longer exists.

---

## What you need

| Tool | Purpose | Check |
|------|---------|-------|
| Node.js 20+ | Runs the apps | `node --version` |
| Docker | Postgres, Redis, MinIO | `docker --version` |

---

## Fastest path

From the **repository root**, not this folder:

```bash
cd /home/rayu/DerLg
./run-all.sh
```

That starts four processes and streams their logs:

| Service | URL | Notes |
|---------|-----|-------|
| Backend API | http://localhost:4007/v1 | serves `/v1/*` **and** `/v1/admin/*` |
| Public site | http://localhost:4008 | |
| AI agent | http://localhost:4009 | |
| **Admin panel** | **http://localhost:4010** | |

Only need the admin UI? `./run-all.sh admin` — the backend must already be up.

---

## First run: database and accounts

```bash
cd backend

# Apply migrations. Use deploy, never `migrate dev`.
npx prisma migrate deploy

# Seed reference data plus the admin accounts and fleet fixtures.
npm run prisma:seed
```

Then sign in at http://localhost:4010 with:

| Email | Role |
|-------|------|
| `admin@derlg.demo` | SUPER_ADMIN — sees everything |
| `ops@derlg.demo` | OPERATIONS_MANAGER |
| `fleet@derlg.demo` | FLEET_MANAGER — fleet screens only |
| `support@derlg.demo` | SUPPORT_AGENT — bookings and customers only |

The password is `SEED_ADMIN_PASSWORD` from `backend/.env`. Leave it blank in
development and the seed uses a documented dev fallback; set it for anything real.

Each role sees a different sidebar. That is deliberate — the navigation mirrors
the backend's guards, so nothing visible returns "forbidden".

---

## Manual start

**1. Infrastructure** (Postgres, Redis, MinIO)

```bash
cd backend
docker compose up -d
docker ps          # confirm the containers are healthy
```

**2. Backend** — serves the public API *and* the admin API

```bash
cd backend
npm install
npm run build
PORT=4007 node dist/src/main.js
```

> The entrypoint is `dist/src/main.js`, not `dist/main.js`. A stray
> `debug_e2e.ts` at the project root shifts TypeScript's rootDir.

Verify: `curl http://localhost:4007/v1/health`

**3. Admin panel**

```bash
cd derlg-system-admin/frontend_admin
cp .env.local.example .env.local
npm install
npm run dev -- -p 4010
```

---

## Is it working?

| Check | Command | Expect |
|-------|---------|--------|
| Database | `docker exec supabase_db_das-tern psql -U postgres -d postgres -c '\dt public.*'` | 45 tables including `drivers`, `admin_users` |
| Backend | `curl http://localhost:4007/v1/health` | JSON, `"success": true` |
| Admin API is guarded | `curl -i http://localhost:4007/v1/admin/dashboard` | **401** — no token |
| Admin API works | log in, then call with `Authorization: Bearer <token>` | **200** with live counts |
| Frontend | open http://localhost:4010 | login page |

---

## Common problems

**"Port already in use"**
```bash
lsof -i :4010     # then kill the PID
```

**Admin pages return 401 immediately**
The access token lives in memory and lasts 15 minutes. The client refreshes it
using the `derlg_refresh` cookie, which needs `withCredentials`. Check
`NEXT_PUBLIC_API_URL` has no `/v1` suffix — the client appends it, and a doubled
prefix produces `/v1/v1/...`.

**Admin pages return 403 but you are signed in**
Your account has no active row in `admin_users`. Re-run `npm run prisma:seed`, or
add a grant for your user.

**"Environment validation failed" on boot**
The backend validates every variable at startup with Zod and exits rather than
run half-configured. The message names the offending key; add it to
`backend/.env` using `.env.example` as the reference.

**Telegram endpoints report "disabled"**
Expected. `TELEGRAM_BOT_ENABLED=false` by default so a missing bot token cannot
stop the public API from booting. Set a real token and flip the flag.

---

## Stopping

`Ctrl+C` in the `run-all.sh` terminal stops all four processes. Infrastructure
keeps running; stop it with `cd backend && docker compose down`.
