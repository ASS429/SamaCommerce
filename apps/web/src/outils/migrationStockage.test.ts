/* Reprise du stockage de l'ancienne version.
 *
 * Ce que ces tests protègent : le commerçant qui met à jour ne doit RIEN
 * perdre — ni sa session (il serait déconnecté au comptoir), ni son code PIN,
 * ni ses réglages d'écran. Et une valeur illisible ne doit jamais empêcher
 * l'application de démarrer. */

import { beforeEach, describe, expect, it } from 'vitest'
import { migrerStockageLocal } from './migrationStockage'

beforeEach(() => localStorage.clear())

/** Ce qu'une installation de l'ancienne version laisse typiquement derrière elle. */
function installerAncienneVersion() {
  localStorage.setItem('samacommerce_token', '12|jeton-de-session')
  localStorage.setItem('samacommerce_device', 'mobile-a1b2c3d4')
  localStorage.setItem('samacommerce_user', JSON.stringify({
    id: 4, username: 'awa@boutique.sn', company_name: 'Boutique Awa', current_boutique_id: 3,
    phone: '77 111 22 44', role: 'user', plan: 'Free', upgrade_status: 'validé', is_employee: false,
    permissions: null, preferences: { modules_off: ['returns', 'caisse'], auto_print: true },
    boutiques: [{ id: 3, name: 'Boutique Awa', is_primary: true, address: null }],
  }))
  localStorage.setItem('samacommerce_theme', 'dark')
  localStorage.setItem('samacommerce_lang', 'wo')
  localStorage.setItem('samacommerce_invite', 'jeton-invitation')
  localStorage.setItem('samacommerce_onboarded', '1')
  localStorage.setItem('samacommerce_modules_off', JSON.stringify(['returns', 'equipe']))
  localStorage.setItem('samacommerce_autoprint', '1')
  localStorage.setItem('samacommerce_prefs_dirty', '1')
  localStorage.setItem('samacommerce_pin', 'a'.repeat(64))
  localStorage.setItem('samacommerce_pin_delay', '5')
  localStorage.setItem('sc_stock_sort', 'stock-asc')
  localStorage.setItem('sc_notif', '1')
}

describe('reprise du stockage de l\'ancienne version', () => {
  it('garde la session : le commerçant n\'est pas déconnecté par la mise à jour', () => {
    installerAncienneVersion()
    migrerStockageLocal()
    expect(localStorage.getItem('samacommerce_jeton')).toBe('12|jeton-de-session')
    expect(localStorage.getItem('samacommerce_token')).toBeNull()
  })

  it('garde le nom d\'appareil À L\'IDENTIQUE (c\'est le nom du jeton côté serveur)', () => {
    installerAncienneVersion()
    migrerStockageLocal()
    expect(localStorage.getItem('samacommerce_appareil')).toBe('mobile-a1b2c3d4')
  })

  it('garde le code PIN : la caisse reste verrouillable avec le même code', () => {
    installerAncienneVersion()
    migrerStockageLocal()
    expect(localStorage.getItem('samacommerce_code_pin')).toBe('a'.repeat(64))
    expect(localStorage.getItem('samacommerce_delai_verrou')).toBe('5')
  })

  it('traduit l\'utilisateur mémorisé, jusque dans ses réglages et ses boutiques', () => {
    installerAncienneVersion()
    migrerStockageLocal()
    const u = JSON.parse(localStorage.getItem('samacommerce_utilisateur')!)
    expect(u).toMatchObject({
      identifiant: 'awa@boutique.sn', nom_commerce: 'Boutique Awa', boutique_active_id: 3,
      telephone: '77 111 22 44', role: 'commercant', plan: 'Gratuit', est_employe: false,
      preferences: { sections_masquees: ['retours', 'caisse'], impression_auto: true },
    })
    expect(u.boutiques[0]).toEqual({ id: 3, nom: 'Boutique Awa', est_principale: true, adresse: null })
    expect(u.username).toBeUndefined()
  })

  it('traduit les valeurs : thème, sections masquées, tri du stock', () => {
    installerAncienneVersion()
    migrerStockageLocal()
    expect(localStorage.getItem('samacommerce_theme')).toBe('sombre')
    expect(JSON.parse(localStorage.getItem('samacommerce_sections_masquees')!)).toEqual(['retours', 'equipe'])
    expect(localStorage.getItem('samacommerce_tri_stock')).toBe('stock-croissant')
  })

  it('reprend tous les autres réglages sous leur nouveau nom', () => {
    installerAncienneVersion()
    migrerStockageLocal()
    expect(localStorage.getItem('samacommerce_langue')).toBe('wo')
    expect(localStorage.getItem('samacommerce_invitation')).toBe('jeton-invitation')
    expect(localStorage.getItem('samacommerce_premiers_pas_vus')).toBe('1')
    expect(localStorage.getItem('samacommerce_impression_auto')).toBe('1')
    expect(localStorage.getItem('samacommerce_reglages_a_envoyer')).toBe('1')
    expect(localStorage.getItem('samacommerce_notifications')).toBe('1')
  })

  it('ne laisse AUCUNE ancienne clé derrière elle', () => {
    installerAncienneVersion()
    migrerStockageLocal()
    const restantes = Object.keys(localStorage).filter((c) =>
      !['samacommerce_theme'].includes(c) && !/^samacommerce_(jeton|utilisateur|appareil|langue|invitation|premiers_pas_vus|sections_masquees|impression_auto|reglages_a_envoyer|code_pin|delai_verrou|tri_stock|notifications)$/.test(c))
    expect(restantes).toEqual([])
  })

  /* Après une déconnexion, l'ancienne clé ne doit pas ressusciter la session :
     elle a été effacée au premier lancement. Relancer la reprise ne fait rien. */
  it('ne fait rien au lancement suivant', () => {
    installerAncienneVersion()
    migrerStockageLocal()
    localStorage.removeItem('samacommerce_jeton') // déconnexion
    expect(migrerStockageLocal()).toBe(0)
    expect(localStorage.getItem('samacommerce_jeton')).toBeNull()
  })

  it('laisse primer une valeur déjà écrite par la nouvelle version', () => {
    localStorage.setItem('samacommerce_token', 'ancien-jeton')
    localStorage.setItem('samacommerce_jeton', 'jeton-recent')
    migrerStockageLocal()
    expect(localStorage.getItem('samacommerce_jeton')).toBe('jeton-recent')
    expect(localStorage.getItem('samacommerce_token')).toBeNull()
  })

  it('ne plante pas sur une valeur illisible, et démarre quand même', () => {
    localStorage.setItem('samacommerce_user', '{pas du json')
    localStorage.setItem('samacommerce_modules_off', 'pas du json non plus')
    localStorage.setItem('samacommerce_token', 'jeton')
    expect(() => migrerStockageLocal()).not.toThrow()
    expect(localStorage.getItem('samacommerce_jeton')).toBe('jeton')
    expect(localStorage.getItem('samacommerce_utilisateur')).toBeNull()
  })

  it('ne touche à rien sur une installation neuve', () => {
    expect(migrerStockageLocal()).toBe(0)
    expect(localStorage.length).toBe(0)
  })
})
