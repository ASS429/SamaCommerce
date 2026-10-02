/* Feuille « inclus dans le plan Essentiel » : ouverte par l'application quand
 * le serveur refuse une action au nom du plan (réponse 402).
 *
 * Chaque écran garde sa propre gestion d'erreur ; cette feuille dit en plus
 * QUEL plan permet l'action, et y mène. Plusieurs refus simultanés (une page
 * qui charge deux rapports réservés) n'ouvrent qu'une feuille. */

import { useEffect, useRef, useState } from 'react'
import { Lock } from 'lucide-react'
import { EVENEMENT_PLAN_REQUIS, type DetailPlanRequis } from '../outils/api'
import '../abonnement.css'

export default function FeuillePlanRequis({ estEmploye, surVoirPlans }: { estEmploye: boolean; surVoirPlans: () => void }) {
  const [detail, definirDetail] = useState<DetailPlanRequis | null>(null)
  const action = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const surRefus = (e: Event) => definirDetail((actuel) => actuel ?? (e as CustomEvent<DetailPlanRequis>).detail)
    window.addEventListener(EVENEMENT_PLAN_REQUIS, surRefus)
    return () => window.removeEventListener(EVENEMENT_PLAN_REQUIS, surRefus)
  }, [])

  useEffect(() => {
    if (!detail) return
    action.current?.focus()
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') definirDetail(null) }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [detail])

  if (!detail) return null
  const fermer = () => definirDetail(null)
  const titre = detail.plan_requis_nom ? `Inclus dans le plan ${detail.plan_requis_nom}` : 'Limite de votre plan'

  return (
    <div className="fenetre-calque" style={{ alignItems: 'flex-end' }} onClick={fermer}>
      <div className="fenetre-boite feuille-plan" role="dialog" aria-modal="true" aria-labelledby="titre-plan-requis" onClick={(e) => e.stopPropagation()}>
        <span className="feuille-plan-icone" aria-hidden="true"><Lock size={24} /></span>
        <h2 id="titre-plan-requis" className="fenetre-titre">{titre}</h2>
        <p className="feuille-plan-texte">{detail.message}</p>
        {estEmploye ? (
          <>
            <p className="feuille-plan-texte">Parlez-en au propriétaire de la boutique : c’est lui qui choisit le plan.</p>
            <button ref={action} type="button" className="bouton-principal feuille-plan-bouton" onClick={fermer}>Compris</button>
          </>
        ) : (
          <>
            <button ref={action} type="button" className="bouton-principal feuille-plan-bouton" onClick={() => { fermer(); surVoirPlans() }}>Voir les plans</button>
            <button type="button" className="bouton-annuler feuille-plan-bouton" onClick={fermer}>Plus tard</button>
          </>
        )}
      </div>
    </div>
  )
}
