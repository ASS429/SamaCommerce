import { useEffect, useRef, useState } from 'react'
import { fcfa } from '../lib/api'

/* Design 3.3 — Compteur vivant : les montants « roulent » vers leur nouvelle
 * valeur (count-up à ressort) au chargement et à chaque mise à jour → le chiffre
 * devient un événement. Sans dépendance (requestAnimationFrame), reduced-motion
 * respecté. */

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

export default function Odometer({
  value,
  format = fcfa,
  duration = 650,
  className,
}: {
  value: number
  format?: (n: number) => string
  duration?: number
  className?: string
}) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const from = fromRef.current
    fromRef.current = value
    if (from === value) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value)
      return
    }

    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setDisplay(from + (value - from) * easeOutExpo(t))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value, duration])

  return <span className={className}>{format(Math.round(display))}</span>
}
