import { Suspense, lazy, useMemo } from 'react'

/* Design 3.2 / 3.7 — Choisit le décor du login :
 *  - WebGL dispo ET mouvement autorisé → scène 3D « boutique vivante » (lazy).
 *  - sinon → dégradé animé « aurora » (violet → rose). Dégradation gracieuse. */

const HeroScene = lazy(() => import('./HeroScene'))

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export default function HeroBackdrop() {
  const use3D = useMemo(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // On évite le 3D sur très petits écrans (mobiles bas de gamme au marché).
    const bigEnough = window.matchMedia('(min-width: 640px)').matches
    return !reduced && bigEnough && hasWebGL()
  }, [])

  return (
    <div className="hero-backdrop" aria-hidden="true">
      <div className="hero-aurora" />
      {use3D && (
        <Suspense fallback={null}>
          <HeroScene />
        </Suspense>
      )}
      <div className="hero-vignette" />
    </div>
  )
}
