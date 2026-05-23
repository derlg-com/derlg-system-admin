'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNotificationStore } from '@/store/adminStore'
import { toast } from 'sonner'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/v1/admin/ws'
const BASE_RECONNECT_MS = 10_000
const MAX_RECONNECT_MS = 60_000

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'

export function useAdminWebSocket(enabled = true) {
  const queryClient = useQueryClient()
  const addNotification = useNotificationStore((s) => s.addNotification)
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttempt = useRef(0)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')

  const handleMessage = useCallback(
    (data: any) => {
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

    try {
      setConnectionStatus('connecting')
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

      ws.current.onclose = () => {
        if (!enabled) return
        const delay = Math.min(
          BASE_RECONNECT_MS * Math.pow(2, reconnectAttempt.current),
          MAX_RECONNECT_MS,
        )
        reconnectAttempt.current += 1
        setConnectionStatus('disconnected')
        reconnectTimeout.current = setTimeout(() => {
          connect()
        }, delay)
      }
    } catch {
      setConnectionStatus('disconnected')
    }
  }, [enabled, handleMessage])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current)
      ws.current?.close()
    }
  }, [connect])

  return { connectionStatus }
}
