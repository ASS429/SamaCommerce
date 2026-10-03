import { useCallback, useEffect, useRef, useState } from 'react'
import { Hand, Keyboard, Lock, Mic, MicOff, Volume2, X } from 'lucide-react'
import '../assistant.css'
import BoutonVocal from './BoutonVocal'
import DiscussionAssistant, { type EtatLecture, type MessageDiscussion } from './DiscussionAssistant'
import {
  AssistantVocal as ApiAssistant, choisirLangueAssistant, langueAssistantChoisie, lireLangueAssistant, messageErreur, ondesDuTexte, silence,
  type EtatAssistant, type Guidage, type LangueAssistant,
} from '../outils/assistantVocal'
import type { Enregistrement, RaisonMicro } from '../outils/enregistreurVocal'
import type { Ecran } from '../sections/Accueil'

/* Assistant vocal (bêta) : le micro vert sur chaque écran, la discussion, la
   réponse lue à voix haute, et le guidage vers la page où agir.

   Rien ne s'affiche tant que le serveur ne l'ouvre pas à ce commerçant
   (GET /assistant-vocal/etat) : la bêta est réservée, chaque question coûte. */

type Proprietes = {
  bureau: boolean
  ecran: Ecran
  /** Ouvre un écran, dans la limite des droits de l'employé. */
  surNavigation: (ecran: Ecran) => void
  /** État déjà lu par AssistantVocalDiffere : inutile de le redemander. */
  etatInitial?: EtatAssistant
}

type Question = { audio: Blob } | { texte: string }

/** L'étiquette posée sous le bouton à toucher. */
const APPUYEZ_ICI: Record<LangueAssistant, string> = { fr: 'Appuyez ici', wo: 'Bësal fii' }
/** La page guidée garde sa carte et son anneau ce temps-là. */
const DUREE_GUIDAGE_MS = 15_000

const heureActuelle = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

