/* Un rafraîchissement raté ne doit PAS masquer des données valides.
 *
 * Régression vécue : react-query conserve les dernières données quand un
 * NOUVEL APPEL échoue. Une seule requête ratée — l'API endormie un instant —
 * laissait l'erreur enregistrée, et le grand bandeau « Le serveur ne répond
 * pas » s'affichait par-dessus une liste pourtant correcte. Dans Vendre,
 * l'erreur remplaçait carrément la grille : catalogue invisible au comptoir. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { api } from '../outils/api'
import { creerClientRequetes, CLES } from '../outils/requetes'
import Stock from './Stock'

afterEach(() => vi.restoreAllMocks())

function afficherAvecCache(produits: unknown[], enEchec: boolean) {
  const client = creerClientRequetes()
  // Des données DÉJÀ en cache, comme après un premier chargement réussi.
  client.setQueryData(CLES.produits, produits)
  client.setQueryData(CLES.categories, [])
  // Puis le rafraîchissement échoue.
  api.defaults.adapter = async (config) => {
    if (!enEchec) return { data: produits, status: 200, statusText: '', headers: {}, config }
    const erreur: Error & { response?: unknown } = new Error('réseau')
    erreur.response = undefined
    throw erreur
  }
  const enveloppe = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return render(<Stock />, { wrapper: enveloppe })
}

const produit = { id: 1, nom: 'Eau minérale', stock: 71, prix_vente: 300, prix_achat: 200, categorie_id: null }

describe('Stock — rafraîchissement en échec', () => {
  it('garde les produits visibles et n\'affiche PAS le grand bandeau', async () => {
    afficherAvecCache([produit], true)

    // Le produit reste affiché : c'est le point de la régression.
    await waitFor(() => expect(screen.getByText('Eau minérale')).toBeInTheDocument())

    // Pas de bloc pleine hauteur qui recouvre la liste.
    await waitFor(() => {
      const alerte = screen.queryByRole('alert')
      if (alerte) expect(alerte.className).toContain('erreur-chargement--compacte')
    })
  })

  it('n\'affiche aucune alerte quand tout va bien', async () => {
    afficherAvecCache([produit], false)
    await waitFor(() => expect(screen.getByText('Eau minérale')).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
