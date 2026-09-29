/* Jeton refusé par le serveur → l'application doit REVENIR à la connexion.
 *
 * Régression vécue en production : après une longue absence le jeton expirait,
 * mais il restait en localStorage. `connecte = !!lireJeton()` valait donc
 * `true`, l'interface complète s'affichait, et chaque appel repartait en 401
 * avalé silencieusement (les sections chargeaient en `.then(definirX)` sans
 * `.catch`) → tous les écrans vides, aucun message. L'utilisateur a cru sa base
 * effacée.
 *
 * On pilote l'adaptateur d'axios plutôt que d'ajouter une dépendance de
 * simulation : le trajet testé est exactement celui de production
 * (validateStatus rejette, l'intercepteur de réponse voit l'erreur). */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, lireJeton, EVENEMENT_SESSION_EXPIREE } from './api'

/** Fait répondre l'API avec ce statut HTTP.
 *  Un adaptateur doit REJETER lui-même hors 2xx : c'est le rôle de `settle`
 *  dans l'adaptateur natif, et c'est cette erreur que voit l'intercepteur. */
function repondre(statut: number) {
  api.defaults.adapter = async (requete) => {
    const reponse = { data: {}, status: statut, statusText: '', headers: {}, config: requete }
    if (statut >= 200 && statut < 300) return reponse
    const erreur = Object.assign(new Error(`Request failed with status code ${statut}`), {
      isAxiosError: true, config: requete, response: reponse,
    })
    throw erreur
  }
}
/** Simule une coupure réseau : aucune réponse du serveur. */
function reseauCoupe() {
  api.defaults.adapter = async () => { throw new Error('Network Error') }
}

/** Exécute une requête et capture l'événement de session expirée. */
async function executer(appel: () => Promise<unknown>) {
  const surExpiration = vi.fn()
  window.addEventListener(EVENEMENT_SESSION_EXPIREE, surExpiration)
  await expect(appel()).rejects.toBeTruthy()
  window.removeEventListener(EVENEMENT_SESSION_EXPIREE, surExpiration)
  return surExpiration
}

describe('session expirée', () => {
  beforeEach(() => {
    localStorage.setItem('samacommerce_jeton', 'jeton-perime')
    localStorage.setItem('samacommerce_utilisateur', JSON.stringify({ id: 1 }))
  })

  it('purge la session et prévient l\'application sur un 401', async () => {
    repondre(401)
    const surExpiration = await executer(() => api.get('/produits'))

    expect(lireJeton()).toBeNull()                 // le jeton mort est retiré
    expect(surExpiration).toHaveBeenCalledTimes(1) // l'application peut réafficher la connexion
  })

  it('ne déconnecte PAS sur un mot de passe refusé', async () => {
    repondre(401)
    const surExpiration = await executer(() => api.post('/auth/connexion', {}))

    expect(lireJeton()).toBe('jeton-perime')  // la session en cours est préservée
    expect(surExpiration).not.toHaveBeenCalled()
  })

  it('ne déconnecte PAS quand le réseau est coupé', async () => {
    reseauCoupe()
    const surExpiration = await executer(() => api.get('/produits'))

    // Hors ligne, la file d'attente doit pouvoir rejouer les ventes au retour
    // du réseau : purger le jeton ferait perdre les ventes non synchronisées.
    expect(lireJeton()).toBe('jeton-perime')
    expect(surExpiration).not.toHaveBeenCalled()
  })

  it('ne déconnecte pas sur une panne serveur (500)', async () => {
    repondre(500)
    const surExpiration = await executer(() => api.get('/produits'))

    expect(lireJeton()).toBe('jeton-perime')
    expect(surExpiration).not.toHaveBeenCalled()
  })
})
