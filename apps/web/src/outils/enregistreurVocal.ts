/* Enregistreur du message vocal.

   L'oreille wolof (Soynade) n'accepte que le WAV, le MP3 ou le FLAC. Or
   MediaRecorder ne sait produire que du WebM/Opus (Chrome, Android) ou du MP4
   (Safari) : on capte donc les échantillons bruts du micro et on fabrique
   nous-mêmes un WAV mono 16 kHz — la fréquence des modèles de transcription,
   et un fichier quatre fois plus léger que l'enregistrement d'origine
   (30 secondes ≈ 940 Ko).

   ScriptProcessorNode est ancien mais disponible partout ; AudioWorklet
   exigerait de charger un module, ce que notre CSP (script-src 'self')
   n'autorise pas depuis un blob. */

export const FREQUENCE_CIBLE = 16000

export type RaisonMicro = 'refuse' | 'absent' | 'indisponible'

export class MicroIndisponible extends Error {
  readonly raison: RaisonMicro
  constructor(raison: RaisonMicro) {
    super(`Micro indisponible : ${raison}`)
    this.raison = raison
  }
}

export type Enregistrement = {
  wav: Blob
  /** Durée en secondes. */
  duree: number
  /** Hauteurs (0 à 1) des barres de l'onde dessinée dans la bulle. */
  ondes: number[]
}

type FenetreAudio = Window & { webkitAudioContext?: typeof AudioContext }

export class EnregistreurVocal {
  /** Niveau sonore (0 à 1), environ dix fois par seconde : il anime l'onde pendant l'écoute. */
  surNiveau?: (niveau: number) => void

  private flux?: MediaStream
  private contexte?: AudioContext
  private source?: MediaStreamAudioSourceNode
  private processeur?: ScriptProcessorNode
  private morceaux: Float32Array[] = []
  private frequence = 48000

  async demarrer(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) throw new MicroIndisponible('indisponible')
    try {
      this.flux = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch (erreur) {
      const nom = (erreur as DOMException)?.name
      if (nom === 'NotAllowedError' || nom === 'SecurityError') throw new MicroIndisponible('refuse')
      if (nom === 'NotFoundError' || nom === 'OverconstrainedError') throw new MicroIndisponible('absent')
      throw new MicroIndisponible('indisponible')
    }

    const Contexte = window.AudioContext || (window as FenetreAudio).webkitAudioContext
    if (!Contexte) {
      this.liberer()
      throw new MicroIndisponible('indisponible')
    }
    this.contexte = new Contexte()
    // Safari crée parfois le contexte « suspendu » : on le relance.
    if (this.contexte.state === 'suspended') await this.contexte.resume().catch(() => {})
    this.frequence = this.contexte.sampleRate
    this.morceaux = []

    this.source = this.contexte.createMediaStreamSource(this.flux)
    this.processeur = this.contexte.createScriptProcessor(4096, 1, 1)
    this.processeur.onaudioprocess = (evenement) => {
      const echantillons = new Float32Array(evenement.inputBuffer.getChannelData(0))
      this.morceaux.push(echantillons)
      this.surNiveau?.(niveauSonore(echantillons))
    }
    this.source.connect(this.processeur)
    // Sans sortie branchée, Chrome n'appelle jamais onaudioprocess. La sortie
    // reste silencieuse : on n'écrit rien dans le tampon de sortie.
    this.processeur.connect(this.contexte.destination)
  }

  /** Arrête l'écoute et rend le message prêt à envoyer. */
  arreter(): Enregistrement {
    const morceaux = this.morceaux
    const frequence = this.frequence
    this.liberer()
    const echantillons = reechantillonner(concatener(morceaux), frequence, FREQUENCE_CIBLE)
    return {
      wav: encoderWav(echantillons, FREQUENCE_CIBLE),
      duree: echantillons.length / FREQUENCE_CIBLE,
      ondes: calculerOndes(echantillons, 26),
    }
  }

  /** Arrête l'écoute sans rien garder (message annulé). */
  annuler(): void {
    this.liberer()
  }

