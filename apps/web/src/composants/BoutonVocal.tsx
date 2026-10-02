import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronUp, Lock, Mic, SendHorizontal, Trash2 } from 'lucide-react'
import { EnregistreurVocal, MicroIndisponible, type Enregistrement, type RaisonMicro } from '../outils/enregistreurVocal'
import { deciderGeste, estAppuiCourt, formaterDuree, suivreDoigt } from '../outils/gesteVocal'
import { vibration } from '../outils/vibrations'
import type { LangueAssistant } from '../outils/assistantVocal'

/* Le bouton vocal, avec le geste de WhatsApp (cf. outils/gesteVocal) :
   maintenir pour parler, relâcher pour envoyer, glisser à gauche pour annuler,
   glisser vers le haut pour parler mains libres. À la souris, un clic suffit
   (comme WhatsApp Web) : l'enregistrement démarre déjà « verrouillé ».

   Deux variantes : `flottante` (au-dessus de chaque écran) et `compositeur`
   (le bas de la discussion, où le champ de texte cède la place à
   l'enregistrement — exactement comme dans une conversation WhatsApp). */

type Mode = 'repos' | 'enregistre' | 'verrouille' | 'annule'

type Proprietes = {
  variante: 'flottante' | 'compositeur'
  bureau?: boolean
  /** Écran Vendre : le micro se place au-dessus du bouton ENCAISSER. */
  auDessusEncaisser?: boolean
  dureeMax: number
  desactive?: boolean
  /** Remplace le micro : le bouton « envoyer » quand une question est tapée. */
  remplacement?: ReactNode
  /** Le champ de texte du compositeur, masqué pendant l'enregistrement. */
  children?: ReactNode
  /** Appelé pendant le geste lui-même (le seul moment où Safari autorise à préparer le son). */
  surDebut?: () => void
  surEnvoi: (enregistrement: Enregistrement) => void
  surMicroIndisponible: (raison: RaisonMicro) => void
  /** « Écrire plutôt », proposé dans l'info-bulle du bouton flottant. */
  surEcrire?: () => void
  /** Langue d'écoute : rappelée sur le bouton flottant, modifiable dans son info-bulle. */
  langue?: LangueAssistant
  surLangue?: (langue: LangueAssistant) => void
  /** Premier usage : la langue se choisit avant le premier message. */
  langueAChoisir?: boolean
}

const NOMS_LANGUES: Record<LangueAssistant, string> = { wo: 'wolof', fr: 'français' }

const NOMBRE_ONDES = 30
const ONDES_AU_REPOS = Array<number>(NOMBRE_ONDES).fill(0.08)
/** Un message plus court n'est qu'un souffle : on explique le geste au lieu de l'envoyer. */
const DUREE_MIN_SECONDES = 0.6

