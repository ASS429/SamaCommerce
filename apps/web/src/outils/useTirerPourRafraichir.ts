import { useRef, useState } from 'react'

/** Tirer pour rafraîchir : à attacher au conteneur qui défile. Déclenche
 *  `surRafraichir` quand on tire vers le bas en haut de liste. */
export function useTirerPourRafraichir(surRafraichir: () => void | Promise<void>) {
  const [traction, definirTraction] = useState(0)
  const [rafraichissement, definirRafraichissement] = useState(false)
  const departY = useRef(0)
  const actif = useRef(false)

  const onTouchStart = (e: React.TouchEvent) => {
    const element = e.currentTarget as HTMLElement
    actif.current = element.scrollTop <= 0
    departY.current = e.touches[0].clientY
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!actif.current || rafraichissement) return
    const dy = e.touches[0].clientY - departY.current
    if (dy > 0) definirTraction(Math.min(dy * 0.4, 70))
  }
  const onTouchEnd = async () => {
    if (!actif.current) return
    actif.current = false
    if (traction > 50 && !rafraichissement) {
      definirRafraichissement(true); definirTraction(36)
      try { await surRafraichir() } finally { definirRafraichissement(false); definirTraction(0) }
    } else {
      definirTraction(0)
    }
  }

  // Les clés de `gestionnaires` sont les attributs d'événement du DOM : elles
  // s'étalent telles quelles sur l'élément (`{...gestionnaires}`).
  return { traction, rafraichissement, gestionnaires: { onTouchStart, onTouchMove, onTouchEnd } }
}
