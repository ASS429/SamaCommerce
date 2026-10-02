/* Carte « Mon plan » de l'accueil, des paramètres et de la colonne du bureau.
 *
 * Elle remplace la carte « Passer Premium », qui s'affichait à tout compte
 * Gratuit sans rien dire de son essai ni de son échéance. Ici, elle ne parle
 * que quand il y a quelque chose à dire : essai qui finit, échéance proche,
 * délai de grâce, paiement en vérification, ou plan Gratuit. Un plan payé
 * loin de son échéance ne réclame rien sur l'accueil. */

import { ArrowRight, Clock, Sparkles, TriangleAlert } from 'lucide-react'
import { useAbonnement } from '../outils/requetes'
import { dateLongue, delai } from '../outils/abonnement'
import { fcfa, type EtatAbonnement, type PaiementAbonnement } from '../outils/api'
import '../abonnement.css'

type Contexte = 'accueil' | 'profil' | 'bureau'
type Message = { ton: 'vedette' | 'douce' | 'alerte'; titre: string; detail: string; action: string }

export default function CartePlan({ contexte, surOuvrir }: { contexte: Contexte; surOuvrir: () => void }) {
  const { data } = useAbonnement()
  if (!data || !data.peut_payer) return null

  const message = messageDuPlan(data.etat, data.en_attente, data.plans.find((p) => p.code === 'essentiel')?.prix_mensuel ?? null, contexte)
  if (!message) return null
  const Icone = message.ton === 'alerte' ? TriangleAlert : message.ton === 'douce' ? Clock : Sparkles

  return (
    <button type="button" className={`carte-plan carte-plan--${message.ton} carte-plan--${contexte}`} onClick={surOuvrir}>
      <span className="carte-plan-icone" aria-hidden="true"><Icone size={22} /></span>
      <span className="carte-plan-texte">
        <span className="carte-plan-titre">{message.titre}</span>
        <span className="carte-plan-detail">{message.detail}</span>
      </span>
      <span className="carte-plan-action">
        {message.action}
        <ArrowRight size={16} aria-hidden="true" />
      </span>
    </button>
  )
}

function messageDuPlan(etat: EtatAbonnement, enAttente: PaiementAbonnement | null, prixEssentiel: number | null, contexte: Contexte): Message | null {
  if (enAttente) {
    return { ton: 'douce', titre: 'Paiement en vérification', detail: `${enAttente.formule}, ${fcfa(enAttente.montant_declare)}`, action: 'Voir' }
  }
  const jours = etat.jours_restants
  switch (etat.source) {
    case 'grace':
      return { ton: 'alerte', titre: `Votre plan ${etat.plan.nom} a expiré`, detail: `Tout fonctionne jusqu'au ${dateLongue(etat.grace_jusqu_au, false)}`, action: 'Renouveler' }
    case 'essai':
      return jours !== null && jours <= 7
        ? { ton: 'vedette', titre: `Votre essai ${etat.plan.nom} se termine ${delai(jours)}`, detail: 'Choisissez votre plan pour tout garder', action: 'Choisir' }
        : { ton: 'douce', titre: `Essai ${etat.plan.nom} : encore ${jours} jours`, detail: 'Choisissez votre plan quand vous voulez', action: 'Mon plan' }
    case 'paye':
      if (jours !== null && jours <= 7) {
        return { ton: 'douce', titre: `Plan ${etat.plan.nom} : échéance ${delai(jours)}`, detail: 'Renouvelez : la période suivante commence à la suite', action: 'Renouveler' }
      }
      // Loin de l'échéance : rien à réclamer sur l'accueil, un simple repère ailleurs.
      return contexte === 'accueil' ? null
        : { ton: 'douce', titre: `Plan ${etat.plan.nom}`, detail: `Jusqu'au ${dateLongue(etat.fin_le)}`, action: 'Mon plan' }
    case 'gratuit':
      return {
        ton: 'vedette',
        titre: 'Plan Gratuit',
        detail: prixEssentiel ? `Plus de produits, des employés, les rapports complets : dès ${fcfa(prixEssentiel)} par mois` : 'Voyez ce que les plans payants ajoutent',
        action: 'Voir les plans',
      }
    default:
      return null
  }
}
