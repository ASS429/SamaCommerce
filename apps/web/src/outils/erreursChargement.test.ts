/* Classification des échecs de chargement.
 *
 * L'enjeu n'est pas cosmétique : « Aucun produit » et « je n'ai pas pu lire vos
 * produits » se ressemblaient à l'écran, alors qu'ils appellent deux réactions
 * opposées — ajouter un article, ou réessayer. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { decrireErreur } from './erreursChargement'

/** Erreur telle qu'axios la produit pour un statut HTTP donné. */
const erreurHttp = (statut: number) => ({ response: { status: statut } })

afterEach(() => vi.unstubAllGlobals())

describe('decrireErreur', () => {
  it("ne dit RIEN quand il n'y a pas d'erreur", () => {
    /* Le défaut qui a fait croire à une panne en production : react-query passe
       `query.error`, qui vaut null quand tout va bien. Sans ce cas, la branche
       « aucune réponse » se déclenchait et le bandeau « Le serveur ne répond
       pas » restait affiché par-dessus des données correctes. */
    expect(decrireErreur(null)).toBeNull()
    expect(decrireErreur(undefined)).toBeNull()
  })

  it('reste MUET sur un 401 : la session expirée est gérée globalement', () => {
    // Afficher une erreur ferait clignoter un message alarmant juste avant que
    // l'application ne bascule d'elle-même sur l'écran de connexion.
    expect(decrireErreur(erreurHttp(401))).toBeNull()
  })

  it('distingue « hors ligne » de « serveur muet »', () => {
    vi.stubGlobal('navigator', { onLine: false })
    expect(decrireErreur(new Error('Network Error'))?.type).toBe('hors-ligne')

    vi.stubGlobal('navigator', { onLine: true })
    expect(decrireErreur(new Error('Network Error'))?.type).toBe('injoignable')
  })

  it('rassure quand la panne vient du serveur', () => {
    const infos = decrireErreur(erreurHttp(500))
    expect(infos?.type).toBe('serveur')
    // Le message doit dédouaner l'utilisateur : il n'a rien cassé.
    expect(infos?.conseil).toContain('pas votre faute')
  })

  it('oriente vers le propriétaire sur un refus de droits', () => {
    const infos = decrireErreur(erreurHttp(403))
    expect(infos?.type).toBe('interdit')
    expect(infos?.icone).toBe('🔒')
  })

  it('porte toujours un pictogramme et une action', () => {
    // Contrainte produit : l'utilisateur peut ne pas savoir lire.
    for (const statut of [403, 404, 429, 500, 418]) {
      const infos = decrireErreur(erreurHttp(statut))
      expect(infos).not.toBeNull()
      expect(infos!.icone).not.toBe('')
      expect(infos!.titre.length).toBeGreaterThan(0)
      expect(infos!.conseil.length).toBeGreaterThan(0)
    }
  })
})