export default function AssistantVocal({ bureau, ecran, surNavigation, etatInitial }: Proprietes) {
  const [etat, definirEtat] = useState<EtatAssistant | null>(etatInitial ?? null)
  const [langue, definirLangue] = useState<LangueAssistant>(lireLangueAssistant)
  const [langueChoisie, definirLangueChoisie] = useState(langueAssistantChoisie)
  const [messages, definirMessages] = useState<MessageDiscussion[]>([])
  const [enAttente, definirEnAttente] = useState(false)
  const [ouverte, definirOuverte] = useState(false)
  const [saisieDemandee, definirSaisieDemandee] = useState(false)
  const [microBloque, definirMicroBloque] = useState<RaisonMicro | null>(null)
  const [guide, definirGuide] = useState<{ idMessage: number; bouton: string | null } | null>(null)
  const [lecture, definirLecture] = useState<EtatLecture | null>(null)

  const lecteur = useRef<HTMLAudioElement | null>(null)
  const idEnLecture = useRef<number | null>(null)
  const urlSilence = useRef<string | null>(null)
  const urlsCreees = useRef<string[]>([])
  const questions = useRef(new Map<number, Question>())
  const prochainId = useRef(1)
  const navigation = useRef(surNavigation)
  navigation.current = surNavigation

  useEffect(() => {
    if (etatInitial) return
    let actif = true
    ApiAssistant.etat().then((reponse) => { if (actif) definirEtat(reponse) }).catch(() => {})
    return () => { actif = false }
  }, [etatInitial])

  useEffect(() => () => {
    lecteur.current?.pause()
    urlsCreees.current.forEach((url) => URL.revokeObjectURL(url))
    if (urlSilence.current) URL.revokeObjectURL(urlSilence.current)
  }, [])

  // ─── Lecture des messages (un seul lecteur, comme WhatsApp) ───

  const obtenirLecteur = () => {
    if (lecteur.current) return lecteur.current
    const audio = new Audio()
    audio.preload = 'auto'
    const suivre = (enCours: boolean) => {
      const id = idEnLecture.current
      if (id !== null) definirLecture({ id, enCours, position: audio.duration ? audio.currentTime / audio.duration : 0 })
    }
    audio.addEventListener('timeupdate', () => suivre(!audio.paused))
    audio.addEventListener('play', () => suivre(true))
    audio.addEventListener('pause', () => suivre(false))
    audio.addEventListener('ended', () => { idEnLecture.current = null; definirLecture(null) })
    // La durée d'une réponse n'est connue qu'une fois son fichier ouvert.
    audio.addEventListener('loadedmetadata', () => {
      const id = idEnLecture.current
      if (id === null || !Number.isFinite(audio.duration)) return
      definirMessages((liste) => liste.map((m) => (m.id === id && m.son && m.son.duree === null ? { ...m, son: { ...m.son, duree: audio.duration } } : m)))
    })
    lecteur.current = audio
    return audio
  }

  const lire = (message: MessageDiscussion) => {
    if (!message.son) return
    const audio = obtenirLecteur()
    if (idEnLecture.current === message.id) {
      if (audio.paused) audio.play().catch(() => {})
      else audio.pause()
      return
    }
    audio.pause()
    idEnLecture.current = message.id
    audio.src = message.son.url
    definirLecture({ id: message.id, enCours: true, position: 0 })
    audio.play().catch(() => { idEnLecture.current = null; definirLecture(null) })
  }

  /**
   * Pendant le geste (le seul moment où Safari l'autorise) : coupe la lecture
   * en cours et fait jouer un silence, pour que la réponse puisse être lue
   * toute seule quand elle arrivera.
   */
  const preparerSon = () => {
    definirGuide(null)
    const audio = obtenirLecteur()
    idEnLecture.current = null
    definirLecture(null)
    audio.pause()
    if (!urlSilence.current) urlSilence.current = URL.createObjectURL(silence())
    audio.src = urlSilence.current
    audio.play().catch(() => {})
  }

  const creerUrl = (son: Blob) => {
    const url = URL.createObjectURL(son)
    urlsCreees.current.push(url)
    return url
  }

  // ─── Questions et réponses ───

  const guider = (action: Guidage, message: MessageDiscussion) => {
    navigation.current(action.ecran)
    definirOuverte(false)
    definirGuide({ idMessage: message.id, bouton: action.bouton })
  }

  const poser = async (question: Question, idVous: number) => {
    definirEnAttente(true)
    try {
      const reponse = await ApiAssistant.poser(langue, question)
      const messageAssistant: MessageDiscussion = {
        id: prochainId.current++,
        auteur: 'assistant',
        heure: heureActuelle(),
        texte: reponse.reponse,
        son: null,
        voixEnAttente: true,
        carte: reponse.carte,
      }
      definirMessages((liste) => [
        ...liste.map((m) => (m.id === idVous ? { ...m, etat: 'lu' as const, texte: 'audio' in question ? reponse.transcription : m.texte } : m)),
        messageAssistant,
      ])
      questions.current.delete(idVous)
      definirEtat((actuel) => actuel && { ...actuel, questions_restantes: reponse.questions_restantes })
      if (reponse.action) guider(reponse.action, messageAssistant)
      definirEnAttente(false)
      void preparerVoix(reponse.id, messageAssistant)
    } catch (erreur) {
      const reponse = (erreur as { response?: { status?: number; data?: { erreur?: string; transcription?: string | null } } })?.response
      // Refus, quota ou fichier illisible : réessayer ne changerait rien.
      const definitive = reponse?.status === 403 || reponse?.status === 422 || reponse?.data?.erreur === 'Quota atteint'
      // Le cerveau a échoué APRÈS l'oreille : on montre ce qui a été compris, et
      // « Réessayer » enverra ce texte (plus rapide, et l'oreille n'est pas refacturée).
      const compris = reponse?.data?.transcription || null
      if (compris) questions.current.set(idVous, { texte: compris })
      definirMessages((liste) => [
        ...liste.map((m) => (m.id === idVous ? { ...m, etat: 'erreur' as const, texte: compris ?? m.texte } : m)),
        {
          id: prochainId.current++, auteur: 'assistant', heure: heureActuelle(), texte: messageErreur(erreur), son: null,
          erreur: true, erreurPour: definitive ? undefined : idVous,
        },
      ])
      if (reponse?.status === 403) definirEtat((actuel) => actuel && { ...actuel, disponible: false })
      if (reponse?.data?.erreur === 'Quota atteint') definirEtat((actuel) => actuel && { ...actuel, questions_restantes: 0 })
    } finally {
      definirEnAttente(false)
    }
  }

  /** La réponse est déjà affichée ; sa voix arrive quelques secondes après, et se lit toute seule. */
  const preparerVoix = async (id: number, message: MessageDiscussion) => {
    try {
      const son = { url: creerUrl(await ApiAssistant.voix(id)), duree: null, ondes: ondesDuTexte(message.texte) }
      definirMessages((liste) => liste.map((m) => (m.id === message.id ? { ...m, son, voixEnAttente: false } : m)))
      lire({ ...message, son })
    } catch {
      // Voix en panne : la réponse reste écrite.
      definirMessages((liste) => liste.map((m) => (m.id === message.id ? { ...m, voixEnAttente: false } : m)))
    }
  }

  const envoyer = (question: Question, contenu: Pick<MessageDiscussion, 'texte' | 'son'>) => {
    const id = prochainId.current++
    questions.current.set(id, question)
    definirMessages((liste) => [...liste, { id, auteur: 'vous', heure: heureActuelle(), etat: 'envoi', ...contenu }])
    definirGuide(null)
    definirOuverte(true)
    void poser(question, id)
  }

  const envoyerVocal = (enregistrement: Enregistrement) => envoyer(
    { audio: enregistrement.wav },
    { texte: '', son: { url: creerUrl(enregistrement.wav), duree: enregistrement.duree, ondes: enregistrement.ondes } },
  )

  const envoyerTexte = (texte: string) => envoyer({ texte }, { texte, son: null })

  const reessayer = (message: MessageDiscussion) => {
    const idVous = message.erreurPour
    const question = idVous !== undefined ? questions.current.get(idVous) : undefined
    if (idVous === undefined || !question || enAttente) return
    definirMessages((liste) => liste
      .filter((m) => m.id !== message.id)
      .map((m) => (m.id === idVous ? { ...m, etat: 'envoi' as const } : m)))
    void poser(question, idVous)
  }

  const changerLangue = (nouvelle: LangueAssistant) => {
    choisirLangueAssistant(nouvelle)
    definirLangue(nouvelle)
    definirLangueChoisie(true)
  }

  const fermer = useCallback(() => {
    lecteur.current?.pause()
    definirOuverte(false)
    definirSaisieDemandee(false)
  }, [])

  const ecrirePlutot = () => {
    definirMicroBloque(null)
    definirGuide(null)
    definirSaisieDemandee(true)
    definirOuverte(true)
  }

  // ─── Guidage : l'anneau autour du bouton à toucher ───

  useEffect(() => {
    if (!guide) return
    const fin = window.setTimeout(() => definirGuide(null), DUREE_GUIDAGE_MS)
    if (!guide.bouton) return () => window.clearTimeout(fin)

    let element: HTMLElement | null = null
    let essais = 0
    const surClic = () => definirGuide(null)
    // La page vient d'être ouverte : son bouton n'existe qu'au rendu suivant.
    const recherche = window.setInterval(() => {
      element = document.querySelector<HTMLElement>(`[data-guide="${guide.bouton}"]`)
      if (!element && ++essais < 40) return
      window.clearInterval(recherche)
      if (!element) return
      element.classList.add('guide-anneau')
      element.setAttribute('data-guide-libelle', APPUYEZ_ICI[langue])
      element.addEventListener('click', surClic)
      const sansMouvement = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      element.scrollIntoView?.({ block: 'center', behavior: sansMouvement ? 'auto' : 'smooth' })
    }, 100)

    return () => {
      window.clearTimeout(fin)
      window.clearInterval(recherche)
      if (element) {
        element.classList.remove('guide-anneau')
        element.removeAttribute('data-guide-libelle')
        element.removeEventListener('click', surClic)
      }
    }
  }, [guide, langue])

  if (!etat || (!etat.disponible && messages.length === 0)) return null

  const auDessusEncaisser = !bureau && ecran === 'vente'
  const messageGuide = guide ? messages.find((m) => m.id === guide.idMessage) : undefined

  return (
    <>
      {etat.disponible && (bureau || !ouverte) && (
        <BoutonVocal
          variante="flottante"
          bureau={bureau}
          auDessusEncaisser={auDessusEncaisser}
          dureeMax={etat.duree_max_secondes}
          desactive={enAttente}
          surDebut={preparerSon}
          surEnvoi={envoyerVocal}
          surMicroIndisponible={definirMicroBloque}
          surEcrire={ecrirePlutot}
          langue={langue}
          surLangue={changerLangue}
          langueAChoisir={!langueChoisie}
        />
      )}

      {messageGuide && !ouverte && (
        <aside className={`guide-carte${bureau ? ' bureau' : ''}${auDessusEncaisser ? ' au-dessus-encaisser' : ''}`} aria-live="polite">
          <span className="guide-carte-icone" aria-hidden="true"><Mic size={16} strokeWidth={2.2} /></span>
          <p>{messageGuide.texte}</p>
          {messageGuide.son && (
            <button type="button" aria-label="Réécouter la réponse" onClick={() => lire(messageGuide)}>
              <Volume2 size={20} aria-hidden="true" />
            </button>
          )}
          <button type="button" className="discret" aria-label="Fermer" onClick={() => definirGuide(null)}>
            <X size={18} aria-hidden="true" />
          </button>
        </aside>
      )}

      {ouverte && (
        <>
          {!bureau && <div className="discussion-calque" aria-hidden="true" onClick={fermer} />}
          <DiscussionAssistant
            bureau={bureau}
            langue={langue}
            messages={messages}
            enAttente={enAttente}
            questionsRestantes={etat.questions_restantes}
            dureeMax={etat.duree_max_secondes}
            lecture={lecture}
            saisieDemandee={saisieDemandee}
            surLangue={changerLangue}
            surLecture={lire}
            surReessayer={reessayer}
            surEnvoiVocal={envoyerVocal}
            surEnvoiTexte={envoyerTexte}
            surMicroIndisponible={definirMicroBloque}
            surDebutGeste={preparerSon}
            surFermeture={fermer}
          />
        </>
      )}

      {microBloque && (
        <FeuilleMicroBloque raison={microBloque} bureau={bureau} surReessayer={() => definirMicroBloque(null)} surEcrire={ecrirePlutot} />
      )}
    </>
  )
}

