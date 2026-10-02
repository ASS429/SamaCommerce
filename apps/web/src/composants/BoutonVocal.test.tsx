/* Le geste du bouton vocal, éprouvé comme le ferait un commerçant : doigt
 * posé, glissé, relâché. Le micro lui-même est simulé (pas de micro en test). */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import BoutonVocal from './BoutonVocal'
import { MicroIndisponible } from '../outils/enregistreurVocal'

const micro = vi.hoisted(() => ({
  demarrer: vi.fn(),
  arreter: vi.fn(),
  annuler: vi.fn(),
}))

vi.mock('../outils/enregistreurVocal', async (original) => {
  const reel = await original<typeof import('../outils/enregistreurVocal')>()
  return {
    ...reel,
    EnregistreurVocal: class {
      surNiveau?: (niveau: number) => void
      demarrer = micro.demarrer
      arreter = micro.arreter
      annuler = micro.annuler
    },
  }
})

const MESSAGE = { wav: new Blob(['RIFF'], { type: 'audio/wav' }), duree: 2.4, ondes: [0.5, 1] }

function monter(proprietes: Partial<Parameters<typeof BoutonVocal>[0]> = {}) {
  const surEnvoi = vi.fn()
  const surMicroIndisponible = vi.fn()
  render(<BoutonVocal variante="flottante" dureeMax={30} surEnvoi={surEnvoi} surMicroIndisponible={surMicroIndisponible} {...proprietes} />)
  return { surEnvoi, surMicroIndisponible, bouton: screen.getByRole('button', { name: /Parler à l’assistant/ }) }
}

/** Doigt posé, puis le temps que le téléphone ouvre le micro. */
async function poserLeDoigt(bouton: HTMLElement, type = 'touch') {
  fireEvent.pointerDown(bouton, { pointerType: type, pointerId: 1, clientX: 300, clientY: 700, button: 0 })
  await act(async () => {})
}

beforeEach(() => {
  vi.useFakeTimers()
  micro.demarrer.mockResolvedValue(undefined)
  micro.arreter.mockReturnValue(MESSAGE)
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('Bouton vocal — le geste de WhatsApp', () => {
  it('un simple toucher explique le geste, sans rien envoyer', async () => {
    const { bouton, surEnvoi } = monter()
    await poserLeDoigt(bouton)
    act(() => { vi.advanceTimersByTime(150) })
    fireEvent.pointerUp(bouton, { pointerType: 'touch', pointerId: 1 })

    expect(screen.getByRole('tooltip')).toHaveTextContent('Maintenez pour enregistrer, relâchez pour envoyer')
    expect(surEnvoi).not.toHaveBeenCalled()
    expect(micro.annuler).toHaveBeenCalled()
  })

  it('maintenir puis relâcher envoie le message', async () => {
    const { bouton, surEnvoi } = monter()
    await poserLeDoigt(bouton)

    expect(screen.getByText('Glisser pour annuler')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(2400) })
    expect(screen.getByLabelText('Enregistrement : 0:02')).toBeInTheDocument()

    fireEvent.pointerUp(bouton, { pointerType: 'touch', pointerId: 1 })
    expect(surEnvoi).toHaveBeenCalledWith(MESSAGE)
    expect(screen.queryByText('Glisser pour annuler')).not.toBeInTheDocument()
  })

  it('glisser vers la gauche annule, et le micro s’éteint', async () => {
    const { bouton, surEnvoi } = monter()
    await poserLeDoigt(bouton)
    act(() => { vi.advanceTimersByTime(1000) })
    fireEvent.pointerMove(bouton, { pointerType: 'touch', pointerId: 1, clientX: 170, clientY: 700 })

    expect(screen.getByRole('status')).toHaveTextContent('Message annulé')
    expect(micro.annuler).toHaveBeenCalled()
    fireEvent.pointerUp(bouton, { pointerType: 'touch', pointerId: 1 })
    expect(surEnvoi).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.queryByText('Message annulé')).not.toBeInTheDocument()
  })

  it('glisser vers le haut verrouille : on lâche le bouton, puis on envoie', async () => {
    const { bouton, surEnvoi } = monter()
    await poserLeDoigt(bouton)
    act(() => { vi.advanceTimersByTime(800) })
    fireEvent.pointerMove(bouton, { pointerType: 'touch', pointerId: 1, clientX: 300, clientY: 600 })

    expect(screen.getByText('Vous pouvez lâcher le bouton')).toBeInTheDocument()
    expect(surEnvoi).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(2000) })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer à l’assistant' }))
    expect(surEnvoi).toHaveBeenCalledWith(MESSAGE)
  })

  it('à la souris, un clic suffit : l’enregistrement démarre déjà verrouillé', async () => {
    const { bouton, surEnvoi } = monter({ bureau: true })
    await poserLeDoigt(bouton, 'mouse')

    expect(screen.getByText('Parlez, puis envoyez')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer l’enregistrement' }))
    expect(micro.annuler).toHaveBeenCalled()
    expect(surEnvoi).not.toHaveBeenCalled()
  })

  it('le message part tout seul à la durée permise', async () => {
    const { bouton, surEnvoi } = monter({ dureeMax: 3 })
    await poserLeDoigt(bouton)
    act(() => { vi.advanceTimersByTime(3200) })

    expect(surEnvoi).toHaveBeenCalledTimes(1)
  })

  it('un micro bloqué est signalé au lieu d’enregistrer dans le vide', async () => {
    micro.demarrer.mockRejectedValue(new MicroIndisponible('refuse'))
    const { bouton, surMicroIndisponible, surEnvoi } = monter()
    await poserLeDoigt(bouton)

    expect(surMicroIndisponible).toHaveBeenCalledWith('refuse')
    expect(screen.queryByText('Glisser pour annuler')).not.toBeInTheDocument()
    expect(surEnvoi).not.toHaveBeenCalled()
  })
})
