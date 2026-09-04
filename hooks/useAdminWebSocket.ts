'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { io, type Socket } from 'socket.io-client'
import { useNotificationStore } from '@/store/adminStore'
import { toast } from 'sonner'
import { ACCESS_TOKEN_STORAGE_KEY } from '@/lib/api'

/**
 * Namespace the backend gateway is mounted on
 * (`@WebSocketGateway({ namespace: 'v1/admin/ws' })`).
 */
const WS_NAMESPACE = '/v1/admin/ws'
const BASE_RECONNECT_MS = 10_000
const MAX_RECONNECT_MS = 60_000
/** Guards against a malformed ADMIN_EVENT nesting itself indefinitely. */
const MAX_UNWRAP_DEPTH = 3

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'

/**
 * Resolves the socket.io endpoint.
 *
 * Three things were wrong with the old derivation:
 *
 *  1. It connected with the browser's raw `WebSocket`. The backend is a
 *     socket.io gateway, and socket.io needs its own Engine.IO handshake over
 *     `/socket.io/` before a namespace exists — a raw socket can never complete
 *     it, so the channel never connected at all.
 *  2. `NEXT_PUBLIC_WS_URL` is set to an origin with no path, so the namespace was
 *     never appended; the only place `/v1/admin/ws` appeared was a hardcoded
 *     fallback that also pointed at the wrong port.
 *  3. socket.io-client wants an http(s) origin. `ws://`/`wss://` are normalised
 *     here so either spelling in the env works.
 *
 * Falls back to `NEXT_PUBLIC_API_URL` so there is one less variable to keep in
 * sync — the gateway is served by the same process as the REST API.
 */
export function resolveEndpoint(): string {
  const raw =
    process.env.NEXT_PUBLIC_WS_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4007'

  const origin = raw
    .replace(/^ws:\/\//, 'http://')
    .replace(/^wss:\/\//, 'https://')
    .replace(/\/+$/, '')
    // Tolerate an env value that already includes the namespace or a /v1 suffix.
    .replace(/\/v1\/admin\/ws$/, '')
    .replace(/\/v1$/, '')

  return `${origin}${WS_NAMESPACE}`
}

/**
 * Domain payload carried inside an admin event.
 *
 * The gateway relays Redis messages verbatim, and the publishers are a mix of
 * admin services (camelCase) and Telegram handlers (snake_case), so both
 * spellings are declared and read defensively.
 */
export interface AdminEventPayload {
  driverName?: string
  driver_name?: string
  status?: string
  newStatus?: string
  bookingRef?: string
  booking_ref?: string
  alertType?: string
  alert_type?: string
  userName?: string
  user_name?: string
  message?: string
  sent_count?: number
  failed_count?: number
  [key: string]: unknown
}

/** Wire envelope emitted by `AdminGateway.broadcastEvent`. */
export interface AdminSocketEnvelope {
  event: string
  data: AdminEventPayload
  timestamp: string
}

interface DispatchDeps {
  queryClient: QueryClient
  addNotification: (n: Record<string, unknown>) => void
}

/** Short attention-getting chirp for emergencies. Best-effort. */
function playAlertTone() {
  try {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    oscillator.frequency.setValueAtTime(880, ctx.currentTime)
    oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.1)
    oscillator.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.3)
  } catch {
    // Autoplay policy blocks audio before a user gesture; the visual
    // notification is the primary channel, so this is not worth surfacing.
  }
}

/**
 * Routes one admin event to cache invalidation, a toast and a notification.
 *
 * Deliberately a module-level function rather than a `useCallback`: the
 * `ADMIN_EVENT` branch needs to call this recursively to unwrap its inner event,
 * and a callback cannot reference itself before its own initialiser has run. It
 * is also pure dispatch logic with no hook state, so keeping it outside the
 * component makes it directly unit-testable.
 */
