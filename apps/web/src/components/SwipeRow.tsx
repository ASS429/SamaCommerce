import { useRef, useState, type ReactNode } from 'react'

/** Ligne de liste « swipe-to-delete » : glisser vers la gauche révèle le bouton supprimer. */
export default function SwipeRow({ onDelete, children }: { onDelete: () => void; children: ReactNode }) {
  const [dx, setDx] = useState(0)
  const startX = useRef(0)
  const startY = useRef(0)
  const dragging = useRef(false)

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    dragging.current = false
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const dX = e.touches[0].clientX - startX.current
    const dY = e.touches[0].clientY - startY.current
    if (!dragging.current && Math.abs(dX) > Math.abs(dY) && Math.abs(dX) > 8) dragging.current = true
    if (dragging.current && dX < 0) setDx(Math.max(dX, -88))
  }
  const onTouchEnd = () => { setDx(dx < -48 ? -80 : 0) }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, marginBottom: 10 }}>
      <button
        aria-label="Supprimer"
        onClick={() => { setDx(0); onDelete() }}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, background: 'var(--danger)', color: '#fff', border: 'none', fontSize: 22, cursor: 'pointer' }}
      >🗑️</button>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: `translateX(${dx}px)`, transition: dragging.current ? 'none' : 'transform .2s', position: 'relative', zIndex: 1 }}
      >
        {children}
      </div>
    </div>
  )
}
