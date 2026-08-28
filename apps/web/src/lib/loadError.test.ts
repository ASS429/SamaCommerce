/* Classification des échecs de chargement.
 *
 * L'enjeu n'est pas cosmétique : « Aucun produit » et « je n'ai pas pu lire vos
 * produits » se ressemblaient à l'écran, alors qu'ils appellent deux réactions
 * opposées — ajouter un article, ou réessayer. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { describeError } from './loadError'

/** Erreur telle qu'axios la produit pour un statut HTTP donné. */
const httpError = (status: number) => ({ response: { status } })

afterEach(() => vi.unstubAllGlobals())

describe('describeError', () => {
  it("ne dit RIEN quand il n'y a pas d'erreur", () => {
    /* Le defaut qui a fait croire a une panne en production : react-query passe
       `query.error`, qui vaut null quand tout va bien. Sans ce cas, la branche
       « aucune reponse » se declenchait et le bandeau « Le serveur ne repond
       pas » restait affiche par-dessus des donnees correctes. */
    expect(describeError(null)).toBeNull()
    expect(describeError(undefined)).toBeNull()
  })

  it('reste MUET sur un 401 : la session expirée est gérée globalement', () => {
    // Afficher une erreur ferait clignoter un message alarmant juste avant que
    // l'app ne bascule d'elle-même sur l'écran de connexion.
    expect(describeError(httpError(401))).toBeNull()
  })

  it('distingue « hors ligne » de « serveur muet »', () => {
    vi.stubGlobal('navigator', { onLine: false })
    expect(describeError(new Error('Network Error'))?.kind).toBe('offline')

    vi.stubGlobal('navigator', { onLine: true })
    expect(describeError(new Error('Network Error'))?.kind).toBe('unreachable')
  })

  it('rassure quand la panne vient du serveur', () => {
    const info = describeError(httpError(500))
    expect(info?.kind).toBe('server')
    // Le message doit dédouaner l'utilisateur : il n'a rien cassé.
    expect(info?.hint).toContain('pas votre faute')
  })

  it('oriente vers le propriétaire sur un refus de droits', () => {
    const info = describeError(httpError(403))
    expect(info?.kind).toBe('forbidden')
    expect(info?.icon).toBe('🔒')
  })

  it('porte toujours un pictogramme et une action', () => {
    // Contrainte produit : l'utilisateur peut ne pas savoir lire.
    for (const status of [403, 404, 429, 500, 418]) {
      const info = describeError(httpError(status))
      expect(info).not.toBeNull()
      expect(info!.icon).not.toBe('')
      expect(info!.title.length).toBeGreaterThan(0)
      expect(info!.hint.length).toBeGreaterThan(0)
    }
  })
})
