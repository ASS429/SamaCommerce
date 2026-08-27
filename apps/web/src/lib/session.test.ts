/* Jeton refusé par le serveur → l'application doit REVENIR à la connexion.
 *
 * Régression vécue en production : après une longue absence le jeton expirait,
 * mais il restait en localStorage. `authed = !!getToken()` valait donc `true`,
 * l'interface complète s'affichait, et chaque appel repartait en 401 avalé
 * silencieusement (les sections chargent en `.then(setX)` sans `.catch`) → tous
 * les écrans vides, aucun message. L'utilisateur a cru sa base effacée.
 *
 * On pilote l'adaptateur d'axios plutôt que d'ajouter une dépendance de mock :
 * le trajet testé est exactement celui de production (validateStatus rejette,
 * l'intercepteur de réponse voit l'erreur). */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, getToken, SESSION_EXPIRED_EVENT } from './api'

/** Fait répondre l'API avec ce statut HTTP.
 *  Un adaptateur doit REJETER lui-même hors 2xx : c'est le rôle de `settle`
 *  dans l'adaptateur natif, et c'est cette erreur que voit l'intercepteur. */
function reply(status: number) {
  api.defaults.adapter = async (config) => {
    const response = { data: {}, status, statusText: '', headers: {}, config }
    if (status >= 200 && status < 300) return response
    const err = Object.assign(new Error(`Request failed with status code ${status}`), {
      isAxiosError: true, config, response,
    })
    throw err
  }
}
/** Simule une coupure réseau : aucune réponse du serveur. */
function networkDown() {
  api.defaults.adapter = async () => { throw new Error('Network Error') }
}

/** Exécute une requête et capture l'événement de session expirée. */
async function run(call: () => Promise<unknown>) {
  const onExpired = vi.fn()
  window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
  await expect(call()).rejects.toBeTruthy()
  window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  return onExpired
}

describe('session expirée', () => {
  beforeEach(() => {
    localStorage.setItem('samacommerce_token', 'jeton-perime')
    localStorage.setItem('samacommerce_user', JSON.stringify({ id: 1 }))
  })

  it('purge la session et prévient l\'application sur un 401', async () => {
    reply(401)
    const onExpired = await run(() => api.get('/products'))

    expect(getToken()).toBeNull()            // le jeton mort est retiré
    expect(onExpired).toHaveBeenCalledTimes(1) // l'app peut réafficher la connexion
  })

  it('ne déconnecte PAS sur un mot de passe refusé', async () => {
    reply(401)
    const onExpired = await run(() => api.post('/auth/login', {}))

    expect(getToken()).toBe('jeton-perime')  // la session en cours est préservée
    expect(onExpired).not.toHaveBeenCalled()
  })

  it('ne déconnecte PAS quand le réseau est coupé', async () => {
    networkDown()
    const onExpired = await run(() => api.get('/products'))

    // Hors ligne, la file d'attente doit pouvoir rejouer les ventes au retour
    // du réseau : purger le jeton ferait perdre les ventes non synchronisées.
    expect(getToken()).toBe('jeton-perime')
    expect(onExpired).not.toHaveBeenCalled()
  })

  it('ne déconnecte pas sur une panne serveur (500)', async () => {
    reply(500)
    const onExpired = await run(() => api.get('/products'))

    expect(getToken()).toBe('jeton-perime')
    expect(onExpired).not.toHaveBeenCalled()
  })
})
