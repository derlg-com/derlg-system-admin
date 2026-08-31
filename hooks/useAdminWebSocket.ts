'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNotificationStore } from '@/store/adminStore'
import { toast } from 'sonner'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/v1/admin/ws'
const BASE_RECONNECT_MS = 10_000
const MAX_RECONNECT_MS = 60_000

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'

/**
 * Shape of a message pushed over `/v1/admin/ws`. The gateway emits a mix of
 * camelCase (admin API) and snake_case (Telegram bot) keys for the same
 * concepts, so both spellings are declared and read defensively.
 */
interface AdminSocketMessage {
  type?: string
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

export function useAdminWebSocket(enabled = true) {
  const queryClient = useQueryClient()
  const addNotification = useNotificationStore((s) => s.addNotification)
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttempt = useRef(0)
  // Declared before `connect` so the reconnect timer can reach the latest
  // callback without referencing `connect` before its initialiser runs.
  const connectRef = useRef<(() => void) | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() =>
    enabled ? 'connecting' : 'disconnected'
  )

  const handleMessage = useCallback(
    (data: AdminSocketMessage) => {
      switch (data.type) {
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
          // Play alert sound
          try {
            const ctx = new AudioContext()
            const oscillator = ctx.createOscillator()
            oscillator.frequency.setValueAtTime(880, ctx.currentTime)
            oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.1)
            oscillator.connect(ctx.destination)
            oscillator.start()
            oscillator.stop(ctx.currentTime + 0.3)
          } catch {
            // ignore audio errors
          }
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
          // Dispatch custom event for components listening
          window.dispatchEvent(
            new CustomEvent('websocket-message', { detail: data })
          )
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

        default:
          break
      }
    },
    [queryClient, addNotification],
  )

  const connect = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return

    const token = localStorage.getItem('admin_access_token')
    const url = token ? `${WS_URL}?token=${token}` : WS_URL

    // Backoff retry. Called only from socket callbacks, never synchronously
    // from the mount effect, so the setState here cannot cascade a render.
    const scheduleReconnect = () => {
      if (!enabled) return
      const delay = Math.min(
        BASE_RECONNECT_MS * Math.pow(2, reconnectAttempt.current),
        MAX_RECONNECT_MS,
      )
      reconnectAttempt.current += 1
      setConnectionStatus('disconnected')
      reconnectTimeout.current = setTimeout(() => {
        setConnectionStatus('connecting')
        connectRef.current?.()
      }, delay)
    }

    try {
      // No `setConnectionStatus('connecting')` here: on mount this runs inside
      // an effect, and the initial state already reads 'connecting' when
      // enabled. Retries set it from the timer callback above.
      ws.current = new WebSocket(url)

      ws.current.onopen = () => {
        reconnectAttempt.current = 0
        setConnectionStatus('connected')
      }

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleMessage(data)
        } catch {
          // ignore parse errors
        }
      }

      ws.current.onerror = () => {
        ws.current?.close()
      }

      ws.current.onclose = scheduleReconnect
    } catch {
      // A malformed URL throws synchronously; retry on the same backoff rather
      // than going dark for the rest of the session.
      scheduleReconnect()
    }
  }, [enabled, handleMessage])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current)
      ws.current?.close()
    }
  }, [connect])

  return { connectionStatus }
}
