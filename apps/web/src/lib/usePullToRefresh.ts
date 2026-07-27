import { useRef, useState } from 'react'

/** Pull-to-refresh : à attacher au conteneur scrollable. Déclenche onRefresh quand on tire vers le bas en haut de liste. */
export function usePullToRefresh(onRefresh: () => void | Promise<void>) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const active = useRef(false)

  const onTouchStart = (e: React.TouchEvent) => {
    const el = e.currentTarget as HTMLElement
    active.current = el.scrollTop <= 0
    startY.current = e.touches[0].clientY
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!active.current || refreshing) return
    const dy = e.touches[0].clientY - startY.current
    if (dy > 0) setPull(Math.min(dy * 0.4, 70))
  }
  const onTouchEnd = async () => {
    if (!active.current) return
    active.current = false
    if (pull > 50 && !refreshing) {
      setRefreshing(true); setPull(36)
      try { await onRefresh() } finally { setRefreshing(false); setPull(0) }
    } else {
      setPull(0)
    }
  }

  return { pull, refreshing, handlers: { onTouchStart, onTouchMove, onTouchEnd } }
}
