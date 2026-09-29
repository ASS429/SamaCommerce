import { useEffect, useState } from 'react'

/* Design 3.4 — Jauge de crédit orbitale : le score 0-100 se remplit dans un
 * anneau (dégradé feu vert→rouge), le nombre défile, l'aiguille oscille avec
 * inertie avant de se stabiliser → la décision a du poids. */

const R = 52
const C = 2 * Math.PI * R

export default function AnneauScore({ score, couleur, libelle }: { score: number; couleur: string; libelle: string }) {
  const mouvementReduit = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [affiche, definirAffiche] = useState(mouvementReduit ? score : 0)

  useEffect(() => {
    if (mouvementReduit) { definirAffiche(score); return }
    // Léger dépassement puis stabilisation (inertie de l'aiguille).
    const depassement = Math.min(100, score + 6)
    const t1 = setTimeout(() => definirAffiche(depassement), 30)
    const t2 = setTimeout(() => definirAffiche(score), 480)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [score, mouvementReduit])

  const decalage = C * (1 - Math.max(0, Math.min(100, affiche)) / 100)

  return (
    <div className="score-anneau">
      <svg viewBox="0 0 120 120" width="112" height="112" role="img" aria-label={`Score ${score} sur 100 — ${libelle}`}>
        <defs>
          <linearGradient id="degradeScore" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--danger)" />
            <stop offset="55%" stopColor="var(--attention)" />
            <stop offset="100%" stopColor="var(--vert)" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--trait-doux)" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={R} fill="none" stroke="url(#degradeScore)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={decalage}
          transform="rotate(-90 60 60)"
          style={{ transition: mouvementReduit ? 'none' : 'stroke-dashoffset .55s cubic-bezier(.34,1.4,.5,1)', filter: `drop-shadow(0 0 6px ${couleur}66)` }}
        />
      </svg>
      <div className="score-anneau-centre">
        <div className="police-titre score-anneau-nombre" style={{ color: couleur }}>{Math.round(affiche)}</div>
        <div className="score-anneau-max">/ 100</div>
      </div>
    </div>
  )
}
