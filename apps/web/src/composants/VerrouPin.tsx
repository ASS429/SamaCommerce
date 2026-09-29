import { useEffect, useRef, useState } from 'react'
import { aUnCode, verifierCode, lireDelaiVerrouMin } from '../outils/verrouPin'
import { bulle } from '../outils/bulles'

/**
 * S11 — Gère le verrouillage par code PIN : détecte l'inactivité, affiche
 * l'écran de déverrouillage. À monter une seule fois quand l'utilisateur est
 * connecté.
 */
export default function VerrouPin() {
  const [verrouille, definirVerrouille] = useState(false)
  const minuterie = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!aUnCode()) return

    const armer = () => {
      if (minuterie.current) clearTimeout(minuterie.current)
      minuterie.current = setTimeout(() => definirVerrouille(true), lireDelaiVerrouMin() * 60_000)
    }
    const surActivite = () => { if (!verrouille) armer() }
    const surMasquage = () => { if (document.visibilityState === 'hidden' && aUnCode()) definirVerrouille(true) }

    const evenements = ['pointerdown', 'keydown', 'touchstart', 'mousemove'] as const
    evenements.forEach((e) => window.addEventListener(e, surActivite, { passive: true }))
    document.addEventListener('visibilitychange', surMasquage)
    armer()

    return () => {
      evenements.forEach((e) => window.removeEventListener(e, surActivite))
      document.removeEventListener('visibilitychange', surMasquage)
      if (minuterie.current) clearTimeout(minuterie.current)
    }
  }, [verrouille])

  if (!verrouille) return null
  return <EcranDeverrouillage surDeverrouillage={() => definirVerrouille(false)} />
}

function EcranDeverrouillage({ surDeverrouillage }: { surDeverrouillage: () => void }) {
  const [chiffres, definirChiffres] = useState('')

  const valider = async (code: string) => {
    if (await verifierCode(code)) {
      surDeverrouillage()
    } else {
      bulle('Code incorrect', 'erreur')
      definirChiffres('')
    }
  }

  const appuyer = (c: string) => {
    const suite = (chiffres + c).slice(0, 4)
    definirChiffres(suite)
    if (suite.length === 4) setTimeout(() => valider(suite), 120)
  }

  return (
    <div className="pin-calque" role="dialog" aria-modal="true" aria-label="Boutique verrouillée">
      <div className="pin-carte">
        <div className="pin-cadenas" aria-hidden="true">🔒</div>
        <div className="pin-titre police-titre">Boutique verrouillée</div>
        <div className="pin-sous-titre">Entrez votre code pour continuer</div>
        <div className="pin-points">
          {[0, 1, 2, 3].map((i) => <span key={i} className={`pin-point ${i < chiffres.length ? 'allume' : ''}`} />)}
        </div>
        <div className="pin-clavier">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
            <button key={n} className="pin-touche" onClick={() => appuyer(n)}>{n}</button>
          ))}
          <span />
          <button className="pin-touche" onClick={() => appuyer('0')}>0</button>
          <button className="pin-touche pin-effacer" aria-label="Effacer" onClick={() => definirChiffres(chiffres.slice(0, -1))}>⌫</button>
        </div>
      </div>
    </div>
  )
}