  /** Coupe le micro : le voyant rouge du téléphone s'éteint aussitôt. */
  private liberer(): void {
    if (this.processeur) this.processeur.onaudioprocess = null
    this.processeur?.disconnect()
    this.source?.disconnect()
    this.flux?.getTracks().forEach((piste) => piste.stop())
    void this.contexte?.close().catch(() => {})
    this.processeur = undefined
    this.source = undefined
    this.flux = undefined
    this.contexte = undefined
    this.morceaux = []
  }
}

function concatener(morceaux: Float32Array[]): Float32Array {
  const total = morceaux.reduce((somme, morceau) => somme + morceau.length, 0)
  const resultat = new Float32Array(total)
  let position = 0
  for (const morceau of morceaux) {
    resultat.set(morceau, position)
    position += morceau.length
  }
  return resultat
}

/** Niveau sonore (0 à 1) d'un morceau : moyenne quadratique, amplifiée pour la voix. */
export function niveauSonore(echantillons: Float32Array): number {
  if (echantillons.length === 0) return 0
  let somme = 0
  for (const valeur of echantillons) somme += valeur * valeur
  return Math.min(1, Math.sqrt(somme / echantillons.length) * 4)
}

/**
 * Change la fréquence d'échantillonnage (48 kHz du micro → 16 kHz). Chaque
 * échantillon de sortie est la MOYENNE des échantillons qu'il couvre : un
 * filtre grossier, mais suffisant pour que la voix ne grésille pas.
 */
export function reechantillonner(entree: Float32Array, de: number, vers: number): Float32Array {
  if (de === vers) return entree
  const rapport = de / vers
  const sortie = new Float32Array(Math.floor(entree.length / rapport))
  for (let i = 0; i < sortie.length; i++) {
    const debut = Math.floor(i * rapport)
    const fin = Math.min(entree.length, Math.max(debut + 1, Math.floor((i + 1) * rapport)))
    let somme = 0
    for (let j = debut; j < fin; j++) somme += entree[j]
    sortie[i] = somme / (fin - debut)
  }
  return sortie
}

/** WAV PCM 16 bits mono, l'en-tête de 44 octets le plus classique. */
export function encoderWav(echantillons: Float32Array, frequence: number): Blob {
  const tampon = new ArrayBuffer(44 + echantillons.length * 2)
  const vue = new DataView(tampon)
  const ecrireTexte = (position: number, texte: string) => {
    for (let i = 0; i < texte.length; i++) vue.setUint8(position + i, texte.charCodeAt(i))
  }
  ecrireTexte(0, 'RIFF')
  vue.setUint32(4, 36 + echantillons.length * 2, true)
  ecrireTexte(8, 'WAVE')
  ecrireTexte(12, 'fmt ')
  vue.setUint32(16, 16, true) // taille du morceau « fmt »
  vue.setUint16(20, 1, true) // PCM
  vue.setUint16(22, 1, true) // mono
  vue.setUint32(24, frequence, true)
  vue.setUint32(28, frequence * 2, true) // octets par seconde
  vue.setUint16(32, 2, true) // octets par échantillon
  vue.setUint16(34, 16, true) // bits par échantillon
  ecrireTexte(36, 'data')
  vue.setUint32(40, echantillons.length * 2, true)
  let position = 44
  for (const valeur of echantillons) {
    const borne = Math.max(-1, Math.min(1, valeur))
    vue.setInt16(position, borne < 0 ? borne * 0x8000 : borne * 0x7fff, true)
    position += 2
  }
  return new Blob([tampon], { type: 'audio/wav' })
}

/** Les barres de l'onde : le pic de chaque tranche, rapporté au pic du message. */
export function calculerOndes(echantillons: Float32Array, nombre: number): number[] {
  const tranche = Math.max(1, Math.floor(echantillons.length / nombre))
  const pics: number[] = []
  for (let i = 0; i < nombre; i++) {
    let pic = 0
    const fin = Math.min(echantillons.length, (i + 1) * tranche)
    for (let j = i * tranche; j < fin; j++) pic = Math.max(pic, Math.abs(echantillons[j]))
    pics.push(pic)
  }
  const maximum = Math.max(...pics, 0.01)
  return pics.map((pic) => Math.max(0.12, pic / maximum))
}
