/* Abonnement : ce que l'écran dit au commerçant, à partir de l'état calculé
 * par le serveur (jamais d'après ce que le navigateur croit savoir).
 *
 * Fonctions pures, testées à part (abonnement.test.ts) : le texte d'un bandeau
 * d'échéance qui ment (« expire demain » alors que c'est aujourd'hui) fait
 * perdre un client plus sûrement qu'un bouton mal placé. */

import { fcfa, type CleLimite, type EtatAbonnement, type PlanPublic } from './api'

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** « 2026-11-01 » → « 1er novembre 2026 ». Date seule, sans fuseau : pas de décalage d'un jour. */
export function dateLongue(iso: string | null | undefined, avecAnnee = true): string {
  if (!iso) return ''
  const [annee, mois, jour] = iso.slice(0, 10).split('-').map(Number)
  if (!annee || !mois || !jour) return ''
  return `${jour === 1 ? '1er' : jour} ${MOIS[mois - 1]}${avecAnnee ? ' ' + annee : ''}`
}

/** « aujourd'hui », « demain », « dans 4 jours ». */
export function delai(jours: number | null | undefined): string {
  if (jours === null || jours === undefined) return ''
  if (jours <= 0) return "aujourd'hui"
  if (jours === 1) return 'demain'
  return `dans ${jours} jours`
}

export type Periode = 'mois' | 'an'

/** Prix de la période, ou null pour un plan sur devis. */
export function prixPeriode(plan: PlanPublic, periode: Periode): number | null {
  if (plan.sur_devis) return null
  return periode === 'an' ? plan.prix_annuel : plan.prix_mensuel
}

/** Prix mensuel équivalent d'un paiement à l'année (25 000 F → 2 083 F). */
export function equivalentMensuel(plan: PlanPublic): number | null {
  return plan.prix_annuel ? Math.round(plan.prix_annuel / 12) : null
}

export type TonEtat = 'essai' | 'paye' | 'grace' | 'gratuit'

/** Bandeau d'état de « Mon plan » : un titre, une phrase, un ton. */
export function texteEtat(etat: EtatAbonnement, plans: PlanPublic[]): { titre: string; detail: string; ton: TonEtat } {
  const nom = (code: string | null) => plans.find((p) => p.code === code)?.nom ?? ''

  if (etat.source === 'essai') {
    const quand = delai(etat.jours_restants)
    return {
      ton: 'essai',
      titre: etat.jours_restants !== null && etat.jours_restants <= 0
        ? `Votre essai ${etat.plan.nom} se termine aujourd'hui`
        : `Votre essai ${etat.plan.nom} se termine ${quand}`,
      detail: 'Ensuite, vous passez au plan Gratuit. Vos ventes, vos produits et vos clients restent à vous.',
    }
  }
  if (etat.source === 'paye') {
    return {
      ton: 'paye',
      titre: `Plan ${etat.plan.nom} jusqu'au ${dateLongue(etat.fin_le)}`,
      detail: 'Renouvelez quand vous voulez : la nouvelle période commence à la suite, aucun jour n’est perdu.',
    }
  }
  if (etat.source === 'grace') {
    return {
      ton: 'grace',
      titre: `Votre plan ${etat.plan.nom} a expiré le ${dateLongue(etat.fin_le)}`,
      detail: `Tout fonctionne encore jusqu'au ${dateLongue(etat.grace_jusqu_au)}. Renouvelez avant cette date pour garder toutes vos fonctions.`,
    }
  }
  return {
    ton: 'gratuit',
    titre: 'Vous êtes au plan Gratuit',
    detail: etat.plan_expire
      ? `Votre plan ${nom(etat.plan_expire)} a pris fin le ${dateLongue(etat.expire_le)}. Vos données sont toutes là.`
      : 'Ventes, stock, caisse et carnet de crédit, sans rien payer.',
  }
}

/** Ce qui compte pour un commerçant, dans l'ordre où il y pense. */
export const LIBELLES_LIMITES: Record<CleLimite, string> = {
  produits: 'Produits',
  boutiques: 'Boutiques',
  employes: 'Employés',
  ia: 'Conseils IA ce mois',
}