export function dispatchAdminEvent(
  event: string,
  data: AdminEventPayload,
  deps: DispatchDeps,
  depth = 0,
): void {
  const { queryClient, addNotification } = deps

  switch (event) {
    case 'DRIVER_STATUS_UPDATE':
    case 'DRIVER_STATUS_CHANGED': {
      queryClient.invalidateQueries({ queryKey: ['admin-drivers'] })
      const name = data.driverName || data.driver_name || 'Driver'
      const status = data.status || data.newStatus || 'updated'
      toast.info(`${name} is now ${status}`, { duration: 3000 })
      addNotification({
        type: 'DRIVER_STATUS',
        title: 'Driver Status Update',
        message: `${name} is now ${status}`,
        data,
      })
      break
    }

    case 'BOOKING_CREATED':
    case 'NEW_BOOKING': {
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      const ref = data.bookingRef || data.booking_ref || 'received'
      toast.info(`New booking: ${ref}`, { duration: 5000 })
      addNotification({
        type: 'BOOKING',
        title: 'New Booking',
        message: `Booking ${ref} created`,
        data,
      })
      break
    }

    case 'EMERGENCY_ALERT': {
      queryClient.invalidateQueries({ queryKey: ['admin-emergency'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      const alertType = data.alertType || data.alert_type || 'Emergency'
      const userName = data.userName || data.user_name || 'Unknown'
      addNotification({
        type: 'EMERGENCY',
        title: '🚨 Emergency Alert',
        message: `${alertType} alert from ${userName}`,
        priority: 'urgent',
        data,
      })
      playAlertTone()
      break
    }

    case 'DRIVER_ASSIGNMENT': {
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['admin-drivers'] })
      addNotification({
        type: 'BOOKING',
        title: 'Driver Assignment',
        message: data.message || 'Driver assignment updated',
        data,
      })
      break
    }

    case 'SUPPORT_TICKET_CREATED':
    case 'driver:support:ticket': {
      queryClient.invalidateQueries({ queryKey: ['telegram-support-tickets'] })
      const driverName = data.driverName || data.driver_name || 'Driver'
      toast.info(`New support ticket from ${driverName}`, { duration: 5000 })
      addNotification({
        type: 'SYSTEM',
        title: 'New Support Ticket',
        message: data.message || `${driverName} created a support ticket`,
        data,
      })
      window.dispatchEvent(new CustomEvent('websocket-message', { detail: data }))
      break
    }

    case 'BROADCAST_STATUS':
    case 'broadcast:status': {
      queryClient.invalidateQueries({ queryKey: ['telegram-broadcast-history'] })
      const sent = data.sent_count || 0
      const failed = data.failed_count || 0
      toast.info(`Broadcast delivered: ${sent} sent, ${failed} failed`, {
        duration: 4000,
      })
      break
    }

    /*
     * ADMIN_EVENT is a catch-all channel whose payload carries its own
     * discriminator. Unwrap one level and re-dispatch so a new backend event does
     * not require a matching case here.
     */
    case 'ADMIN_EVENT': {
      const inner =
        (data.event as string | undefined) ?? (data.type as string | undefined)
      if (inner && inner !== 'ADMIN_EVENT' && depth < MAX_UNWRAP_DEPTH) {
        dispatchAdminEvent(
          inner,
          (data.data as AdminEventPayload) ?? data,
          deps,
          depth + 1,
        )
        return
      }
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      break
    }

    default:
      break
  }
}

export function useAdminWebSocket(enabled = true) {
  const queryClient = useQueryClient()
  const addNotification = useNotificationStore((s) => s.addNotification)
  const socketRef = useRef<Socket | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() =>
    enabled ? 'connecting' : 'disconnected'
  )

  const handleEvent = useCallback(
    (event: string, data: AdminEventPayload) =>
      dispatchAdminEvent(event, data, {
        queryClient,
        addNotification: addNotification as unknown as DispatchDeps['addNotification'],
      }),
    [queryClient, addNotification],
  )

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const token = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)

    // socket.io owns reconnection, so the manual backoff timer the old hook kept
    // is gone — two independent retry loops raced and produced duplicate sockets.
    const socket = io(resolveEndpoint(), {
      // The gateway's `extractToken` reads `handshake.auth.token` first. Sending
      // it in `auth` rather than the query string keeps the access token out of
      // proxy and server access logs.
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: BASE_RECONNECT_MS,
      reconnectionDelayMax: MAX_RECONNECT_MS,
      // The token is read once at connect time; a refresh remounts this effect.
      forceNew: true,
    })

    socketRef.current = socket

    socket.on('connect', () => setConnectionStatus('connected'))
    socket.on('disconnect', () => setConnectionStatus('disconnected'))
    socket.io.on('reconnect_attempt', () => setConnectionStatus('connecting'))
    socket.on('connect_error', () => setConnectionStatus('disconnected'))

    // Server acknowledgement of a successful authenticated handshake.
    socket.on('connected', () => setConnectionStatus('connected'))

    // Every relayed event arrives on the single `message` channel as
    // `{ event, data, timestamp }`. The old hook parsed raw JSON and switched on
    // `data.type`, a key the gateway never sends, so every message hit `default`.
    socket.on('message', (envelope: AdminSocketEnvelope) => {
      if (!envelope || typeof envelope.event !== 'string') return
      handleEvent(envelope.event, envelope.data ?? {})
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [enabled, handleEvent])

  return { connectionStatus }
}
