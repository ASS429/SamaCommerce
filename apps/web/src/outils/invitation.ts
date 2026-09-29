/* Invitation d'un employé reçue par lien.
 *
 * Le lien produit par l'API vaut `https://…/?invitation=<jeton>`. Il ne servait
 * à rien : personne ne lisait ce paramètre. L'employé qui cliquait tombait sur
 * l'écran de connexion, le jeton restait dans la barre d'adresse, et il aurait
 * fallu qu'il devine de créer un compte puis d'aller coller le lien dans une
 * petite puce au bas de l'accueil. Le message WhatsApp promettait pourtant
 * « ouvre ce lien → crée ton compte → c'est prêt ».
 *
 * Ici : on récupère le jeton au démarrage, on le met de côté le temps que
 * l'employé crée son compte (l'acceptation exige d'être connecté), et on
 * NETTOIE l'adresse — un jeton d'invitation n'a rien à faire dans une barre
 * d'adresse que l'on partage ou qui se retrouve dans l'historique.
 *
 * Les liens envoyés AVANT la francisation portent `?invite=` : ils restent
 * reconnus, sinon un employé invité la veille resterait à la porte.
 */

const CLE = 'samacommerce_invitation'
/** Nom du paramètre d'adresse, suivi de l'ancien (liens déjà partagés). */
const PARAMETRES = ['invitation', 'invite'] as const

/**
 * Jeton contenu dans un lien, un fragment de lien, ou collé seul.
 * Tolérant au copier-coller depuis WhatsApp (espaces, paramètres en trop).
 */
export function extraireJetonInvitation(brut: string): string {
  const s = String(brut ?? '').trim()
  if (!s) return ''
  const m = s.match(/(?:^|[?&#])(?:invitation|invite)=([^&#\s]+)/)
  if (m) return decodeURIComponent(m[1])
  // Collé sans son enrobage : on garde le premier bloc, sans queue de paramètres.
  return s.split(/[&#\s]/)[0]
}

/**
 * Lit `?invitation=` (ou l'ancien `?invite=`) dans l'adresse, le met de côté et
 * retire le paramètre.
 * @returns le jeton en attente (celui de l'adresse, sinon celui déjà stocké).
 */
export function capturerInvitationDepuisAdresse(): string | null {
  try {
    const adresse = new URL(window.location.href)
    const parametre = PARAMETRES.find((p) => adresse.searchParams.get(p))
    if (!parametre) return invitationEnAttente()

    const jeton = extraireJetonInvitation(adresse.searchParams.get(parametre) || '')
    if (jeton) localStorage.setItem(CLE, jeton)
    PARAMETRES.forEach((p) => adresse.searchParams.delete(p))
    window.history.replaceState({}, '', adresse.pathname + adresse.search + adresse.hash)
    return jeton || null
  } catch {
    return null // navigation privée : l'invitation se collera à la main
  }
}

/** Jeton en attente d'acceptation, s'il y en a un. */
export function invitationEnAttente(): string | null {
  try { return localStorage.getItem(CLE) || null } catch { return null }
}

/** Oublie l'invitation (acceptée, ou définitivement refusée par le serveur). */
export function oublierInvitation(): void {
  try { localStorage.removeItem(CLE) } catch { /* navigation privée */ }
}
