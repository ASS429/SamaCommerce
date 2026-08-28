/* Un rafraîchissement raté ne doit PAS masquer des données valides.
 *
 * Régression vécue : react-query conserve les dernières données quand un
 * REFETCH échoue. Une seule requête ratée — l'API endormie un instant —
 * laissait l'erreur enregistrée, et le grand bandeau « Le serveur ne répond
 * pas » s'affichait par-dessus une liste pourtant correcte. Dans Vendre,
 * l'erreur remplaçait carrément la grille : catalogue invisible au comptoir. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { api } from '../lib/api'
import { creerQueryClient, CLES } from '../lib/queries'
import Stock from './Stock'

afterEach(() => vi.restoreAllMocks())

function rendreAvecCache(produits: unknown[], enEchec: boolean) {
  const client = creerQueryClient()
  // Des donnees DEJA en cache, comme apres un premier chargement reussi.
  client.setQueryData(CLES.produits, produits)
  client.setQueryData(CLES.categories, [])
  // Puis le rafraichissement echoue.
  api.defaults.adapter = async (config) => {
    if (!enEchec) return { data: produits, status: 200, statusText: '', headers: {}, config }
    const err: Error & { response?: unknown } = new Error('reseau')
    err.response = undefined
    throw err
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return render(<Stock />, { wrapper })
}

const produit = { id: 1, name: 'Eau minérale', stock: 71, price: 300, price_achat: 200, category_id: null }

describe('Stock — rafraîchissement en échec', () => {
  it('garde les produits visibles et n\'affiche PAS le grand bandeau', async () => {
    rendreAvecCache([produit], true)

    // Le produit reste affiché : c'est le point de la régression.
    await waitFor(() => expect(screen.getByText('Eau minérale')).toBeInTheDocument())

    // Pas de bloc pleine hauteur qui recouvre la liste.
    await waitFor(() => {
      const alerte = screen.queryByRole('alert')
      if (alerte) expect(alerte.className).toContain('load-error--compact')
    })
  })

  it('n\'affiche aucune alerte quand tout va bien', async () => {
    rendreAvecCache([produit], false)
    await waitFor(() => expect(screen.getByText('Eau minérale')).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
