import { useEffect, useId, useRef, useState } from 'react'
import { Banknote, CheckCheck, Keyboard, Mic, Pause, Play, RotateCcw, SendHorizontal, X } from 'lucide-react'
import BoutonVocal from './BoutonVocal'
import { formaterDuree } from '../outils/gesteVocal'
import type { Enregistrement, RaisonMicro } from '../outils/enregistreurVocal'
import type { CarteChiffre, LangueAssistant } from '../outils/assistantVocal'

/* La discussion avec l'assistant, présentée comme une conversation WhatsApp :
   vos messages vocaux à droite (vert d'eau) avec ce que l'assistant a compris,
   ses réponses à gauche, lues à voix haute, avec le chiffre en grand. */

export type MessageDiscussion = {
  id: number
  auteur: 'vous' | 'assistant'
  heure: string
  /** Ce que l'assistant a compris (message vocal), la question tapée, ou sa réponse. */
  texte: string
  son: { url: string; duree: number | null; ondes: number[] } | null
  /** Réponse affichée, voix encore en préparation. */
  voixEnAttente?: boolean
  carte?: CarteChiffre | null
  /** Pour vos messages : envoyé, lu par l'assistant, ou resté sans réponse. */
  etat?: 'envoi' | 'lu' | 'erreur'
  /** Réponse qui annonce un échec (réseau, quota, Google saturé…). */
  erreur?: boolean
  /** Échec passager : le message de vous à renvoyer avec « Réessayer ». */
  erreurPour?: number
}

export type EtatLecture = { id: number; enCours: boolean; position: number }

type Proprietes = {
  bureau: boolean
  langue: LangueAssistant
  messages: MessageDiscussion[]
  enAttente: boolean
  questionsRestantes: number
  dureeMax: number
  lecture: EtatLecture | null
  /** Ouverte par « Écrire plutôt » : le clavier s'ouvre aussitôt. */
  saisieDemandee: boolean
  surLangue: (langue: LangueAssistant) => void
  surLecture: (message: MessageDiscussion) => void
  surReessayer: (message: MessageDiscussion) => void
  surEnvoiVocal: (enregistrement: Enregistrement) => void
  surEnvoiTexte: (texte: string) => void
  surMicroIndisponible: (raison: RaisonMicro) => void
  surDebutGeste: () => void
  surFermeture: () => void
}

/** Un exemple de question par langue, à toucher pour l'essayer. */
const EXEMPLES: Record<LangueAssistant, string> = {
  fr: 'Combien j’ai vendu aujourd’hui ?',
  wo: 'Tey ñaata laa jaay ?',
}

export default function DiscussionAssistant({
  bureau, langue, messages, enAttente, questionsRestantes, dureeMax, lecture, saisieDemandee,
  surLangue, surLecture, surReessayer, surEnvoiVocal, surEnvoiTexte, surMicroIndisponible, surDebutGeste, surFermeture,
}: Proprietes) {
  const [texte, definirTexte] = useState('')
  const fil = useRef<HTMLDivElement>(null)
  const panneau = useRef<HTMLElement>(null)
  const champ = useRef<HTMLInputElement>(null)
  const idTitre = useId()

  // Le dernier message reste visible, comme dans une discussion.
  useEffect(() => {
    if (fil.current) fil.current.scrollTop = fil.current.scrollHeight
  }, [messages.length, enAttente])

  // Le focus entre dans la discussion ; le clavier ne s'ouvre que si l'on a demandé à écrire.
  // Sans `preventScroll`, le navigateur faisait glisser toute l'application de côté.
  useEffect(() => {
    if (saisieDemandee) champ.current?.focus({ preventScroll: true })
    else panneau.current?.focus({ preventScroll: true })
  }, [saisieDemandee])

  // La coquille du téléphone ne défile jamais (overflow: hidden), mais son décor
  // déborde de 39 px : un champ qui prend le focus (ou le clavier qui s'ouvre)
  // pouvait la décaler, et l'écran entier se retrouvait coupé à gauche.
  useEffect(() => {
    const coquille = panneau.current?.closest<HTMLElement>('.conteneur-appli')
    if (!coquille) return
    const recaler = () => {
      if (coquille.scrollLeft) coquille.scrollLeft = 0
      if (coquille.scrollTop) coquille.scrollTop = 0
    }
    coquille.addEventListener('scroll', recaler)
    return () => coquille.removeEventListener('scroll', recaler)
  }, [])

  // Échap ferme la discussion — sauf pendant un enregistrement, qu'il annule seulement (BoutonVocal).
  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape' && !panneau.current?.querySelector('.vocal-verrou')) surFermeture()
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [surFermeture])

  const envoyerTexte = () => {
    const question = texte.trim()
    if (!question || enAttente) return
    definirTexte('')
    surEnvoiTexte(question)
  }

  return (
    <section
      ref={panneau}
      className={`discussion${bureau ? ' bureau' : ''}`}
      role="dialog"
      aria-modal={bureau ? undefined : true}
      aria-labelledby={idTitre}
      tabIndex={-1}
    >
      <header className="discussion-entete">
        <div className="discussion-poignee" aria-hidden="true" />
        <div className="discussion-titre">
          <span className="discussion-avatar" aria-hidden="true"><Mic size={20} strokeWidth={2.2} /></span>
          <div className="discussion-nom">
            <strong id={idTitre}>Assistant</strong>
            <span className="discussion-statut" aria-live="polite">
              {enAttente || messages.some((m) => m.voixEnAttente) ? 'prépare un audio…' : 'en ligne'}
            </span>
          </div>
          <div className="choix-langue" role="group" aria-label="Langue de l’assistant">
            <button type="button" aria-pressed={langue === 'wo'} onClick={() => surLangue('wo')}>Wolof</button>
            <button type="button" aria-pressed={langue === 'fr'} onClick={() => surLangue('fr')}>Français</button>
          </div>
          <button type="button" className="discussion-fermer" aria-label="Fermer la discussion" onClick={surFermeture}>
            <X size={22} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="discussion-fil" ref={fil}>
        <div className="discussion-jour">Aujourd’hui</div>

        {messages.length === 0 && (
          <div className="discussion-accueil">
            <p>Posez votre question à voix haute, en wolof ou en français. Par exemple :</p>
            <button type="button" className="discussion-exemple" onClick={() => surEnvoiTexte(EXEMPLES[langue])} disabled={enAttente}>
              « {EXEMPLES[langue]} »
            </button>
            <small>L’assistant lit vos chiffres et vous montre où appuyer. Il n’enregistre rien à votre place.</small>
          </div>
        )}

        {messages.map((message) => (
          <Bulle key={message.id} message={message} lecture={lecture?.id === message.id ? lecture : null}
            surLecture={surLecture} surReessayer={surReessayer} enAttente={enAttente} />
        ))}

        {enAttente && (
          <div className="message-attente" aria-label="L’assistant prépare sa réponse">
            <span className="attente-point" /><span className="attente-point" /><span className="attente-point" />
          </div>
        )}

        {questionsRestantes <= 5 && (
          <div className="discussion-quota">
            {questionsRestantes === 0
              ? 'Plus de questions pour aujourd’hui : l’assistant revient demain.'
              : `Encore ${questionsRestantes} question${questionsRestantes > 1 ? 's' : ''} aujourd’hui.`}
          </div>
        )}
      </div>

      <footer className="discussion-saisie">
        <BoutonVocal
          variante="compositeur"
          bureau={bureau}
          dureeMax={dureeMax}
          desactive={enAttente || questionsRestantes === 0}
          remplacement={texte.trim() ? (
            <button type="button" className="discussion-envoyer-texte" aria-label="Envoyer la question" onClick={envoyerTexte} disabled={enAttente}>
              <SendHorizontal size={22} aria-hidden="true" />
            </button>
          ) : undefined}
          surDebut={surDebutGeste}
          surEnvoi={surEnvoiVocal}
          surMicroIndisponible={surMicroIndisponible}
        >
          <label className="discussion-champ">
            <Keyboard size={20} aria-hidden="true" />
            <input
              ref={champ}
              value={texte}
              onChange={(evenement) => definirTexte(evenement.target.value)}
              onKeyDown={(evenement) => { if (evenement.key === 'Enter') envoyerTexte() }}
              placeholder="Écrire à l’assistant"
              aria-label="Écrire à l’assistant"
              maxLength={300}
              enterKeyHint="send"
              autoComplete="off"
            />
          </label>
        </BoutonVocal>
      </footer>
    </section>
  )
}

