import { useRef, useState, type ReactNode } from 'react'

/** Ligne de liste « glisser pour supprimer » : glisser vers la gauche révèle le bouton supprimer. */
export default function LigneGlissante({ surSuppression, children }: { surSuppression: () => void; children: ReactNode }) {
  const [dx, definirDx] = useState(0)
  const departX = useRef(0)
  const departY = useRef(0)
  const glissement = useRef(false)

  const onTouchStart = (e: React.TouchEvent) => {
    departX.current = e.touches[0].clientX
    departY.current = e.touches[0].clientY
    glissement.current = false
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const ecartX = e.touches[0].clientX - departX.current
    const ecartY = e.touches[0].clientY - departY.current
    if (!glissement.current && Math.abs(ecartX) > Math.abs(ecartY) && Math.abs(ecartX) > 8) glissement.current = true
    if (glissement.current && ecartX < 0) definirDx(Math.max(ecartX, -88))
  }
  const onTouchEnd = () => { definirDx(dx < -48 ? -80 : 0) }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, marginBottom: 10 }}>
      <button
        aria-label="Supprimer"
        onClick={() => { definirDx(0); surSuppression() }}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, background: 'var(--danger)', color: '#fff', border: 'none', fontSize: 22, cursor: 'pointer' }}
      >🗑️</button>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: `translateX(${dx}px)`, transition: glissement.current ? 'none' : 'transform .2s', position: 'relative', zIndex: 1 }}
      >
        {children}
      </div>
    </div>
  )
}