/** « 97 sur 100 », « 1 240 » (illimité), « Patron seul » (aucun employé permis). */
export function texteUtilisation(cle: CleLimite, utilise: number, limite: number | null): string {
  if (cle === 'employes' && limite === 0) return 'Patron seul'
  const nombre = new Intl.NumberFormat('fr-FR').format(utilise)
  return limite === null ? nombre : `${nombre} sur ${new Intl.NumberFormat('fr-FR').format(limite)}`
}

/** Proche de la limite (90 % et plus) : le moment de proposer le plan suivant. */
export function presDeLaLimite(utilise: number, limite: number | null): boolean {
  return limite !== null && limite > 0 && utilise / limite >= 0.9
}

/* Fonctionnalités réservables, regroupées comme un commerçant les pense. */
const FONCTIONS_EN_MOTS: [string[], string][] = [
  [['rapports_complets', 'exports'], 'Rapports complets, exports PDF et Excel'],
  [['fournisseurs_commandes', 'inventaire_retours'], 'Fournisseurs, commandes et inventaire'],
  [['relances_whatsapp'], 'Relances de crédit par WhatsApp'],
  [['livraisons', 'journal_activite'], 'Livraisons et journal d’activité'],
  [['assistant_vocal'], 'Assistant vocal : vos questions en wolof ou en français'],
  [['accompagnement'], 'Installation et formation sur place'],
]

const nombre = (n: number) => new Intl.NumberFormat('fr-FR').format(n)

/**
 * Ce qu'un plan apporte EN PLUS du précédent, en mots de commerçant.
 *
 * Déduit des limites et fonctionnalités que l'administrateur règle : une liste
 * écrite en dur mentirait le jour où il passe Essentiel à 3 employés. Le
 * premier élément rappelle le plan précédent (« Tout le plan Essentiel »).
 */
export function atoutsDuPlan(plan: PlanPublic, precedent?: PlanPublic | null): string[] {
  const atouts: string[] = []
  if (precedent && precedent.code !== 'gratuit') atouts.push(`Tout le plan ${precedent.nom}`)
  const L = plan.limites
  const differe = (cle: CleLimite) => !precedent || L[cle] !== precedent.limites[cle]

  if (differe('produits')) atouts.push(L.produits === null ? 'Produits illimités' : `Jusqu’à ${nombre(L.produits)} produits`)
  if (differe('employes')) {
    atouts.push(L.employes === null ? 'Employés illimités, chacun avec ses droits'
      : L.employes === 0 ? 'Vous seul, sans employé'
        : `${L.employes} employé${L.employes > 1 ? 's' : ''} en plus de vous`)
  }
  if (differe('boutiques')) {
    atouts.push(L.boutiques === null ? 'Boutiques illimitées'
      : L.boutiques === 1 ? 'Une boutique'
        : `Jusqu’à ${L.boutiques} boutiques${plan.fonctionnalites.includes('tableau_boutiques') ? ', suivies ensemble' : ''}`)
  }
  if (differe('ia')) {
    atouts.push(L.ia === null ? 'Conseils de l’IA sans limite : quoi racheter, à qui faire crédit'
      : `${nombre(L.ia)} conseils de l’IA par mois`)
  }
  for (const [codes, libelle] of FONCTIONS_EN_MOTS) {
    const inclus = codes.some((c) => plan.fonctionnalites.includes(c))
    const dejaAvant = !!precedent && codes.some((c) => precedent.fonctionnalites.includes(c))
    if (inclus && !dejaAvant) atouts.push(libelle)
  }
  return atouts
}

/** « Aujourd'hui à 09:42 », « Hier à 18:05 », « le 3 octobre à 10:12 ». */
export function quand(iso: string | null | undefined, maintenant = new Date()): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const heure = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  const jour = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const ecart = Math.round((jour(maintenant) - jour(date)) / 86_400_000)
  if (ecart === 0) return `Aujourd'hui à ${heure}`
  if (ecart === 1) return `Hier à ${heure}`
  return `Le ${date.getDate() === 1 ? '1er' : date.getDate()} ${MOIS[date.getMonth()]} à ${heure}`
}

/** Montant pour l'écran : « 5 000 F ». */
export const montant = (n: number | null | undefined) => (n === null || n === undefined ? '' : fcfa(n))
