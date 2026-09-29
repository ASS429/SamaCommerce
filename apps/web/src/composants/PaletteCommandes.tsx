import { useEffect, useMemo, useRef, useState } from 'react'

/* Design 3.6 — Palette de commandes sur ordinateur (Ctrl/Cmd+K) : recherche et
 * actions universelles, avec animation de projecteur. Navigation clavier
 * complète. */

export type Commande = { id: string; libelle: string; icone: string; aide?: string; executer: () => void }

/* Replie les accents et la casse. Sans cela, « equipe » ne trouvait pas
   « Équipe » et « reappro » ne trouvait pas « Réappro IA » : sur un clavier de
   téléphone, personne ne va chercher les accents. Même normalisation que pour
   les pictogrammes de produits (outils/iconeProduit). */
const replier = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export default function PaletteCommandes({ commandes }: { commandes: Commande[] }) {
  const [ouverte, definirOuverte] = useState(false)
  const [recherche, definirRecherche] = useState('')
  const [indice, definirIndice] = useState(0)
  const champ = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        definirOuverte((o) => !o)
      }
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [])

  useEffect(() => {
    if (ouverte) { definirRecherche(''); definirIndice(0); setTimeout(() => champ.current?.focus(), 40) }
  }, [ouverte])

  const filtrees = useMemo(() => {
    const s = replier(recherche.trim())
    return s ? commandes.filter((c) => replier(c.libelle).includes(s)) : commandes
  }, [recherche, commandes])

  if (!ouverte) return null

  const executer = (c: Commande | undefined) => { if (!c) return; definirOuverte(false); c.executer() }

  const surToucheChamp = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return definirOuverte(false)
    if (e.key === 'ArrowDown') { e.preventDefault(); definirIndice((i) => Math.min(filtrees.length - 1, i + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); definirIndice((i) => Math.max(0, i - 1)) }
    if (e.key === 'Enter') { e.preventDefault(); executer(filtrees[indice]) }
  }

  return (
    <div className="palette-calque" onClick={() => definirOuverte(false)}>
      <div className="palette-boite" role="dialog" aria-modal="true" aria-label="Palette de commandes" onClick={(e) => e.stopPropagation()}>
        <input
          ref={champ}
          className="palette-saisie"
          placeholder="Rechercher une action, une section… (ex. « vendre », « chiffres »)"
          value={recherche}
          onChange={(e) => { definirRecherche(e.target.value); definirIndice(0) }}
          onKeyDown={surToucheChamp}
        />
        <div className="palette-liste">
          {filtrees.length === 0
            ? <div className="palette-vide">Aucun résultat pour « {recherche} »</div>
            : filtrees.map((c, i) => (
              <button key={c.id} className={`palette-element ${i === indice ? 'actif' : ''}`} onMouseEnter={() => definirIndice(i)} onClick={() => executer(c)}>
                <span className="palette-icone" aria-hidden="true">{c.icone}</span>
                <span style={{ flex: 1 }}>{c.libelle}</span>
                {c.aide && <span style={{ color: 'var(--attenue-2)', fontSize: 12 }}>{c.aide}</span>}
              </button>
            ))}
        </div>
        <div className="palette-aide">
          <span><span className="palette-touche">↑↓</span> naviguer</span>
          <span><span className="palette-touche">↵</span> ouvrir</span>
          <span><span className="palette-touche">Esc</span> fermer</span>
        </div>
      </div>
    </div>
  )
}
