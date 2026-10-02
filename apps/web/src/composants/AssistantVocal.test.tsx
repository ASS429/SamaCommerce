/* L'assistant vocal de bout en bout, côté écran : le micro n'apparaît que
 * pour les comptes de la bêta, la question part, la réponse s'affiche comme
 * dans une discussion WhatsApp, et le guidage ouvre la bonne page. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { api } from '../outils/api'
import AssistantVocal from './AssistantVocal'

const micro = vi.hoisted(() => ({ demarrer: vi.fn(), arreter: vi.fn(), annuler: vi.fn() }))
vi.mock('../outils/enregistreurVocal', async (original) => {
  const reel = await original<typeof import('../outils/enregistreurVocal')>()
  return { ...reel, EnregistreurVocal: class { demarrer = micro.demarrer; arreter = micro.arreter; annuler = micro.annuler } }
})

const ETAT = { disponible: true, questions_restantes: 12, duree_max_secondes: 30 }
const REPONSE = {
  id: 7,
  transcription: 'Tey ñaata laa jaay ?',
  reponse: 'Tey, jaay nga 47 350 F.',
  langue: 'wo',
  carte: { valeur: '47 350 F', libelle: '18 ventes aujourd\'hui' },
  action: null,
  questions_restantes: 11,
}

/** Répond selon l'adresse ; `questions` reçoit chaque formulaire envoyé. */
function serveur(reponses: { etat?: unknown; questions?: Array<{ status: number; data: unknown }> }) {
  const envois: FormData[] = []
  api.defaults.adapter = async (requete) => {
    const repondre = (donnees: unknown, statut = 200) => ({ data: donnees, status: statut, statusText: '', headers: {}, config: requete })
    if (requete.url === '/assistant-vocal/etat') return repondre(reponses.etat ?? ETAT)
    if (requete.url?.endsWith('/voix')) return repondre(new Blob(['MP3'], { type: 'audio/mpeg' }))
    envois.push(requete.data as FormData)
    const suivante = reponses.questions?.shift() ?? { status: 200, data: REPONSE }
    if (suivante.status >= 400) {
      throw Object.assign(new Error('échec'), { config: requete, response: repondre(suivante.data, suivante.status) })
    }
    return repondre(suivante.data)
  }
  return envois
}

/** Les sons que le lecteur a joués, dans l'ordre. */
const sonsJoues: string[] = []

async function envoyerUnMessageVocal() {
  const bouton = await screen.findByRole('button', { name: /Parler à l’assistant/ })
  fireEvent.pointerDown(bouton, { pointerType: 'touch', pointerId: 1, clientX: 300, clientY: 700 })
  await act(async () => {})
  act(() => { vi.advanceTimersByTime(2000) })
  fireEvent.pointerUp(bouton, { pointerType: 'touch', pointerId: 1 })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  localStorage.setItem('samacommerce_jeton', 'jeton-valide')
  // La langue a déjà été choisie (le tout premier usage a son propre test).
  localStorage.setItem('samacommerce_langue_assistant', 'wo')
  micro.demarrer.mockResolvedValue(undefined)
  micro.arreter.mockReturnValue({ wav: new Blob(['RIFF'], { type: 'audio/wav' }), duree: 2, ondes: [0.4, 1] })
  // Une adresse par son, qui dit ce qu'elle contient (le MP3 de la réponse fait 3 octets).
  URL.createObjectURL = vi.fn((son: Blob) => `blob:${son.type}:${son.size}`)
  URL.revokeObjectURL = vi.fn()
  sonsJoues.length = 0
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    sonsJoues.push(this.src)
    return Promise.resolve()
  })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})
afterEach(() => {
  cleanup() // démonte AVANT de rendre au lecteur audio ses vraies méthodes
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
  document.body.innerHTML = ''
})

