/* Le geste du bouton vocal, copié sur WhatsApp : c'est celui que tous les
   commerçants connaissent, même ceux qui ne lisent pas.

   - un simple toucher        → une info-bulle explique le geste ;
   - maintenir                → enregistre ; relâcher → envoie ;
   - glisser vers la gauche   → annule (un geste vif suffit, comme une page qu'on tourne) ;
   - glisser vers le haut     → verrouille : on peut lâcher le bouton et parler mains libres.

   Les décisions sont des fonctions pures, testées sans navigateur. */

/** Distance vers la gauche qui annule l'enregistrement (px). */
export const SEUIL_ANNULER = 120
/** Distance vers le haut qui verrouille l'enregistrement (px). */
export const SEUIL_VERROUILLER = 90
/** Un appui plus court est un simple toucher : on explique le geste au lieu d'envoyer un souffle. */
export const APPUI_COURT_MS = 450
/** Vitesse (px/ms) d'un geste vif vers la gauche, qui annule avant le seuil. */
export const VITESSE_ANNULER = 0.8
/** En dessous de cette distance, même un geste vif n'est qu'un tremblement du doigt. */
const DISTANCE_MIN_GESTE_VIF = 40

export type DecisionGeste = 'continuer' | 'annuler' | 'verrouiller'

/**
 * @param dx déplacement horizontal depuis l'appui (négatif = vers la gauche)
 * @param dy déplacement vertical depuis l'appui (négatif = vers le haut)
 * @param vitesseX vitesse horizontale récente en px/ms (négative = vers la gauche)
 */
export function deciderGeste(dx: number, dy: number, vitesseX = 0): DecisionGeste {
  if (dx <= -SEUIL_ANNULER) return 'annuler'
  if (dx <= -DISTANCE_MIN_GESTE_VIF && vitesseX <= -VITESSE_ANNULER) return 'annuler'
  // Le verrou ne se prend qu'en montant franchement : un doigt qui glisse en
  // diagonale vers la gauche veut annuler, pas verrouiller.
  if (dy <= -SEUIL_VERROUILLER && Math.abs(dx) < SEUIL_VERROUILLER) return 'verrouiller'
  return 'continuer'
}

/** Le bouton suit le doigt, mais seulement vers la gauche ou vers le haut, et sur un seul axe à la fois. */
export function suivreDoigt(dx: number, dy: number): { x: number; y: number } {
  const x = Math.min(0, dx)
  const y = Math.min(0, dy)
  return Math.abs(x) >= Math.abs(y) ? { x, y: 0 } : { x: 0, y }
}

export function estAppuiCourt(dureeMs: number): boolean {
  return dureeMs < APPUI_COURT_MS
}

/** « 0:07 », « 1:02 » : la durée telle que l'affiche WhatsApp. */
export function formaterDuree(secondes: number): string {
  const total = Math.max(0, Math.floor(secondes))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
