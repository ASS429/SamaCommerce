/* Remontée des erreurs du navigateur vers le serveur.
 *
 * POURQUOI. Quand l'application casse chez un commerçant, personne ne le sait :
 * il referme et n'en parle pas. Le bug des « écrans vides » a mis un mois à
 * être découvert, et seulement parce que le propriétaire du projet l'a vu
 * lui-même.
 *
 * POURQUOI PAS LE SDK NAVIGATEUR DE SENTRY. Il pèse ~30 Ko compressés, soit
 * près d'un quart du paquet, pour des utilisateurs dont la data mobile est
 * chère. On envoie donc l'erreur au serveur (~1 Ko de code ici), et c'est LUI
 * qui la transmet à Sentry : un seul canal d'alerte, et les erreurs d'API sont
 * déjà capturées côté serveur de toute façon.
 *
 * Règles de prudence, dans l'ordre d'importance :
 *  1. ne JAMAIS casser l'application en essayant de signaler qu'elle est cassée ;
 *  2. ne pas boucler (une erreur pendant l'envoi ne doit pas déclencher un envoi) ;
 *  3. ne pas inonder (dédoublonnage + plafond par session) ;
 *  4. `fetch` brut et non axios : un intercepteur fautif rendrait la boucle certaine.
 */

/** Au-delà, on se tait : mieux vaut manquer une erreur que noyer le serveur. */
const MAX_PAR_SESSION = 5
/** Un même bug déclenché 200 fois ne doit être signalé qu'une seule fois. */
const dejaVues = new Set<string>()
let envoyees = 0
let enCours = false

type Signalement = {
  message: string
  pile?: string
  source?: string
  url: string
  type: 'erreur' | 'promesse_rejetee' | 'react'
}

const tronquer = (s: unknown, max: number) => String(s ?? '').slice(0, max)

/** Empreinte servant au dédoublonnage : message + première ligne de pile. */
function empreinte(s: Signalement): string {
  return s.message + '|' + (s.pile || '').split('\n')[1]
}

/** Envoi « au mieux » : aucune erreur d'envoi ne doit remonter à l'appelant. */
export function signalerErreur(s: Signalement): void {
  try {
    if (envoyees >= MAX_PAR_SESSION || enCours) return
    const cle = empreinte(s)
    if (dejaVues.has(cle)) return
    dejaVues.add(cle)
    envoyees++

    enCours = true
    const base = import.meta.env.VITE_URL_API || '/api'
    // keepalive : l'envoi survit à la fermeture de l'onglet, fréquente juste
    // après un plantage.
    fetch(`${base}/erreurs-navigateur`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        message: tronquer(s.message, 500),
        pile: tronquer(s.pile, 3000),
        source: tronquer(s.source, 300),
        url: tronquer(s.url, 300),
        type: s.type,
      }),
    }).catch(() => {}).finally(() => { enCours = false })
  } catch {
    enCours = false // le signalement ne doit jamais faire tomber l'application
  }
}

/** Branche les gardes globaux. À appeler une fois, au démarrage. */
export function installerRapporteurErreurs(): void {
  window.addEventListener('error', (e) => {
    // Les erreurs de chargement de ressource (<img>, <script>) n'ont pas
    // d'objet Error : elles ne nous apprennent rien d'exploitable.
    if (!e.error && !e.message) return
    signalerErreur({
      message: e.message || String(e.error),
      pile: e.error?.stack,
      source: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined,
      url: location.pathname,
      type: 'erreur',
    })
  })

  window.addEventListener('unhandledrejection', (e) => {
    const raison = e.reason
    // Un échec réseau d'axios n'est pas un bug de l'application : il est déjà
    // montré à l'utilisateur par les états d'erreur des sections.
    if (raison?.isAxiosError) return
    signalerErreur({
      message: raison?.message || String(raison),
      pile: raison?.stack,
      url: location.pathname,
      type: 'promesse_rejetee',
    })
  })
}

/** Remise à zéro — tests uniquement. */
export function _reinitialiserRapporteur(): void {
  dejaVues.clear()
  envoyees = 0
  enCours = false
}
