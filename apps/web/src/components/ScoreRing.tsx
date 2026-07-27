import { useEffect, useState } from 'react'

/* Design 3.4 — Jauge de crédit orbitale : le score 0-100 se remplit dans un
 * anneau (dégradé feu vert→rouge), le nombre défile, l'aiguille oscille avec
 * inertie avant de se stabiliser → la décision a du poids. */

const R = 52
const C = 2 * Math.PI * R

export default function ScoreRing({ score, color, label }: { score: number; color: string; label: string }) {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [shown, setShown] = useState(reduced ? score : 0)

  useEffect(() => {
    if (reduced) { setShown(score); return }
    // Léger dépassement puis stabilisation (inertie de l'aiguille).
    const over = Math.min(100, score + 6)
    const t1 = setTimeout(() => setShown(over), 30)
    const t2 = setTimeout(() => setShown(score), 480)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [score, reduced])

  const offset = C * (1 - Math.max(0, Math.min(100, shown)) / 100)

  return (
    <div className="score-ring">
      <svg viewBox="0 0 120 120" width="112" height="112" role="img" aria-label={`Score ${score} sur 100 — ${label}`}>
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--danger)" />
            <stop offset="55%" stopColor="var(--warning)" />
            <stop offset="100%" stopColor="var(--green)" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--line-soft)" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={R} fill="none" stroke="url(#scoreGrad)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          style={{ transition: reduced ? 'none' : 'stroke-dashoffset .55s cubic-bezier(.34,1.4,.5,1)', filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div className="score-ring-center">
        <div className="sora score-ring-num" style={{ color }}>{Math.round(shown)}</div>
        <div className="score-ring-max">/ 100</div>
      </div>
    </div>
  )
}
