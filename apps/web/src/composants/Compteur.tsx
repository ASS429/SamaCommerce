import { useEffect, useRef, useState } from 'react'
import { fcfa } from '../outils/api'

/* Design 3.3 — Compteur vivant : les montants « roulent » vers leur nouvelle
 * valeur (montée à ressort) au chargement et à chaque mise à jour → le chiffre
 * devient un événement. Sans dépendance (requestAnimationFrame), mouvement
 * réduit respecté. */

const sortieExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

export default function Compteur({
  valeur,
  format = fcfa,
  duree = 650,
  className,
}: {
  valeur: number
  format?: (n: number) => string
  duree?: number
  className?: string
}) {
  const [affiche, definirAffiche] = useState(valeur)
  const depuis = useRef(valeur)
  const image = useRef<number | undefined>(undefined)

  useEffect(() => {
    const depart = depuis.current
    depuis.current = valeur
    if (depart === valeur) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      definirAffiche(valeur)
      return
    }

    const debut = performance.now()
    const avancer = (maintenant: number) => {
      const t = Math.min(1, (maintenant - debut) / duree)
      definirAffiche(depart + (valeur - depart) * sortieExpo(t))
      if (t < 1) image.current = requestAnimationFrame(avancer)
    }
    image.current = requestAnimationFrame(avancer)
    return () => { if (image.current) cancelAnimationFrame(image.current) }
  }, [valeur, duree])

  return <span className={className}>{format(Math.round(affiche))}</span>
}
