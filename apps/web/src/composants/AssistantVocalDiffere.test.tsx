/* Le code de l'assistant n'est chargé que pour les commerçants qui y ont droit. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { api } from '../outils/api'
import AssistantVocalDiffere from './AssistantVocalDiffere'

/** Répond à GET /assistant-vocal/etat ; compte les appels. */
function etatServeur(disponible: boolean) {
  const appels: string[] = []
  api.defaults.adapter = async (requete) => {
    appels.push(requete.url ?? '')
    return { data: { disponible, questions_restantes: disponible ? 40 : 0, duree_max_secondes: 30 }, status: 200, statusText: '', headers: {}, config: requete }
  }
  return appels
}

beforeEach(() => localStorage.setItem('samacommerce_jeton', 'jeton-valide'))
afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })

describe('Assistant vocal — chargement différé', () => {
  it('sans droit, rien ne s’affiche et le code de l’assistant n’est pas chargé', async () => {
    const appels = etatServeur(false)
    const { container } = render(<AssistantVocalDiffere bureau={false} ecran="accueil" surNavigation={vi.fn()} />)

    await act(async () => {})
    expect(container).toBeEmptyDOMElement()
    expect(appels).toEqual(['/assistant-vocal/etat'])
  })

  it('avec le droit, le micro apparaît, sans redemander l’état', async () => {
    localStorage.setItem('samacommerce_langue_assistant', 'wo')
    const appels = etatServeur(true)
    render(<AssistantVocalDiffere bureau={false} ecran="accueil" surNavigation={vi.fn()} />)

    expect(await screen.findByRole('button', { name: /Parler à l’assistant en wolof/ })).toBeInTheDocument()
    expect(appels).toEqual(['/assistant-vocal/etat'])
  })
})