export default function BoutonVocal({
  variante, bureau = false, auDessusEncaisser = false, dureeMax, desactive = false,
  remplacement, children, surDebut, surEnvoi, surMicroIndisponible, surEcrire, langue, surLangue, langueAChoisir = false,
}: Proprietes) {
  const [mode, definirMode] = useState<Mode>('repos')
  const [secondes, definirSecondes] = useState(0)
  const [aide, definirAide] = useState(false)
  const [ondes, definirOndes] = useState(ONDES_AU_REPOS)

  // Tout ce que lisent les gestionnaires et les minuteurs passe par des refs :
  // un minuteur lancé au début de l'enregistrement doit voir l'état d'AUJOURD'HUI.
  const modeActuel = useRef<Mode>('repos')
  const enregistreur = useRef<EnregistreurVocal | null>(null)
  const pret = useRef(false)
  const session = useRef(0)
  const depart = useRef<{ x: number; y: number; t: number } | null>(null)
  const dernierPoint = useRef<{ x: number; t: number } | null>(null)
  const debutEcoute = useRef(0)
  const minuteurs = useRef<{ chrono?: number; aide?: number; retour?: number }>({})
  const micro = useRef<HTMLButtonElement>(null)
  const glisser = useRef<HTMLSpanElement>(null)
  const cadenas = useRef<HTMLSpanElement>(null)
  const rappels = useRef({ surDebut, surEnvoi, surMicroIndisponible, dureeMax })
  rappels.current = { surDebut, surEnvoi, surMicroIndisponible, dureeMax }

  const changerMode = (nouveau: Mode) => {
    modeActuel.current = nouveau
    definirMode(nouveau)
  }

  const arreterChrono = () => window.clearInterval(minuteurs.current.chrono)

  const remettreAuRepos = () => {
    arreterChrono()
    changerMode('repos')
    definirSecondes(0)
    definirOndes(ONDES_AU_REPOS)
  }

  /** Coupe le micro et oublie ce qui a été capté. */
  const fermerMicro = () => {
    session.current++
    enregistreur.current?.annuler()
    enregistreur.current = null
    pret.current = false
    arreterChrono()
  }

  const montrerAide = () => {
    window.clearTimeout(minuteurs.current.aide)
    definirAide(true)
    // Avec des boutons dedans (langue, « Écrire plutôt »), on laisse le temps de choisir.
    minuteurs.current.aide = window.setTimeout(() => definirAide(false), surEcrire || surLangue ? 6000 : 2600)
  }

  const choisirLangue = (choisie: LangueAssistant) => {
    surLangue?.(choisie)
    montrerAide() // l'info-bulle reste, et explique maintenant le geste
  }

  const envoyer = () => {
    const actuel = enregistreur.current
    if (!actuel || !pret.current) {
      fermerMicro()
      remettreAuRepos()
      return
    }
    session.current++
    enregistreur.current = null
    pret.current = false
    const enregistrement = actuel.arreter()
    remettreAuRepos()
    if (enregistrement.duree < DUREE_MIN_SECONDES) {
      montrerAide()
      return
    }
    vibration.toucher()
    rappels.current.surEnvoi(enregistrement)
  }

  const annuler = () => {
    fermerMicro()
    depart.current = null
    definirSecondes(0)
    changerMode('annule')
    vibration.avertissement()
    window.clearTimeout(minuteurs.current.retour)
    minuteurs.current.retour = window.setTimeout(() => {
      if (modeActuel.current === 'annule') remettreAuRepos()
    }, 900)
  }

  const verrouiller = () => {
    depart.current = null
    changerMode('verrouille')
    vibration.toucher()
  }

  const lancerChrono = () => {
    arreterChrono()
    debutEcoute.current = Date.now()
    definirSecondes(0)
    minuteurs.current.chrono = window.setInterval(() => {
      const ecoule = (Date.now() - debutEcoute.current) / 1000
      definirSecondes(ecoule)
      // Au-delà de la durée permise, le message part tout seul.
      if (ecoule >= rappels.current.dureeMax) envoyer()
    }, 200)
  }

  const ouvrirMicro = async () => {
    const numero = ++session.current
    pret.current = false
    const nouveau = new EnregistreurVocal()
    nouveau.surNiveau = (niveau) => {
      if (modeActuel.current === 'verrouille') definirOndes((anciennes) => [...anciennes.slice(1), Math.max(0.08, niveau)])
    }
    enregistreur.current = nouveau
    try {
      await nouveau.demarrer()
    } catch (erreur) {
      if (numero !== session.current) return
      enregistreur.current = null
      depart.current = null
      remettreAuRepos()
      rappels.current.surMicroIndisponible(erreur instanceof MicroIndisponible ? erreur.raison : 'indisponible')
      return
    }
    // Relâché ou annulé pendant que le téléphone ouvrait le micro.
    if (numero !== session.current) {
      nouveau.annuler()
      return
    }
    pret.current = true
    lancerChrono()
  }

  const commencer = (verrouille: boolean) => {
    window.clearTimeout(minuteurs.current.aide)
    definirAide(false)
    rappels.current.surDebut?.()
    changerMode(verrouille ? 'verrouille' : 'enregistre')
    vibration.toucher()
    void ouvrirMicro()
  }

  const appuyer = (evenement: PointerEvent<HTMLButtonElement>) => {
    if (desactive || modeActuel.current !== 'repos') return
    // Tout premier message : d'abord la langue, sinon l'oreille écouterait dans la mauvaise.
    if (langueAChoisir && surLangue) {
      evenement.preventDefault()
      montrerAide()
      return
    }
    if (evenement.pointerType === 'mouse') {
      if (evenement.button !== 0) return
      evenement.preventDefault()
      commencer(true)
      return
    }
    try { evenement.currentTarget.setPointerCapture(evenement.pointerId) } catch { /* capture indisponible */ }
    depart.current = { x: evenement.clientX, y: evenement.clientY, t: Date.now() }
    dernierPoint.current = { x: evenement.clientX, t: Date.now() }
    commencer(false)
  }

  const deplacer = (evenement: PointerEvent<HTMLButtonElement>) => {
    if (modeActuel.current !== 'enregistre' || !depart.current) return
    const dx = evenement.clientX - depart.current.x
    const dy = evenement.clientY - depart.current.y
    // Vitesse mesurée sur au moins 16 ms : entre deux événements très
    // rapprochés, elle s'affolerait au moindre tremblement.
    let vitesseX = 0
    const maintenant = Date.now()
    if (dernierPoint.current && maintenant - dernierPoint.current.t >= 16) {
      vitesseX = (evenement.clientX - dernierPoint.current.x) / (maintenant - dernierPoint.current.t)
      dernierPoint.current = { x: evenement.clientX, t: maintenant }
    }
    const decision = deciderGeste(dx, dy, vitesseX)
    if (decision === 'annuler') return annuler()
    if (decision === 'verrouiller') return verrouiller()

    // Le bouton suit le doigt : on écrit directement dans le style, sans
    // redessiner le composant à chaque pixel.
    const { x, y } = suivreDoigt(dx, dy)
    if (micro.current) micro.current.style.transform = `translate(${x}px, ${y}px) scale(1.5)`
    if (glisser.current) {
      glisser.current.style.transform = `translateX(${Math.round(x * 0.6)}px)`
      glisser.current.style.opacity = String(Math.max(0.2, 1 + x / 150))
    }
    if (cadenas.current) cadenas.current.style.transform = `translateY(${Math.round(y * 0.5)}px)`
  }

  const relacher = () => {
    if (modeActuel.current !== 'enregistre' || !depart.current) return
    const duree = Date.now() - depart.current.t
    depart.current = null
    // Simple toucher, ou micro pas encore ouvert (première autorisation) : on explique.
    if (!pret.current || estAppuiCourt(duree)) {
      fermerMicro()
      remettreAuRepos()
      montrerAide()
      return
    }
    envoyer()
  }

  const interrompre = () => {
    // Appel entrant, défilement repris par le navigateur… : comme WhatsApp, on annule.
    if (modeActuel.current === 'enregistre') annuler()
  }

  // Au clavier (Entrée, Espace), le bouton se comporte comme au clic de souris.
  const surClic = (evenement: MouseEvent<HTMLButtonElement>) => {
    if (evenement.detail !== 0 || desactive || modeActuel.current !== 'repos') return
    if (langueAChoisir && surLangue) montrerAide()
    else commencer(true)
  }

  // Échap abandonne l'enregistrement verrouillé.
  useEffect(() => {
    if (mode !== 'verrouille') return
    const surTouche = (evenement: KeyboardEvent) => { if (evenement.key === 'Escape') annuler() }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  })

  // Composant retiré (changement d'écran, déconnexion) : le micro s'éteint.
  useEffect(() => () => {
    session.current++
    enregistreur.current?.annuler()
    const { chrono, aide: minuteurAide, retour } = minuteurs.current
    window.clearInterval(chrono)
    window.clearTimeout(minuteurAide)
    window.clearTimeout(retour)
  }, [])

  const classes = ['vocal-ligne', variante, bureau && 'bureau', auDessusEncaisser && 'au-dessus-encaisser'].filter(Boolean).join(' ')
  const chrono = formaterDuree(secondes)
  const bientotFini = secondes >= dureeMax - 5

  return (
    <div className={classes}>
      {variante === 'compositeur' && mode === 'repos' && children}

      {mode === 'enregistre' && <div className="vocal-voile" aria-hidden="true" />}
      {mode === 'enregistre' && (
        <div className="vocal-barre" role="status">
          {/* Le repère est opaque : le texte « Glisser » passe dessous, comme sur WhatsApp. */}
          <span className="vocal-repere">
            <span className="vocal-point" aria-hidden="true" />
            <span className={`vocal-chrono${bientotFini ? ' bientot' : ''}`} aria-label={`Enregistrement : ${chrono}`}>{chrono}</span>
          </span>
          <span className="vocal-glisser" ref={glisser}>
            <ChevronLeft size={18} aria-hidden="true" />Glisser pour annuler
          </span>
        </div>
      )}
      {mode === 'enregistre' && (
        <div className="vocal-cadenas" aria-hidden="true">
          <span className="vocal-cadenas-icone" ref={cadenas}><Lock size={20} /></span>
          <ChevronUp size={20} className="vocal-monte" />
        </div>
      )}

      {mode === 'annule' && (
        <div className="vocal-annule" role="status"><Trash2 size={22} aria-hidden="true" />Message annulé</div>
      )}

      {mode === 'verrouille' && (
        <section className="vocal-verrou" aria-label="Enregistrement en cours">
          <div className="vocal-verrou-aide">
            <Lock size={15} aria-hidden="true" />{bureau ? 'Parlez, puis envoyez' : 'Vous pouvez lâcher le bouton'}
          </div>
          <div className="vocal-verrou-piste">
            <span className="vocal-point" aria-hidden="true" />
            <span className={`vocal-chrono${bientotFini ? ' bientot' : ''}`} aria-label={`Enregistrement : ${chrono}`}>{chrono}</span>
            <span className="vocal-ondes" aria-hidden="true">
              {ondes.map((hauteur, i) => <span key={i} className="vocal-onde" style={{ transform: `scaleY(${((4 + hauteur * 24) / 28).toFixed(2)})` }} />)}
            </span>
          </div>
          <div className="vocal-verrou-actions">
            <button type="button" className="vocal-supprimer" aria-label="Supprimer l’enregistrement" onClick={annuler}>
              <Trash2 size={24} aria-hidden="true" />
            </button>
            <span>Toujours à l’écoute</span>
            <button type="button" className="vocal-envoyer" aria-label="Envoyer à l’assistant" onClick={envoyer}>
              <SendHorizontal size={26} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {aide && (
        <div className="vocal-aide" role={surLangue || surEcrire ? 'dialog' : 'tooltip'} aria-label="Aide du bouton vocal" id={`aide-vocal-${variante}`}>
          {langueAChoisir && surLangue
            ? <strong>Vous allez parler en quelle langue ?</strong>
            : (bureau ? 'Cliquez pour parler, puis envoyez' : 'Maintenez pour enregistrer, relâchez pour envoyer')}
          {surLangue && langue && (
            <div className="vocal-aide-langues" role="group" aria-label="Langue de l’assistant">
              <button type="button" aria-pressed={!langueAChoisir && langue === 'wo'} onClick={() => choisirLangue('wo')}>Wolof</button>
              <button type="button" aria-pressed={!langueAChoisir && langue === 'fr'} onClick={() => choisirLangue('fr')}>Français</button>
            </div>
          )}
          {surEcrire && !langueAChoisir && (
            <button type="button" className="vocal-aide-ecrire" onClick={() => { definirAide(false); surEcrire() }}>Écrire plutôt</button>
          )}
        </div>
      )}

      {mode !== 'verrouille' && (remplacement ?? (
        <button
          ref={micro}
          type="button"
          className={`vocal-micro${mode === 'enregistre' ? ' enregistre' : ''}`}
          aria-label={`Parler à l’assistant${langue && !langueAChoisir ? ` en ${NOMS_LANGUES[langue]}` : ''} : ${bureau ? 'cliquez' : 'maintenez'} pour enregistrer`}
          aria-describedby={aide ? `aide-vocal-${variante}` : undefined}
          disabled={desactive}
          style={mode === 'enregistre' ? { transform: 'scale(1.5)' } : undefined}
          onPointerDown={appuyer}
          onPointerMove={deplacer}
          onPointerUp={relacher}
          onPointerCancel={interrompre}
          onContextMenu={(evenement) => evenement.preventDefault()}
          onClick={surClic}
        >
          <Mic size={variante === 'compositeur' ? 22 : 24} strokeWidth={2.2} aria-hidden="true" />
          {variante === 'flottante' && langue && !langueAChoisir && (
            <span className="vocal-langue" aria-hidden="true">{langue === 'wo' ? 'WO' : 'FR'}</span>
          )}
        </button>
      ))}
    </div>
  )
}
