/* Le cache partagé du catalogue.
 *
 * Ce que ces tests protègent : l'aller-retour Vendre ↔ Stock, la boucle la plus
 * fréquente du comptoir, ne doit plus retélécharger la liste des produits. Et
 * surtout, après une vente, le stock affiché ne doit PAS rester périmé — un
 * cache qui ment est pire que l'appel réseau qu'il évite. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { api } from './api'
import { creerClientRequetes, useProduits, useRafraichirCatalogue } from './requetes'

let appels = 0
let client: QueryClient

beforeEach(() => {
  appels = 0
  client = creerClientRequetes()
  api.defaults.adapter = async (requete) => {
    appels++
    return { data: [{ id: 1, nom: 'Riz', stock: 10 }], status: 200, statusText: '', headers: {}, config: requete }
  }
})
afterEach(() => { client.clear(); vi.restoreAllMocks() })

const enveloppe = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
)

describe('cache du catalogue', () => {
  it('ne télécharge la liste QU\'UNE FOIS pour plusieurs écrans', async () => {
    const a = renderHook(() => useProduits(), { wrapper: enveloppe })
    await waitFor(() => expect(a.result.current.data).toBeDefined())

    // Second écran (ex. on passe de Stock à Vendre) : même clé, même cache.
    const b = renderHook(() => useProduits(), { wrapper: enveloppe })
    await waitFor(() => expect(b.result.current.data).toBeDefined())

    expect(appels).toBe(1)
    expect(b.result.current.data).toHaveLength(1)
  })

  it('retélécharge après une vente (le stock ne doit pas mentir)', async () => {
    const vue = renderHook(() => ({ produits: useProduits(), rafraichir: useRafraichirCatalogue() }), { wrapper: enveloppe })
    await waitFor(() => expect(vue.result.current.produits.data).toBeDefined())
    expect(appels).toBe(1)

    // C'est ce que Vendre appelle après chaque encaissement.
    vue.result.current.rafraichir()

    await waitFor(() => expect(appels).toBe(2))
  })

  it('ne relance pas d\'appel au retour dans l\'onglet', async () => {
    // Sur mobile, chaque notification ferait sinon repartir une requête
    // facturée à l'utilisateur.
    expect(client.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false)
  })

  it('considère la liste fraîche pendant une minute', () => {
    // Au comptoir une liste vieille d'une minute est bonne ; au-delà, un stock
    // faux ferait vendre à découvert.
    expect(client.getDefaultOptions().queries?.staleTime).toBe(60_000)
  })

  it('annonce le contrat français à l\'API', () => {
    // Sans cet en-tête, /categories et les autres adresses au nom identique
    // dans les deux langues répondraient dans l'ANCIEN format anglais.
    expect(api.defaults.headers['X-Contrat-Api']).toBe('fr')
  })
})
