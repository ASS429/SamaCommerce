import { afterEach, describe, expect, it, vi } from 'vitest'
import { deconnecter } from './api'

describe('déconnexion', () => {
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

  it('ferme aussi la session sur le serveur, sans l’attendre', () => {
    const envoi = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
    vi.stubGlobal('fetch', envoi)
    localStorage.setItem('samacommerce_jeton', 'jeton-de-test')
    localStorage.setItem('samacommerce_utilisateur', '{"id":1}')

    deconnecter()

    expect(envoi).toHaveBeenCalledTimes(1)
    const [adresse, options] = envoi.mock.calls[0] as unknown as [string, RequestInit]
    expect(adresse).toMatch(/\/auth\/deconnexion$/)
    expect(options.method).toBe('POST')
    expect(options.keepalive).toBe(true)
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer jeton-de-test')
    // Le local est vidé tout de suite, réseau ou pas.
    expect(localStorage.getItem('samacommerce_jeton')).toBeNull()
    expect(localStorage.getItem('samacommerce_utilisateur')).toBeNull()
  })

  it('sans jeton, n’appelle rien', () => {
    const envoi = vi.fn()
    vi.stubGlobal('fetch', envoi)

    deconnecter()

    expect(envoi).not.toHaveBeenCalled()
  })
})