describe('Assistant vocal — à l’écran', () => {
  it('reste invisible pour un compte hors de la bêta', async () => {
    serveur({ etat: { disponible: false, questions_restantes: 0, duree_max_secondes: 30 } })
    const { container } = render(<AssistantVocal bureau={false} ecran="accueil" surNavigation={vi.fn()} />)

    await act(async () => {})
    expect(container).toBeEmptyDOMElement()
  })

  it('au tout premier message, la langue se choisit avant de parler', async () => {
    localStorage.removeItem('samacommerce_langue_assistant')
    serveur({})
    render(<AssistantVocal bureau={false} ecran="accueil" surNavigation={vi.fn()} />)

    const bouton = await screen.findByRole('button', { name: /Parler à l’assistant/ })
    fireEvent.pointerDown(bouton, { pointerType: 'touch', pointerId: 1, clientX: 300, clientY: 700 })
    expect(screen.getByText('Vous allez parler en quelle langue ?')).toBeInTheDocument()
    expect(micro.demarrer).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Wolof' }))
    expect(localStorage.getItem('samacommerce_langue_assistant')).toBe('wo')
    expect(screen.getByText('Maintenez pour enregistrer, relâchez pour envoyer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Parler à l’assistant en wolof : maintenez pour enregistrer' })).toBeInTheDocument()
    expect(screen.getByText('WO')).toBeInTheDocument()
  })

  it('un message vocal ouvre la discussion : ce qui a été compris, la réponse et le chiffre en grand', async () => {
    const envois = serveur({})
    render(<AssistantVocal bureau={false} ecran="accueil" surNavigation={vi.fn()} />)

    await envoyerUnMessageVocal()

    expect(await screen.findByText('Tey, jaay nga 47 350 F.')).toBeInTheDocument()
    expect(screen.getByText('« Tey ñaata laa jaay ? »')).toBeInTheDocument()
    expect(screen.getByText('47 350 F')).toBeInTheDocument()
    expect(screen.getByLabelText('Lu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wolof' })).toHaveAttribute('aria-pressed', 'true')
    expect(envois[0].get('langue')).toBe('wo')
    expect(envois[0].get('audio')).toBeInstanceOf(Blob)
    // La voix arrive après le texte, et se lit toute seule.
    await waitFor(() => expect(sonsJoues).toContain('blob:audio/mpeg:3'))
    expect(screen.getByRole('button', { name: 'Mettre en pause' })).toBeInTheDocument()
  })

  it('le guidage ouvre la page et entoure le bouton à toucher', async () => {
    serveur({ questions: [{ status: 200, data: { ...REPONSE, reponse: 'Appuyez sur « + Ajouter ».', carte: null, action: { type: 'guider', ecran: 'stock', bouton: 'stock-ajouter' } } }] })
    const surNavigation = vi.fn()
    render(<><button data-guide="stock-ajouter">+ Ajouter</button><AssistantVocal bureau={false} ecran="accueil" surNavigation={surNavigation} /></>)

    await envoyerUnMessageVocal()

    await waitFor(() => expect(surNavigation).toHaveBeenCalledWith('stock'))
    expect(screen.getByRole('complementary')).toHaveTextContent('Appuyez sur « + Ajouter ».')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const cible = screen.getByText('+ Ajouter')
    await waitFor(() => expect(cible).toHaveClass('guide-anneau'))
    expect(cible).toHaveAttribute('data-guide-libelle', 'Bësal fii') // l'assistant parle wolof : l'étiquette aussi

    fireEvent.click(cible)
    expect(cible).not.toHaveClass('guide-anneau')
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('Google saturé : le message le dit, et « Réessayer » renvoie la même question', async () => {
    const envois = serveur({ questions: [{ status: 503, data: { erreur: 'Indisponible', message: 'L’assistant ne répond pas pour le moment. Réessayez dans un instant.' } }] })
    render(<AssistantVocal bureau={false} ecran="accueil" surNavigation={vi.fn()} />)

    await envoyerUnMessageVocal()
    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('Tey, jaay nga 47 350 F.')).toBeInTheDocument()
    expect(screen.queryByText(/ne répond pas pour le moment/)).not.toBeInTheDocument()
    expect(envois).toHaveLength(2)
    // Le même enregistrement repart (FormData l'emballe dans un nouveau fichier à chaque envoi).
    expect((envois[1].get('audio') as File).size).toBe((envois[0].get('audio') as File).size)
  })

  it('si l’oreille avait compris, « Réessayer » renvoie le texte compris, sans refaire écouter le son', async () => {
    const envois = serveur({ questions: [{ status: 503, data: { erreur: 'Indisponible', etape: 'cerveau', transcription: 'Tey ñaata laa jaay ?', message: 'L’assistant ne répond pas pour le moment. Réessayez dans un instant.' } }] })
    render(<AssistantVocal bureau={false} ecran="accueil" surNavigation={vi.fn()} />)

    await envoyerUnMessageVocal()
    expect(await screen.findByText('« Tey ñaata laa jaay ? »')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('Tey, jaay nga 47 350 F.')).toBeInTheDocument()
    expect(envois[1].get('texte')).toBe('Tey ñaata laa jaay ?')
    expect(envois[1].has('audio')).toBe(false)
  })

  it('le quota épuisé ne propose pas de réessayer', async () => {
    serveur({ questions: [{ status: 429, data: { erreur: 'Quota atteint', message: 'Vous avez posé toutes vos questions pour aujourd’hui. L’assistant revient demain.' } }] })
    render(<AssistantVocal bureau={false} ecran="accueil" surNavigation={vi.fn()} />)

    await envoyerUnMessageVocal()

    expect(await screen.findByText(/toutes vos questions pour aujourd’hui/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
    expect(screen.getByText('Plus de questions pour aujourd’hui : l’assistant revient demain.')).toBeInTheDocument()
  })
})
