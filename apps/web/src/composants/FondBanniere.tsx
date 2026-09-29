import { Suspense, lazy, useMemo } from 'react'

/* Design 3.2 / 3.7 — Choisit le décor de l'écran de connexion :
 *  - WebGL disponible ET mouvement autorisé → scène 3D « boutique vivante » (différée) ;
 *  - sinon → dégradé animé « aurore » (violet → rose). Dégradation gracieuse. */

const SceneBanniere = lazy(() => import('./SceneBanniere'))

function aWebGL(): boolean {
  try {
    const toile = document.createElement('canvas')
    return !!(toile.getContext('webgl2') || toile.getContext('webgl'))
  } catch {
    return false
  }
}

export default function FondBanniere() {
  const en3D = useMemo(() => {
    const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // On évite la 3D sur très petits écrans (mobiles d'entrée de gamme au marché).
    const assezGrand = window.matchMedia('(min-width: 640px)').matches
    return !mouvementReduit && assezGrand && aWebGL()
  }, [])

  return (
    <div className="fond-banniere" aria-hidden="true">
      <div className="fond-aurore" />
      {en3D && (
        <Suspense fallback={null}>
          <SceneBanniere />
        </Suspense>
      )}
      <div className="fond-vignette" />
    </div>
  )
}
