/* Assistant vocal (bêta) : appels à l'API, langue choisie, messages d'erreur.

   L'assistant LIT et GUIDE ; il n'enregistre rien. Une question coûte de
   l'argent (transcription, voix) : le serveur tient un quota quotidien. */
import { api } from './api'
import { lireLangue } from './traductions'
import type { Ecran } from '../sections/Accueil'

export type LangueAssistant = 'wo' | 'fr'

export type EtatAssistant = {
  disponible: boolean
  questions_restantes: number
  duree_max_secondes: number
}

export type CarteChiffre = { valeur: string; libelle: string }

export type Guidage = { type: 'guider'; ecran: Ecran; bouton: string | null }

export type ReponseAssistant = {
  /** Sert à demander la voix de la réponse, juste après. */
  id: number
  transcription: string
  reponse: string
  langue: LangueAssistant
  carte: CarteChiffre | null
  action: Guidage | null
  questions_restantes: number
}

/** Transcription + réflexion : jusqu'à une minute quand Google est chargé. */
const DELAI_REPONSE_MS = 95_000
/** La voix d'une réponse de deux phrases : 4 à 11 s lors des essais. */
const DELAI_VOIX_MS = 45_000

export const AssistantVocal = {
  etat: () => api.get<EtatAssistant>('/assistant-vocal/etat').then((r) => r.data),
  poser: (langue: LangueAssistant, question: { audio: Blob } | { texte: string }) => {
    const formulaire = new FormData()
    formulaire.append('langue', langue)
    if ('audio' in question) formulaire.append('audio', question.audio, 'message.wav')
    else formulaire.append('texte', question.texte)
    return api.post<ReponseAssistant>('/assistant-vocal/questions', formulaire, { timeout: DELAI_REPONSE_MS }).then((r) => r.data)
  },
  /** La réponse lue à voix haute (MP3), demandée APRÈS la réponse écrite pour ne pas la retarder. */
  voix: (id: number) =>
    api.post<Blob>(`/assistant-vocal/questions/${id}/voix`, null, { responseType: 'blob', timeout: DELAI_VOIX_MS }).then((r) => r.data),
}

const CLE_LANGUE = 'samacommerce_langue_assistant'

/** La langue de la dernière conversation ; à défaut, celle de l'interface. */
export function lireLangueAssistant(): LangueAssistant {
  try {
    const memorisee = localStorage.getItem(CLE_LANGUE)
    if (memorisee === 'wo' || memorisee === 'fr') return memorisee
  } catch { /* stockage indisponible : langue de l'interface */ }
  return lireLangue() === 'wo' ? 'wo' : 'fr'
}

/**
 * La langue a-t-elle déjà été choisie ? L'essai du 02/10/2026 l'a montré : un
 * message en wolof écouté « en français » donne « T'es gnaw, t'es laide » pour
 * « Tey ñaata laa jaay ? ». On la demande donc avant le tout premier message.
 */
export function langueAssistantChoisie(): boolean {
  try {
    const memorisee = localStorage.getItem(CLE_LANGUE)
    return memorisee === 'wo' || memorisee === 'fr'
  } catch {
    return false
  }
}

export function choisirLangueAssistant(langue: LangueAssistant): void {
  try { localStorage.setItem(CLE_LANGUE, langue) } catch { /* sans conséquence */ }
}

/** Ce que le commerçant lit quand la question n'a pas abouti. */
export function messageErreur(erreur: unknown): string {
  const reponse = (erreur as { response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } } })?.response
  if (!reponse) {
    return navigator.onLine
      ? 'L’assistant met trop de temps à répondre. Réessayez dans un instant.'
      : 'Pas de connexion : l’assistant a besoin d’Internet.'
  }
  const premiereErreur = reponse.data?.errors ? Object.values(reponse.data.errors)[0]?.[0] : undefined
  if (reponse.status === 422 && premiereErreur) return premiereErreur
  if (reponse.status === 429 && !reponse.data?.message) return 'Trop de questions d’un coup : attendez une minute.'
  return reponse.data?.message || 'L’assistant ne répond pas pour le moment. Réessayez dans un instant.'
}

/**
 * Un dixième de seconde de silence, joué pendant le geste du commerçant.
 *
 * Safari (iPhone) refuse de jouer un son qui n'est pas déclenché par un geste.
 * La réponse arrive plusieurs secondes après le geste : on « déverrouille »
 * donc le lecteur au moment de l'appui, en lui faisant jouer ce silence.
 */
export function silence(): Blob {
  const echantillons = 1600
  const tampon = new ArrayBuffer(44 + echantillons * 2)
  const vue = new DataView(tampon)
  const ecrire = (position: number, texte: string) => [...texte].forEach((c, i) => vue.setUint8(position + i, c.charCodeAt(0)))
  ecrire(0, 'RIFF'); vue.setUint32(4, 36 + echantillons * 2, true); ecrire(8, 'WAVE')
  ecrire(12, 'fmt '); vue.setUint32(16, 16, true); vue.setUint16(20, 1, true); vue.setUint16(22, 1, true)
  vue.setUint32(24, 16000, true); vue.setUint32(28, 32000, true); vue.setUint16(32, 2, true); vue.setUint16(34, 16, true)
  ecrire(36, 'data'); vue.setUint32(40, echantillons * 2, true)
  return new Blob([tampon], { type: 'audio/wav' })
}

/** Barres décoratives de l'onde d'une réponse : stables pour un même texte. */
export function ondesDuTexte(texte: string, nombre = 28): number[] {
  let graine = 7
  for (const caractere of texte) graine = (graine * 31 + caractere.charCodeAt(0)) % 9973
  return Array.from({ length: nombre }, (_, i) => {
    graine = (graine * 17 + 13 * (i + 1)) % 9973
    return 0.2 + (graine % 80) / 100
  })
}
