import { describe, it, expect, beforeEach } from 'vitest'
import {
  SECTIONS_MASQUABLES, sectionsMasquees, sectionVisible, afficherSection, toutAfficher,
  impressionAutoActive, definirImpressionAuto, EVENEMENT_SECTIONS, appliquerReglagesDuServeur, effacerReglagesLocaux,
} from './modules'
import { dateFr } from './api'

beforeEach(() => localStorage.clear())

describe('sections activables', () => {
  it('affiche tout par défaut', () => {
    expect(sectionsMasquees()).toEqual([])
    for (const s of SECTIONS_MASQUABLES) expect(sectionVisible(s.ecran)).toBe(true)
  })

  it('masque puis réaffiche une section', () => {
    afficherSection('caisse', false)
    expect(sectionVisible('caisse')).toBe(false)
    expect(sectionVisible('vente')).toBe(true) // les autres ne bougent pas

    afficherSection('caisse', true)
    expect(sectionVisible('caisse')).toBe(true)
  })

  it('garde Accueil et Paramètres toujours accessibles', () => {
    afficherSection('accueil', false)
    afficherSection('profil', false)
    expect(sectionVisible('accueil')).toBe(true)
    expect(sectionVisible('profil')).toBe(true)
  })

  it('enregistre les sections MASQUÉES, pour qu\'une future section soit visible par défaut', () => {
    afficherSection('caisse', false)
    // On simule une section inconnue au moment du réglage.
    expect(sectionVisible('livraisons')).toBe(true)
    expect(sectionsMasquees()).toEqual(['caisse'])
  })

  it('ignore un contenu de stockage corrompu', () => {
    localStorage.setItem('samacommerce_sections_masquees', 'pas du json')
    expect(sectionsMasquees()).toEqual([])
    expect(sectionVisible('vente')).toBe(true)
  })

  it('« Tout afficher » réinitialise', () => {
    afficherSection('caisse', false)
    afficherSection('equipe', false)
    toutAfficher()
    expect(sectionsMasquees()).toEqual([])
  })

  it('prévient l\'application à chaque changement', () => {
    let recu = 0
    const surEvenement = () => { recu++ }
    window.addEventListener(EVENEMENT_SECTIONS, surEvenement)
    afficherSection('caisse', false)
    definirImpressionAuto(true)
    window.removeEventListener(EVENEMENT_SECTIONS, surEvenement)
    expect(recu).toBe(2)
  })
})

describe('impression automatique du reçu', () => {
  it('est désactivée par défaut et se bascule', () => {
    expect(impressionAutoActive()).toBe(false)
    definirImpressionAuto(true)
    expect(impressionAutoActive()).toBe(true)
    definirImpressionAuto(false)
    expect(impressionAutoActive()).toBe(false)
  })
})

describe('synchronisation avec le compte', () => {
  it('adopte les réglages du serveur sur un appareil neuf', () => {
    appliquerReglagesDuServeur({ sections_masquees: ['caisse', 'equipe'], impression_auto: true })
    expect(sectionVisible('caisse')).toBe(false)
    expect(sectionVisible('equipe')).toBe(false)
    expect(sectionVisible('vente')).toBe(true)
    expect(impressionAutoActive()).toBe(true)
  })

  it('remplace l\'état local (et ne fusionne pas) : le compte fait foi', () => {
    appliquerReglagesDuServeur({ sections_masquees: ['caisse'] })
    appliquerReglagesDuServeur({ sections_masquees: ['equipe'] })
    expect(sectionVisible('caisse')).toBe(true)
    expect(sectionVisible('equipe')).toBe(false)
  })

  it('ne perd PAS un réglage local pas encore envoyé (modifié hors ligne)', () => {
    afficherSection('caisse', false)                         // pose le drapeau « à envoyer »
    appliquerReglagesDuServeur({ sections_masquees: [] })   // le serveur ignore encore ce choix
    expect(sectionVisible('caisse')).toBe(false)
  })

  it('ignore une charge serveur mal formée', () => {
    afficherSection('caisse', false)
    effacerReglagesLocaux()
    appliquerReglagesDuServeur({ sections_masquees: [42, null, 'equipe'] as unknown as string[] })
    expect(sectionsMasquees()).toEqual(['equipe'])
  })

  it('la déconnexion purge les réglages locaux', () => {
    afficherSection('caisse', false)
    definirImpressionAuto(true)
    effacerReglagesLocaux()
    expect(sectionsMasquees()).toEqual([])
    expect(impressionAutoActive()).toBe(false)
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
