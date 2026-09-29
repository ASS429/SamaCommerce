/* Écrans d'erreur de chargement.
 *
 * POURQUOI. Les sections chargeaient en `.then(definirX)` sans `.catch` : quand
 * un appel échouait, l'état restait un tableau vide et l'utilisateur voyait
 * « Aucun produit ». Impossible de distinguer une boutique VIDE d'une boutique
 * INJOIGNABLE — c'est ce qui a fait croire à une base de données effacée.
 *
 * Une erreur doit donc dire trois choses, et dans cet ordre de lisibilité pour
 * quelqu'un qui déchiffre mal l'écrit :
 *   1. un PICTOGRAMME qui porte le sens (📴 réseau, 🔒 droits, ⚠️ serveur) ;
 *   2. ce qui se passe, en une phrase courte ;
 *   3. quoi faire — et un bouton « Réessayer » à portée de pouce.
 */

import { useCallback, useState } from 'react'

/* Les valeurs servent aussi de suffixe de classe CSS (`teinte-hors-ligne`) :
   d'où les traits d'union. */
export type TypeErreurChargement = 'hors-ligne' | 'injoignable' | 'interdit' | 'introuvable' | 'surcharge' | 'serveur' | 'inconnu'

export type InfosErreurChargement = {
  type: TypeErreurChargement
  icone: string
  titre: string
  conseil: string
}

/**
 * Traduit une erreur d'appel en message affichable.
 *
 * Renvoie `null` pour un 401 : l'intercepteur global purge déjà la session et
 * renvoie à l'écran de connexion. Afficher une erreur ferait clignoter un
 * message alarmant juste avant que l'écran ne change de toute façon.
 */
export function decrireErreur(e: unknown): InfosErreurChargement | null {
  /* PAS D'ERREUR = PAS DE MESSAGE.
   *
   * Ce garde-fou manquait, et le défaut était invisible tant que la fonction
   * n'était appelée que depuis un `.catch` (il y avait donc toujours une
   * erreur). Depuis le passage à react-query on lui passe `query.error`, qui
   * vaut `null` quand tout va bien : sans ce test, `statut` était `undefined`,
   * la branche « aucune réponse du serveur » se déclenchait, et le bandeau
   * « Le serveur ne répond pas » s'affichait EN PERMANENCE par-dessus des
   * données parfaitement chargées. */
  if (e === null || e === undefined) return null

  const statut = (e as { response?: { status?: number } })?.response?.status

  // Aucune réponse du serveur : panne réseau, serveur endormi, DNS…
  if (!statut) {
    return navigator.onLine
      ? { type: 'injoignable', icone: '🔌', titre: 'Le serveur ne répond pas', conseil: 'Il se réveille peut-être. Réessayez dans quelques secondes.' }
      : { type: 'hors-ligne', icone: '📴', titre: 'Vous êtes hors ligne', conseil: 'Vos ventes sont gardées et seront envoyées au retour du réseau.' }
  }

  if (statut === 401) return null // géré globalement : retour à la connexion

  if (statut === 403) {
    return { type: 'interdit', icone: '🔒', titre: 'Accès refusé', conseil: "Demandez cette permission au propriétaire de la boutique." }
  }
  if (statut === 404) {
    return { type: 'introuvable', icone: '🔍', titre: 'Introuvable', conseil: 'Ces données ont peut-être été supprimées.' }
  }
  if (statut === 429) {
    return { type: 'surcharge', icone: '⏳', titre: 'Trop de demandes', conseil: 'Patientez un instant avant de réessayer.' }
  }
  if (statut >= 500) {
    return { type: 'serveur', icone: '⚠️', titre: 'Le serveur a un problème', conseil: 'Ce n\'est pas votre faute. Réessayez dans un instant.' }
  }
  return { type: 'inconnu', icone: '⚠️', titre: 'Chargement impossible', conseil: 'Réessayez, puis vérifiez votre connexion.' }
}

/**
 * Suit les échecs de chargement d'une section.
 *
 * Usage — on enveloppe la promesse, le reste du code ne bouge pas :
 *   const { erreur, surveiller, effacer } = useErreurChargement()
 *   const charger = () => {
 *     effacer()
 *     surveiller(Produits.lister().then(definirProduits)).finally(() => definirChargement(false))
 *   }
 *
 * `surveiller` et `effacer` sont enveloppés dans useCallback([]) : leur
 * identité ne change JAMAIS. Les `eslint-disable-line react-hooks/exhaustive-deps`
 * posés sur les `useEffect(() => { charger() }, [])` des sections sont donc
 * sûrs — le linter ne sait pas voir cette stabilité à travers la frontière du
 * hook.
 */
export function useErreurChargement() {
  const [erreur, definirErreur] = useState<InfosErreurChargement | null>(null)

  const effacer = useCallback(() => definirErreur(null), [])

  const surveiller = useCallback(<T,>(p: Promise<T>): Promise<T | undefined> => p.catch((e) => {
    const infos = decrireErreur(e)
    // On garde la PREMIÈRE erreur : quand une section lance trois appels, le
    // premier échec explique en général les suivants.
    if (infos) definirErreur((precedente) => precedente ?? infos)
    return undefined
  }), [])

  return { erreur, surveiller, effacer }
}
