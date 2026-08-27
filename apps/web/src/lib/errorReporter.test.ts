/* Le rapporteur d'erreurs ne doit JAMAIS aggraver la situation.
 *
 * Ces tests figent les quatre garde-fous : pas de boucle, pas d'inondation,
 * pas de bruit sur les pannes réseau, et surtout aucune exception propre au
 * rapporteur lui-même — casser l'application en signalant qu'elle est cassée
 * serait le pire des résultats. */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reportError, _resetReporter } from './errorReporter'

const envoi = () => (globalThis.fetch as ReturnType<typeof vi.fn>)

beforeEach(() => {
  _resetReporter()
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true } as Response)))
})

const erreur = (message: string, stack = 'Error\n  at a.js:1') =>
  ({ message, stack, url: '/stock', kind: 'error' as const })

describe('rapporteur d\'erreurs', () => {
  it('envoie une erreur au serveur', async () => {
    reportError(erreur('boum'))
    expect(envoi()).toHaveBeenCalledOnce()

    const [url, opts] = envoi().mock.calls[0]
    expect(String(url)).toContain('/client-errors')
    expect(JSON.parse((opts as RequestInit).body as string).message).toBe('boum')
    // keepalive : l'envoi doit survivre à la fermeture de l'onglet, fréquente
    // juste après un plantage.
    expect((opts as RequestInit).keepalive).toBe(true)
  })

  it('ne signale qu\'une fois le même bug répété', async () => {
    reportError(erreur('boum'))
    await Promise.resolve(); await Promise.resolve()
    reportError(erreur('boum'))
    reportError(erreur('boum'))
    expect(envoi()).toHaveBeenCalledOnce()
  })

  it('se tait au-delà du plafond par session', async () => {
    for (let i = 0; i < 12; i++) {
      reportError(erreur(`bug numero ${i}`))
      await Promise.resolve(); await Promise.resolve()
    }
    expect(envoi().mock.calls.length).toBeLessThanOrEqual(5)
  })

  it('tronque les charges trop longues', async () => {
    reportError({ ...erreur('x'.repeat(5000)), stack: 'y'.repeat(9000) })
    const corps = JSON.parse((envoi().mock.calls[0][1] as RequestInit).body as string)
    expect(corps.message.length).toBeLessThanOrEqual(500)
    expect(corps.stack.length).toBeLessThanOrEqual(3000)
  })

  it('n\'explose PAS si l\'envoi lui-même échoue', () => {
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('réseau mort') }))
    // Le point crucial : aucune exception ne doit sortir d'ici.
    expect(() => reportError(erreur('boum'))).not.toThrow()
  })
})
