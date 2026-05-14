# Frontend Agent Guide

> **You are working on the Next.js frontend.** Read this before writing any frontend code.

## Domain Identity

`frontend_admin/` — Next.js 16 App Router frontend for the DerLg System Admin Panel. All routes live under `/admin/*`. Provides role-based admin UI for managing drivers, vehicles, bookings, hotels, guides, emergency alerts, customers, discounts, analytics, admin users, and audit logs.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.4 (App Router) |
| Language | TypeScript 5 (strict) |
| React | 19.2.4 |
| Styling | Tailwind CSS v4 |
| UI components | shadcn/ui + custom |
| State (client) | Zustand v5 with persist middleware |
| State (server) | TanStack React Query v5 |
| Forms | React Hook Form v7 + Zod v4 |
| HTTP client | Axios with interceptor-based token refresh |
| Maps | Leaflet.js + react-leaflet |
| Charts | Recharts v3 |
| Icons | Lucide React |
| Real-time | Native WebSocket (NOT socket.io-client) |

> **Language**: The admin panel is **English only**. No i18n framework is used. All UI strings are hardcoded in English.

## Important: Next.js 16 Breaking Changes

This is NOT the Next.js from training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Project Structure

```
frontend_admin/
├── app/
│   ├── login/page.tsx            # Admin login
│   ├── page.tsx                  # Redirect to /login
│   └── admin/
│       ├── layout.tsx            # AdminLayout (sidebar + topbar + WS)
│       ├── dashboard/page.tsx
│       ├── drivers/              # page.tsx + [id]/page.tsx
│       ├── vehicles/
│       ├── bookings/
│       ├── hotels/
│       ├── guides/
│       ├── emergency/
│       ├── customers/
│       ├── discounts/            # + student-verifications/
│       ├── analytics/
│       ├── users/                # SUPER_ADMIN only
│       ├── audit-logs/
│       └── ai-monitoring/
├── components/
│   ├── layout/
│   │   ├── AdminLayout.tsx
│   │   ├── AdminSidebar.tsx      # Role-filtered navigation
│   │   └── TopBar.tsx            # ConnectionIndicator + NotificationBell
│   ├── admin/                    # Feature-specific components (40+)
│   └── shared/                   # DataTable, SearchInput, FilterDropdown, ConfirmDialog, ImageUpload
├── hooks/
│   └── useAdminWebSocket.ts      # WS hook: reconnect, status, event handlers
├── lib/
│   ├── api.ts                    # Axios instance + typed API wrappers (all 16 endpoint groups)
│   └── utils.ts                  # cn() helper
├── store/
│   └── adminStore.ts             # Zustand: auth, notifications, UI stores
└── public/
    └── assets/                   # Static assets (images, icons)
```

## Coding Conventions

### App Router Patterns
- All admin pages are **Server Components by default**.
- Use `'use client'` only for interactive parts: forms, tables with sorting/filtering, modals, charts, maps.
- Extract client components into `components/admin/` or `components/shared/`.
- Route params: use Next.js `params` prop, not `useRouter()` when possible.

### API Client (`lib/api.ts`)
- **Never call APIs directly.** Always use the typed wrappers in `lib/api.ts`.
- The Axios interceptor unwraps `{ success, data, message, error }` automatically.
- On 401: interceptor refreshes token via `/v1/auth/refresh`, retries queued requests, redirects to `/login` on failure.
- On 403: show permission denied toast, do not retry.

### React Query
- Every data fetch = one React Query hook.
- Invalidate queries after mutations: `queryClient.invalidateQueries({ queryKey: ['drivers'] })`.
- Use `staleTime: 30000` for lists, `staleTime: 60000` for detail views.

### Zustand Stores
- `authStore`: `user`, `accessToken`, `isAuthenticated`, `setAuth()`, `clearAuth()`, `updateUser()`
- `notificationStore`: `notifications[]`, `unreadCount`, `addNotification()`, `markRead()`, `markAllRead()`
- `uiStore`: `sidebarCollapsed`, `language` ('EN' | 'ZH' | 'KM')
- Never mutate store state directly. Always use actions.

### Forms
- Use React Hook Form + Zod for all forms.
- Shared `ConfirmDialog` (shadcn/ui AlertDialog) for destructive actions.
- `ImageUpload` component: calls backend presigned URL endpoint, uploads to MinIO, returns object key.

### WebSocket (`useAdminWebSocket`)
- Connects to `wss://api.derlg.com/v1/admin/ws` (or `ws://localhost:3001/v1/admin/ws` in dev)
- Exponential backoff reconnect: 10s → 20s → 40s → max 60s
- Handles events: `DRIVER_STATUS_UPDATE`, `BOOKING_CREATED`, `EMERGENCY_ALERT`, `DRIVER_ASSIGNMENT`
- `EMERGENCY_ALERT` triggers browser notification + sound
- Exposes `connectionStatus` for UI indicator

### shadcn/ui Components
- Install via `npx shadcn@latest add <component>`.
- Do NOT write custom components when a shadcn/ui equivalent exists.
- Style overrides: use Tailwind utility classes, never raw CSS.

### Tailwind v4
- Use `@apply` in component CSS when needed.
- Color tokens: use `slate`, `emerald`, `amber`, `rose` for semantic colors (not arbitrary hex).
- Dark mode: not required for admin panel (light theme only).

### Role-Based UI
- Check `user.adminRole` before rendering admin-only features.
- `SUPER_ADMIN`: full access (users, audit-logs, backups)
- `OPERATIONS_MANAGER`: fleet + inventory + bookings + emergency + customers + discounts + analytics
- `FLEET_MANAGER`: drivers + vehicles + maintenance (read-only or write per spec)
- `SUPPORT_AGENT`: bookings + customers only
- Hide navigation items the user cannot access. Do not show disabled buttons.

### Recharts
- Use responsive containers: `<ResponsiveContainer width="100%" height={300}>`.
- Format currency with `$` prefix, dates with `date-fns` format.

### Leaflet.js
- Use `react-leaflet` components.
- Emergency map: center on alert location, marker with popup showing user + booking info.
- Hotel location picker: draggable marker, reverse geocoding not required.

## Task File

**`docs/tasks/kimi_task_frontend.md`** — 22 tasks covering:
- F1: Install dependencies (leaflet, socket.io-client, shadcn/ui components)
- F2: Shared components (DataTable, SearchInput, FilterDropdown, ConfirmDialog, ImageUpload)
- F3–F4: AdminLayout, AdminSidebar, NotificationBell, route protection
- F5–F17: 13 admin pages (dashboard, drivers, vehicles, bookings, hotels, guides, emergency, customers, discounts, analytics, users, audit-logs, ai-monitoring)
- F18: WebSocket integration
- F20: Telegram admin pages (broadcast, analytics, support)
- F21: Component testing

**Read this file before starting any frontend task.** It defines scope, file paths, and acceptance criteria.

## Rules

1. **Always read the task file first.** Do not implement without checking `docs/tasks/kimi_task_frontend.md`.
2. **Follow existing patterns.** Check `components/admin/` and `app/admin/` for existing code style.
3. **Use shared components.** Do not rebuild DataTable, SearchInput, or ConfirmDialog.
4. **Never call APIs directly from components.** Use `lib/api.ts` wrappers.

6. **Mark tasks complete** (`[ ]` → `[x]`) in the task file when done.
