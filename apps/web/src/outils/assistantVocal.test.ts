import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'
import { AssistantVocal, choisirLangueAssistant, lireLangueAssistant, messageErreur, ondesDuTexte, silence } from './assistantVocal'

const echec = (status: number, data: unknown = {}) => ({ response: { status, data } })

afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })

describe('Assistant vocal — échanges avec le serveur', () => {
  it('envoie le message vocal en formulaire, avec la langue choisie', async () => {
    let envoye: FormData | undefined
    api.defaults.adapter = async (requete) => {
      envoye = requete.data as FormData
      return { data: { reponse: 'ok' }, status: 200, statusText: '', headers: {}, config: requete }
    }

    await AssistantVocal.poser('wo', { audio: new Blob(['RIFF'], { type: 'audio/wav' }) })

    const formulaire = envoye as FormData
    expect(formulaire.get('langue')).toBe('wo')
    expect((formulaire.get('audio') as File).name).toBe('message.wav')
    expect(formulaire.has('texte')).toBe(false)
  })

  it('demande la voix de la réponse à part, en binaire', async () => {
    let demande: { url?: string; method?: string; responseType?: string } = {}
    api.defaults.adapter = async (requete) => {
      demande = requete
      return { data: new Blob(['MP3'], { type: 'audio/mpeg' }), status: 200, statusText: '', headers: {}, config: requete }
    }

    const son = await AssistantVocal.voix(7)

    expect(demande).toMatchObject({ url: '/assistant-vocal/questions/7/voix', method: 'post', responseType: 'blob' })
    expect(son.size).toBe(3)
  })

  it('dit au commerçant ce qui s’est passé, sans jargon', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(messageErreur(new Error('Network Error'))).toBe('Pas de connexion : l’assistant a besoin d’Internet.')

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    expect(messageErreur(new Error('timeout'))).toMatch(/met trop de temps/)
    expect(messageErreur(echec(422, { errors: { audio: ['Message trop long : 30 secondes au plus.'] } }))).toBe('Message trop long : 30 secondes au plus.')
    expect(messageErreur(echec(429, { message: 'Vous avez posé toutes vos questions pour aujourd’hui.' }))).toMatch(/toutes vos questions/)
    expect(messageErreur(echec(429))).toBe('Trop de questions d’un coup : attendez une minute.')
    expect(messageErreur(echec(503, { message: 'L’assistant ne répond pas pour le moment.' }))).toMatch(/ne répond pas/)
  })
})

describe('Assistant vocal — langue', () => {
  it('reprend la langue de l’interface la première fois, puis la dernière choisie', () => {
    expect(lireLangueAssistant()).toBe('fr')
    localStorage.setItem('samacommerce_langue', 'wo')
    expect(lireLangueAssistant()).toBe('wo')
    choisirLangueAssistant('fr')
    expect(lireLangueAssistant()).toBe('fr')
  })
})

describe('Assistant vocal — sons', () => {
  it('fabrique un vrai fichier de silence pour déverrouiller le son sur iPhone', async () => {
    const vue = new DataView(await silence().arrayBuffer())
    expect(String.fromCharCode(vue.getUint8(0), vue.getUint8(1), vue.getUint8(2), vue.getUint8(3))).toBe('RIFF')
    expect(vue.byteLength).toBe(44 + 1600 * 2)
  })

  it('dessine la même onde pour la même réponse', () => {
    const ondes = ondesDuTexte('Tey, jaay nga 3 000 F.')
    expect(ondes).toEqual(ondesDuTexte('Tey, jaay nga 3 000 F.'))
    expect(ondes).toHaveLength(28)
    expect(Math.min(...ondes)).toBeGreaterThanOrEqual(0.2)
    expect(Math.max(...ondes)).toBeLessThanOrEqual(1)
  })
})
