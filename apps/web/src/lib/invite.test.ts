import { beforeEach, describe, expect, it } from 'vitest'
import { captureInviteFromUrl, clearInvite, extractInviteToken, pendingInvite } from './invite'

const JETON = 'aZ09'.repeat(12) // 48 caractères, comme Str::random(48)

describe('extractInviteToken — tolérant au copier-coller WhatsApp', () => {
  it('lit le lien complet produit par l\'API', () => {
    expect(extractInviteToken(`https://samacommerce-web.onrender.com/?invite=${JETON}`)).toBe(JETON)
  })

  it('accepte un jeton collé seul', () => {
    expect(extractInviteToken(JETON)).toBe(JETON)
  })

  it('ignore les paramètres qui suivent', () => {
    expect(extractInviteToken(`https://x.sn/?invite=${JETON}&utm=whatsapp`)).toBe(JETON)
    expect(extractInviteToken(`https://x.sn/?utm=wa&invite=${JETON}#haut`)).toBe(JETON)
  })

  /* WhatsApp ajoute volontiers une espace ou un retour à la ligne au collage. */
  it('supporte les espaces autour', () => {
    expect(extractInviteToken(`  https://x.sn/?invite=${JETON}\n`)).toBe(JETON)
  })

  it('rend une chaîne vide plutôt que de planter', () => {
    expect(extractInviteToken('')).toBe('')
    expect(extractInviteToken('   ')).toBe('')
  })
})

describe('captureInviteFromUrl — le lien devient une invitation en attente', () => {
  beforeEach(() => { clearInvite() })

  const aller = (url: string) => window.history.replaceState({}, '', url)

  it('met le jeton de côté et le retire de l\'adresse', () => {
    aller(`/?invite=${JETON}`)
    expect(captureInviteFromUrl()).toBe(JETON)
    expect(pendingInvite()).toBe(JETON)
    // Un jeton d'invitation n'a rien à faire dans une barre d'adresse que l'on
    // partage, ni dans l'historique du téléphone.
    expect(window.location.search).not.toContain('invite')
  })

  it('préserve les autres paramètres', () => {
    aller(`/?lang=wo&invite=${JETON}`)
    captureInviteFromUrl()
    expect(window.location.search).toContain('lang=wo')
    expect(window.location.search).not.toContain('invite')
  })

  /* Sans invitation dans l'adresse, on ne doit pas effacer celle qui attend
     déjà : l'employé recharge la page pendant qu'il crée son compte. */
  it('conserve une invitation déjà en attente quand l\'adresse est nue', () => {
    aller(`/?invite=${JETON}`)
    captureInviteFromUrl()
    aller('/')
    expect(captureInviteFromUrl()).toBe(JETON)
    expect(pendingInvite()).toBe(JETON)
  })

  it('ne rend rien quand il n\'y a jamais eu d\'invitation', () => {
    aller('/')
    expect(captureInviteFromUrl()).toBeNull()
    expect(pendingInvite()).toBeNull()
  })

  it('oublie l\'invitation une fois acceptée', () => {
    aller(`/?invite=${JETON}`)
    captureInviteFromUrl()
    clearInvite()
    expect(pendingInvite()).toBeNull()
  })
})