function FeuilleMicroBloque({ raison, bureau, surReessayer, surEcrire }: {
  raison: RaisonMicro
  bureau: boolean
  surReessayer: () => void
  surEcrire: () => void
}) {
  // Installée sur l'écran d'accueil, l'application n'a pas de barre d'adresse.
  const installee = window.matchMedia?.('(display-mode: standalone)').matches
  const titre = { refuse: 'Le micro est bloqué', absent: 'Aucun micro trouvé', indisponible: 'Micro indisponible' }[raison]
  const explication = {
    refuse: 'Pour parler à l’assistant, autorisez le micro pour SamaCommerce.',
    absent: 'Branchez un micro ou un casque, puis réessayez.',
    indisponible: 'Ce navigateur ne permet pas d’enregistrer. Vous pouvez écrire votre question.',
  }[raison]

  return (
    <div className="fenetre-calque" style={{ alignItems: 'flex-end' }} onClick={surReessayer}>
      <div
        className="fenetre-boite micro-bloque"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-micro-bloque"
        style={{ maxWidth: 480, borderRadius: '22px 22px 0 0' }}
        onClick={(evenement) => evenement.stopPropagation()}
      >
        <div className="micro-bloque-icone" aria-hidden="true"><MicOff size={32} /></div>
        <h2 id="titre-micro-bloque">{titre}</h2>
        <p>{explication}</p>
        {raison === 'refuse' && (
          <ol>
            <li>
              <span aria-hidden="true"><Lock size={20} /></span>
              {installee ? 'Ouvrez les réglages du téléphone, puis Applications › SamaCommerce' : 'Touchez le cadenas, à gauche de l’adresse du site'}
            </li>
            <li><span aria-hidden="true"><Mic size={20} /></span>Choisissez « Micro », puis « Autoriser »</li>
            <li>
              <span aria-hidden="true"><Hand size={20} /></span>
              {bureau ? 'Revenez ici et cliquez sur le bouton vert' : 'Revenez ici et maintenez le bouton vert'}
            </li>
          </ol>
        )}
        <button type="button" className="bouton-principal" onClick={surReessayer}>Réessayer</button>
        <button type="button" className="bouton-annuler" onClick={surEcrire}>
          <Keyboard size={18} aria-hidden="true" />Écrire plutôt
        </button>
      </div>
    </div>
  )
}
