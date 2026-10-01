import { beforeEach, describe, expect, it } from 'vitest'
import { capturerInvitationDepuisAdresse, oublierInvitation, extraireJetonInvitation, invitationEnAttente } from './invitation'

const JETON = 'aZ09'.repeat(12) // 48 caractères, comme Str::random(48)

describe('extraireJetonInvitation — tolérant au copier-coller WhatsApp', () => {
  it('lit le lien complet produit par l\'API', () => {
    expect(extraireJetonInvitation(`https://samacommerce-web.onrender.com/?invitation=${JETON}`)).toBe(JETON)
  })

  it('accepte un jeton collé seul', () => {
    expect(extraireJetonInvitation(JETON)).toBe(JETON)
  })

  it('ignore les paramètres qui suivent', () => {
    expect(extraireJetonInvitation(`https://x.sn/?invitation=${JETON}&utm=whatsapp`)).toBe(JETON)
    expect(extraireJetonInvitation(`https://x.sn/?utm=wa&invitation=${JETON}#haut`)).toBe(JETON)
  })

  /* WhatsApp ajoute volontiers une espace ou un retour à la ligne au collage. */
  it('supporte les espaces autour', () => {
    expect(extraireJetonInvitation(`  https://x.sn/?invitation=${JETON}\n`)).toBe(JETON)
  })

  it('rend une chaîne vide plutôt que de planter', () => {
    expect(extraireJetonInvitation('')).toBe('')
    expect(extraireJetonInvitation('   ')).toBe('')
  })
})

describe('capturerInvitationDepuisAdresse — le lien devient une invitation en attente', () => {
  beforeEach(() => { oublierInvitation() })

  const aller = (adresse: string) => window.history.replaceState({}, '', adresse)

  it('met le jeton de côté et le retire de l\'adresse', () => {
    aller(`/?invitation=${JETON}`)
    expect(capturerInvitationDepuisAdresse()).toBe(JETON)
    expect(invitationEnAttente()).toBe(JETON)
    // Un jeton d'invitation n'a rien à faire dans une barre d'adresse que l'on
    // partage, ni dans l'historique du téléphone.
    expect(window.location.search).not.toContain('invitation')
  })

  it('préserve les autres paramètres', () => {
    aller(`/?lang=wo&invitation=${JETON}`)
    capturerInvitationDepuisAdresse()
    expect(window.location.search).toContain('lang=wo')
    expect(window.location.search).not.toContain('invitation')
  })

  /* Sans invitation dans l'adresse, on ne doit pas effacer celle qui attend
     déjà : l'employé recharge la page pendant qu'il crée son compte. */
  it('conserve une invitation déjà en attente quand l\'adresse est nue', () => {
    aller(`/?invitation=${JETON}`)
    capturerInvitationDepuisAdresse()
    aller('/')
    expect(capturerInvitationDepuisAdresse()).toBe(JETON)
    expect(invitationEnAttente()).toBe(JETON)
  })

  it('ne rend rien quand il n\'y a jamais eu d\'invitation', () => {
    aller('/')
    expect(capturerInvitationDepuisAdresse()).toBeNull()
    expect(invitationEnAttente()).toBeNull()
  })

  it('oublie l\'invitation une fois acceptée', () => {
    aller(`/?invitation=${JETON}`)
    capturerInvitationDepuisAdresse()
    oublierInvitation()
    expect(invitationEnAttente()).toBeNull()
  })
})