function Bulle({ message, lecture, enAttente, surLecture, surReessayer }: {
  message: MessageDiscussion
  lecture: EtatLecture | null
  enAttente: boolean
  surLecture: (message: MessageDiscussion) => void
  surReessayer: (message: MessageDiscussion) => void
}) {
  const vous = message.auteur === 'vous'
  const enCours = !!lecture?.enCours
  const ondesEnAttente = message.voixEnAttente && !message.son
  const barresLues = lecture ? Math.round(lecture.position * (message.son?.ondes.length ?? 0)) : 0
  const classes = ['message', message.auteur, message.erreur && 'erreur'].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      {message.son && (
        <div className="message-son">
          <button
            type="button"
            className="message-lecture"
            aria-label={enCours ? 'Mettre en pause' : vous ? 'Écouter votre message' : 'Écouter la réponse'}
            onClick={() => surLecture(message)}
          >
            {enCours ? <Pause size={14} fill="currentColor" aria-hidden="true" /> : <Play size={16} fill="currentColor" aria-hidden="true" />}
          </button>
          <span className="message-ondes" aria-hidden="true">
            {message.son.ondes.map((hauteur, i) => (
              <span key={i} className={i < barresLues ? 'lue' : undefined} style={{ height: `${Math.round(4 + hauteur * 22)}px` }} />
            ))}
          </span>
          {!vous && message.son.duree !== null && <span className="message-duree">{formaterDuree(message.son.duree)}</span>}
        </div>
      )}

      {ondesEnAttente && (
        <div className="message-son en-attente" aria-label="L’assistant prépare la réponse à voix haute">
          <span className="message-lecture" aria-hidden="true"><Play size={16} fill="currentColor" /></span>
          <span className="message-ondes" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => <span key={i} style={{ animationDelay: `${(i % 8) * 90}ms` }} />)}
          </span>
        </div>
      )}

      {message.texte && <p className="message-texte">{vous && message.son ? `« ${message.texte} »` : message.texte}</p>}

      {message.carte && (
        <div className="message-carte">
          <span className="message-carte-icone" aria-hidden="true"><Banknote size={22} /></span>
          <span>
            <strong>{message.carte.valeur}</strong>
            <span>{message.carte.libelle}</span>
          </span>
        </div>
      )}

      {message.erreurPour !== undefined && (
        <button type="button" className="message-reessayer" onClick={() => surReessayer(message)} disabled={enAttente}>
          <RotateCcw size={16} aria-hidden="true" />Réessayer
        </button>
      )}

      <div className="message-pied">
        {vous && message.son && <span>{formaterDuree(message.son.duree ?? 0)}</span>}
        <span className="lu">
          {message.heure}
          {vous && message.etat === 'lu' && <CheckCheck size={16} strokeWidth={2.4} aria-label="Lu" />}
        </span>
      </div>
    </div>
  )
}
