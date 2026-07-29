import { describe, it, expect, beforeEach } from 'vitest'
import {
  TOGGLEABLE, getDisabled, isModuleEnabled, setModuleEnabled, resetModules,
  autoPrintEnabled, setAutoPrint, MODULES_EVENT, hydrateFromServer, clearLocalPreferences,
} from './modules'
import { dateFr } from './api'

beforeEach(() => localStorage.clear())

describe('sections activables', () => {
  it('affiche tout par défaut', () => {
    expect(getDisabled()).toEqual([])
    for (const m of TOGGLEABLE) expect(isModuleEnabled(m.view)).toBe(true)
  })

  it('masque puis réaffiche une section', () => {
    setModuleEnabled('caisse', false)
    expect(isModuleEnabled('caisse')).toBe(false)
    expect(isModuleEnabled('vente')).toBe(true) // les autres ne bougent pas

    setModuleEnabled('caisse', true)
    expect(isModuleEnabled('caisse')).toBe(true)
  })

  it('garde Accueil et Paramètres toujours accessibles', () => {
    setModuleEnabled('menu', false)
    setModuleEnabled('profil', false)
    expect(isModuleEnabled('menu')).toBe(true)
    expect(isModuleEnabled('profil')).toBe(true)
  })

  it('enregistre les sections MASQUÉES, pour qu\'une future section soit visible par défaut', () => {
    setModuleEnabled('caisse', false)
    // On simule une section inconnue au moment du réglage.
    expect(isModuleEnabled('livraisons')).toBe(true)
    expect(getDisabled()).toEqual(['caisse'])
  })

  it('ignore un contenu de storage corrompu', () => {
    localStorage.setItem('samacommerce_modules_off', 'pas du json')
    expect(getDisabled()).toEqual([])
    expect(isModuleEnabled('vente')).toBe(true)
  })

  it('« Tout afficher » réinitialise', () => {
    setModuleEnabled('caisse', false)
    setModuleEnabled('equipe', false)
    resetModules()
    expect(getDisabled()).toEqual([])
  })

  it('prévient l\'application à chaque changement', () => {
    let recu = 0
    const h = () => { recu++ }
    window.addEventListener(MODULES_EVENT, h)
    setModuleEnabled('caisse', false)
    setAutoPrint(true)
    window.removeEventListener(MODULES_EVENT, h)
    expect(recu).toBe(2)
  })
})

describe('impression automatique du reçu', () => {
  it('est désactivée par défaut et se bascule', () => {
    expect(autoPrintEnabled()).toBe(false)
    setAutoPrint(true)
    expect(autoPrintEnabled()).toBe(true)
    setAutoPrint(false)
    expect(autoPrintEnabled()).toBe(false)
  })
})

describe('synchronisation avec le compte', () => {
  it('adopte les réglages du serveur sur un appareil neuf', () => {
    hydrateFromServer({ modules_off: ['caisse', 'equipe'], auto_print: true })
    expect(isModuleEnabled('caisse')).toBe(false)
    expect(isModuleEnabled('equipe')).toBe(false)
    expect(isModuleEnabled('vente')).toBe(true)
    expect(autoPrintEnabled()).toBe(true)
  })

  it('remplace l\'état local (et ne fusionne pas) : le compte fait foi', () => {
    hydrateFromServer({ modules_off: ['caisse'] })
    hydrateFromServer({ modules_off: ['equipe'] })
    expect(isModuleEnabled('caisse')).toBe(true)
    expect(isModuleEnabled('equipe')).toBe(false)
  })

  it('ne perd PAS un réglage local pas encore envoyé (modifié hors ligne)', () => {
    setModuleEnabled('caisse', false)          // pose le drapeau « dirty »
    hydrateFromServer({ modules_off: [] })     // le serveur ignore encore ce choix
    expect(isModuleEnabled('caisse')).toBe(false)
  })

  it('ignore une charge serveur mal formée', () => {
    setModuleEnabled('caisse', false)
    clearLocalPreferences()
    hydrateFromServer({ modules_off: [42, null, 'equipe'] as unknown as string[] })
    expect(getDisabled()).toEqual(['equipe'])
  })

  it('la déconnexion purge les réglages locaux', () => {
    setModuleEnabled('caisse', false)
    setAutoPrint(true)
    clearLocalPreferences()
    expect(getDisabled()).toEqual([])
    expect(autoPrintEnabled()).toBe(false)
  })
})

describe('dateFr', () => {
  it('rend lisible une date ISO complète de Postgres', () => {
    expect(dateFr('2026-08-01T00:00:00.000000Z')).toBe('01/08/2026')
  })

  it('accepte une date seule', () => {
    expect(dateFr('2026-08-01')).toBe('01/08/2026')
  })

  it('ne décale PAS le jour (une échéance est une date civile, pas un instant)', () => {
    // Avec `new Date(...).toLocaleDateString()`, minuit UTC recule d'un jour à
    // l'ouest de Greenwich : le crédit paraîtrait dû la veille.
    expect(dateFr('2026-01-01T00:00:00.000000Z')).toBe('01/01/2026')
  })

  it('gère l\'absence de date', () => {
    expect(dateFr(null)).toBe('—')
    expect(dateFr('')).toBe('—')
  })
})
