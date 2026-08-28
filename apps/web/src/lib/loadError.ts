/* Écrans d'erreur de chargement.
 *
 * POURQUOI. Les sections chargeaient en `.then(setX)` sans `.catch` : quand un
 * appel échouait, l'état restait un tableau vide et l'utilisateur voyait
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

export type LoadErrorKind = 'offline' | 'unreachable' | 'forbidden' | 'notfound' | 'busy' | 'server' | 'unknown'

export type LoadErrorInfo = {
  kind: LoadErrorKind
  icon: string
  title: string
  hint: string
}

/**
 * Traduit une erreur d'appel en message affichable.
 *
 * Renvoie `null` pour un 401 : l'intercepteur global purge déjà la session et
 * renvoie à l'écran de connexion. Afficher une erreur ferait clignoter un
 * message alarmant juste avant que l'écran ne change de toute façon.
 */
export function describeError(e: unknown): LoadErrorInfo | null {
  /* PAS D'ERREUR = PAS DE MESSAGE.
   *
   * Ce garde-fou manquait, et le defaut etait invisible tant que la fonction
   * n'etait appelee que depuis un `.catch` (il y avait donc toujours une
   * erreur). Depuis le passage a react-query on lui passe `query.error`, qui
   * vaut `null` quand tout va bien : sans ce test, `status` etait `undefined`,
   * la branche « aucune reponse du serveur » se declenchait, et le bandeau
   * « Le serveur ne repond pas » s'affichait EN PERMANENCE par-dessus des
   * donnees parfaitement chargees. */
  if (e === null || e === undefined) return null

  const status = (e as { response?: { status?: number } })?.response?.status

  // Aucune réponse du serveur : panne réseau, serveur endormi, DNS…
  if (!status) {
    return navigator.onLine
      ? { kind: 'unreachable', icon: '🔌', title: 'Le serveur ne répond pas', hint: 'Il se réveille peut-être. Réessayez dans quelques secondes.' }
      : { kind: 'offline', icon: '📴', title: 'Vous êtes hors ligne', hint: 'Vos ventes sont gardées et seront envoyées au retour du réseau.' }
  }

  if (status === 401) return null // géré globalement : retour à la connexion

  if (status === 403) {
    return { kind: 'forbidden', icon: '🔒', title: 'Accès refusé', hint: "Demandez cette permission au propriétaire de la boutique." }
  }
  if (status === 404) {
    return { kind: 'notfound', icon: '🔍', title: 'Introuvable', hint: 'Ces données ont peut-être été supprimées.' }
  }
  if (status === 429) {
    return { kind: 'busy', icon: '⏳', title: 'Trop de demandes', hint: 'Patientez un instant avant de réessayer.' }
  }
  if (status >= 500) {
    return { kind: 'server', icon: '⚠️', title: 'Le serveur a un problème', hint: 'Ce n\'est pas votre faute. Réessayez dans un instant.' }
  }
  return { kind: 'unknown', icon: '⚠️', title: 'Chargement impossible', hint: 'Réessayez, puis vérifiez votre connexion.' }
}

/**
 * Suit les échecs de chargement d'une section.
 *
 * Usage — on enveloppe la promesse, le reste du code ne bouge pas :
 *   const { error, watch, reset } = useLoadError()
 *   const load = () => {
 *     reset()
 *     watch(Products.list().then(setProducts)).finally(() => setLoading(false))
 *   }
 *
 * `watch` et `reset` sont enveloppés dans useCallback([]) : leur identité ne
 * change JAMAIS. Les `eslint-disable-line react-hooks/exhaustive-deps` posés
 * sur les `useEffect(() => { load() }, [])` des sections sont donc sûrs — le
 * linter ne sait pas voir cette stabilité à travers la frontière du hook.
 */
export function useLoadError() {
  const [error, setError] = useState<LoadErrorInfo | null>(null)

  const reset = useCallback(() => setError(null), [])

  const watch = useCallback(<T,>(p: Promise<T>): Promise<T | undefined> => p.catch((e) => {
    const info = describeError(e)
    // On garde la PREMIÈRE erreur : quand une section lance trois appels, le
    // premier échec explique en général les suivants.
    if (info) setError((prev) => prev ?? info)
    return undefined
  }), [])

  return { error, watch, reset }
}
