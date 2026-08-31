'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Subscribes to a CSS media query.
 *
 * Implemented with `useSyncExternalStore` rather than `useState` + `useEffect`:
 * seeding the state from inside an effect meant every mount rendered once with
 * a stale `false` and then re-rendered, which cascades through the whole admin
 * layout. `useSyncExternalStore` reads the correct value during the first
 * client render and still falls back to `false` on the server.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onStoreChange)
      return () => media.removeEventListener('change', onStoreChange)
    },
    [query]
  )

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
