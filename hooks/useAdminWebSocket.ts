'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useNotificationStore } from '@/store/adminStore'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/v1/admin/ws'
const RECONNECT_INTERVAL = 10000

export function useAdminWebSocket(enabled = true) {
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const backoffMs = useRef(RECONNECT_INTERVAL)
  const addNotification = useNotificationStore((s) => s.addNotification)

  const connect = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return

    const token = localStorage.getItem('admin_access_token')
    const url = token ? `${WS_URL}?token=${token}` : WS_URL

    try {
      ws.current = new WebSocket(url)

      ws.current.onopen = () => {
        console.info('[WS] Connected to admin gateway')
        backoffMs.current = RECONNECT_INTERVAL
      }

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleMessage(data)
        } catch {
          // ignore
        }
      }

      ws.current.onerror = () => {
        ws.current?.close()
      }

      ws.current.onclose = () => {
        if (!enabled) return
        reconnectTimeout.current = setTimeout(() => {
          backoffMs.current = Math.min(backoffMs.current * 1.5, 60000)
          connect()
        }, backoffMs.current)
      }
    } catch {
      // ignore connection errors
    }
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMessage = useCallback(
    (data: any) => {
      switch (data.type) {
        case 'EMERGENCY_ALERT':
          addNotification({
            type: 'EMERGENCY',
            title: '🚨 Emergency Alert',
            message: `${data.alertType} alert from ${data.userName}`,
            priority: 'urgent',
            data,
          })
          // Play sound
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
        case 'NEW_BOOKING':
          addNotification({
            type: 'BOOKING',
            title: 'New Booking',
            message: `Booking ${data.bookingRef} created`,
            data,
          })
          break
        case 'DRIVER_STATUS_CHANGED':
          addNotification({
            type: 'DRIVER_STATUS',
            title: 'Driver Status Update',
            message: `${data.driverName} is now ${data.status}`,
            data,
          })
          break
        default:
          break
      }
    },
    [addNotification],
  )

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current)
      ws.current?.close()
    }
  }, [connect])

  const connectionStatus =
    ws.current?.readyState === WebSocket.OPEN
      ? 'connected'
      : ws.current?.readyState === WebSocket.CONNECTING
        ? 'connecting'
        : 'disconnected'

  return { connectionStatus }
}
