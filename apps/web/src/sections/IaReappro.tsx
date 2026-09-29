import { useEffect, useState } from 'react'
import { Ia, type ElementReappro } from '../outils/api'
import { ListeSquelette } from '../composants/Squelette'
import { iconeProduit, fondProduit } from '../outils/iconeProduit'
import type { Ecran } from './Accueil'
import ErreurChargement from '../composants/ErreurChargement'
import { useErreurChargement } from '../outils/erreursChargement'

export default function IaReappro({ surNavigation }: { surNavigation?: (e: Ecran) => void }) {
  const [elements, definirElements] = useState<ElementReappro[]>([])
  const [chargement, definirChargement] = useState(true)
  const [balayage, definirBalayage] = useState(true) // Design 3.4 — balayage radar à l'ouverture
  const { erreur, surveiller, effacer } = useErreurChargement()

  const charger = () => { effacer(); surveiller(Ia.reappro().then(definirElements)).finally(() => definirChargement(false)) }
  useEffect(() => { charger() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const minuterie = setTimeout(() => definirBalayage(false), mouvementReduit ? 0 : 1500)
    return () => clearTimeout(minuterie)
  }, [])

  // Les urgences (rupture proche) remontent physiquement en tête de liste.
  const tries = [...elements].sort((a, b) => {
    const ja = a.jours_avant_rupture ?? 9999, jb = b.jours_avant_rupture ?? 9999
    return ja - jb
  })

  const urgence = (j: number | null) =>
    j === null ? { couleur: 'var(--attenue)', texte: 'OK', bordure: 'var(--trait)' }
      : j <= 5 ? { couleur: 'var(--danger)', texte: `${j} j`, bordure: 'var(--danger)' }
        : j <= 14 ? { couleur: 'var(--attention)', texte: `${j} j`, bordure: 'var(--attention)' }
          : { couleur: 'var(--vert)', texte: `${j} j`, bordure: 'var(--vert)' }

  const aCommander = elements.filter((e) => e.a_commander_affiche > 0)
  const methode = elements[0]?.methode

  return (
    <>
      <div className="page-entete"><h2>🤖 Réapprovisionnement</h2>
        {methode && <span className="pastille-douce" style={{ background: methode === 'modele' ? '#EDE9FE' : 'var(--fond)', color: methode === 'modele' ? 'var(--marque)' : 'var(--attenue)' }}><span className={methode === 'modele' ? 'ia-cerveau-lueur' : ''}>{methode === 'modele' ? '🧠' : '📐'}</span> {methode === 'modele' ? 'Modèle IA' : 'Estimation'}</span>}
      </div>

      {(balayage || chargement) && (
        <div className="ia-radar" aria-hidden="true">
          <span className="ia-radar-balayage" /><span className="ia-radar-balayage" /><span className="ia-radar-balayage" />
          <div className="ia-radar-libelle"><span className="ia-cerveau-lueur">📡</span> Analyse des ventes…</div>
        </div>
      )}

      <div className="guide">
        <div style={{ fontSize: 22 }}>💡</div>
        <div>
          <div className="guide-titre">Prévision de la demande</div>
          <div style={{ fontSize: 12.5, color: 'var(--libelle)', lineHeight: 1.45 }}>
            À partir de tes ventes récentes, l'IA estime la <b>demande quotidienne</b>, les <b>jours avant rupture</b> et la <b>quantité à recommander</b> (couverture ~14 jours). {aCommander.length > 0 ? `${aCommander.length} produit(s) à réapprovisionner.` : 'Aucun réappro urgent 🎉'}
          </div>
        </div>
      </div>

      {chargement && !balayage && <ListeSquelette nombre={5} />}
      {!chargement && !balayage && erreur && <ErreurChargement erreur={erreur} surReessai={charger} />}
      {!chargement && !balayage && !erreur && elements.length === 0 && <div className="etat-vide"><div className="vide-icone">📦</div><div className="vide-sous-titre">Pas encore de données de vente à analyser</div></div>}

      {!chargement && !balayage && tries.map((e) => {
        const u = urgence(e.jours_avant_rupture)
        const urgent = e.jours_avant_rupture !== null && e.jours_avant_rupture <= 5
        return (
          <div key={e.produit_id} className={`carte${urgent ? ' ia-urgence-montee' : ''}`} style={{ borderLeft: `4px solid ${u.bordure}`, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Le pictogramme du produit, identique au stock et à la caisse :
                  on repère « le riz » sans lire la ligne. */}
              <span className="produit-icone" style={{ width: 40, height: 40, fontSize: 21, borderRadius: 13, background: fondProduit(e.nom) }} aria-hidden="true">
                {iconeProduit(e.nom)}
              </span>
              <div className="produit-nom" style={{ flex: 1, minWidth: 0 }}>{e.nom}</div>
              <span className="produit-stock-pilule" style={{ background: 'var(--fond)', color: u.couleur, fontWeight: 700 }}>⏳ {u.texte}</span>
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8, fontSize: 12.5, color: 'var(--attenue)' }}>
              <span>Stock : <b style={{ color: 'var(--encre)' }}>{e.stock_affiche} {e.libelle_affichage}</b></span>
              <span>Demande/j : <b style={{ color: 'var(--encre)' }}>{e.moyenne_jour_affichee} {e.libelle_affichage}</b></span>
            </div>
            {e.a_commander_affiche > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--trait-doux)' }}>
                <div style={{ fontSize: 13 }}>📦 Recommandé : <b className="police-titre" style={{ color: 'var(--marque)' }}>{e.a_commander_affiche} {e.libelle_affichage}</b></div>
                <button className="bouton-compact bouton-compact-modifier" onClick={() => surNavigation?.('commandes')}>Commander</button>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
