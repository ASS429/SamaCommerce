/* Le cœur de la régression : une section dont le chargement ÉCHOUE ne doit
 * jamais afficher l'état vide.
 *
 * « Aucun client » face à une base injoignable, c'est un mensonge : le
 * commerçant en conclut que ses données ont disparu. On teste ici la section
 * réelle (pas le composant d'erreur isolé), parce que c'est le CÂBLAGE qui
 * avait été oublié — le rendu, lui, n'a jamais été le problème. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { api } from '../lib/api'
import Clients from './Clients'

/** Fait échouer tous les appels avec ce statut (0 = coupure réseau). */
function apiFails(status: number) {
  api.defaults.adapter = async (config) => {
    const err: Error & { config?: unknown; response?: unknown } = new Error('échec simulé')
    if (status) err.response = { data: {}, status, statusText: '', headers: {}, config }
    err.config = config
    throw err
  }
}
/** Fait répondre l'API avec cette liste. */
function apiReturns(data: unknown) {
  api.defaults.adapter = async (config) => ({ data, status: 200, statusText: '', headers: {}, config })
}

beforeEach(() => localStorage.setItem('samacommerce_token', 'jeton-valide'))
afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })

describe('Clients — chargement en échec', () => {
  it('affiche une erreur ET PAS « Aucun client » quand le serveur tombe', async () => {
    apiFails(500)
    render(<Clients />)

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText('Le serveur a un problème')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Réessayer/ })).toBeInTheDocument()
    // LE point de la régression :
    expect(screen.queryByText('Aucun client')).not.toBeInTheDocument()
  })

  it('parle de réseau, pas de base vide, quand le téléphone est hors ligne', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    apiFails(0)
    render(<Clients />)

    await waitFor(() => expect(screen.getByText('Vous êtes hors ligne')).toBeInTheDocument())
    expect(screen.queryByText('Aucun client')).not.toBeInTheDocument()
  })

  it('affiche bien « Aucun client » quand la boutique est VRAIMENT vide', async () => {
    apiReturns([])
    render(<Clients />)

    await waitFor(() => expect(screen.getByText('Aucun client')).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
