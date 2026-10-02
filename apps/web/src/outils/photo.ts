/* Photos (produits, clients, fournisseurs, employés, boutiques).
 *
 * POURQUOI. Un pictogramme générique ne distingue pas deux sacs de riz de
 * marques différentes, et un nom écrit ne sert à rien à qui ne lit pas. La
 * photo prise avec le téléphone est l'identification la plus fiable pour nos
 * utilisateurs : on reconnaît SON produit, SON client, SON fournisseur.
 *
 * COMMENT. Pas de serveur de fichiers (Render a un disque éphémère, et ajouter
 * un stockage objet compliquerait le déploiement). La photo est donc réduite
 * CÔTÉ TÉLÉPHONE puis stockée en data-URL dans la ligne de l'entité.
 *
 * Le budget est strict — on est souvent en 3G au marché :
 *   256 px de côté, WebP (repli JPEG), qualité dégressive jusqu'à ≤ 24 Ko.
 * Une photo pèse alors 4 à 10 Ko : 200 produits photographiés ≈ 1 Mo, mutualisé
 * avec le cache hors ligne. Au-delà de la limite dure, on refuse plutôt que de
 * faire grossir la base sans que le commerçant comprenne pourquoi ça rame.
 */

/** Côté maximal de l'image enregistrée (px). */
export const PHOTO_COTE_MAX = 256
/** Taille maximale de la data-URL produite (caractères ≈ octets). */
export const PHOTO_OCTETS_MAX = 24 * 1024
/** Garde-fou serveur : au-delà, la requête est rejetée (cf. validation API). */
export const PHOTO_LIMITE_DURE = 60 * 1024

/**
 * Échec compréhensible par le commerçant : `message` dit quoi faire.
 * `details` garde les causes techniques, pour le signalement au serveur.
 */
export class ErreurPhoto extends Error {
  details: string[]
  constructor(message: string, details: string[] = []) {
    super(message)
    this.details = details
  }
}

/** Image prête à être dessinée, quelle que soit la manière dont on l'a lue. */
type ImageLue = { l: number; h: number; dessiner: (ctx: CanvasRenderingContext2D, l: number, h: number) => void; liberer: () => void }

/** Photo HEIC/HEIF (iPhone, certains Samsung) : Safari la lit, Chrome non. */
export function estHeic(fichier: Pick<File, 'type' | 'name'>): boolean {
  return /hei[cf]/i.test(fichier.type) || /\.(heic|heif)$/i.test(fichier.name)
}

export const MESSAGE_HEIC = '📷 Cette photo est au format HEIC, que ce téléphone ne sait pas lire. '
  + 'Utilisez « Prendre une photo », ou réglez l\'appareil photo sur JPEG (« le plus compatible »).'
export const MESSAGE_ILLISIBLE = '📷 Cette photo n\'a pas pu être lue. Essayez « Prendre une photo », ou choisissez une autre image.'

async function lireAvecBitmap(fichier: File, options?: ImageBitmapOptions): Promise<ImageLue> {
  const image = options ? await createImageBitmap(fichier, options) : await createImageBitmap(fichier)
  return { l: image.width, h: image.height, dessiner: (ctx, l, h) => ctx.drawImage(image, 0, 0, l, h), liberer: () => image.close() }
}

async function lireAvecElementImage(fichier: File): Promise<ImageLue> {
  const adresse = URL.createObjectURL(fichier)
  try {
    const image = await new Promise<HTMLImageElement>((resoudre, rejeter) => {
      const element = new Image()
      element.onload = () => resoudre(element)
      element.onerror = () => rejeter(new Error('le navigateur ne décode pas ce fichier'))
      element.src = adresse
    })
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('image vide')
    return { l: image.naturalWidth, h: image.naturalHeight, dessiner: (ctx, l, h) => ctx.drawImage(image, 0, 0, l, h), liberer: () => URL.revokeObjectURL(adresse) }
  } catch (e) { URL.revokeObjectURL(adresse); throw e }
}

/**
 * Lit la photo en essayant trois méthodes, de la meilleure à la plus tolérante.
 *
 * POURQUOI. Une seule méthode était tentée, avec l'option
 * `imageOrientation: 'from-image'`. Les navigateurs qui ne connaissent pas
 * cette valeur (Safari avant iOS 17, Chrome avant la version 110) REFUSENT
 * alors tout l'appel : sur ces téléphones, chaque photo échouait, et
 * l'utilisateur ne voyait que « Photo illisible ».
 *
 *   1. createImageBitmap avec l'orientation EXIF (portrait remis droit) ;
 *   2. élément <img> : le plus ancien, qui applique lui aussi l'orientation ;
 *   3. createImageBitmap sans option, en dernier recours.
 *
 * @throws ErreurPhoto avec un message qui dit quoi faire, et les causes
 *         techniques de chaque tentative dans `details`.
 */
export async function lirePhoto(fichier: File): Promise<ImageLue> {
  const tentatives: [string, () => Promise<ImageLue>][] = []
  const bitmap = typeof createImageBitmap === 'function'
  if (bitmap) tentatives.push(['bitmap orienté', () => lireAvecBitmap(fichier, { imageOrientation: 'from-image' })])
  tentatives.push(['élément image', () => lireAvecElementImage(fichier)])
  if (bitmap) tentatives.push(['bitmap simple', () => lireAvecBitmap(fichier)])

  const echecs: string[] = []
  for (const [nom, tenter] of tentatives) {
    try {
      return await tenter()
    } catch (e) {
      const erreur = e as { name?: string; message?: string }
      echecs.push(`${nom} : ${erreur?.name || 'Erreur'} ${erreur?.message || String(e)}`)
    }
  }
  throw new ErreurPhoto(estHeic(fichier) ? MESSAGE_HEIC : MESSAGE_ILLISIBLE, echecs)
}

function encoder(toile: HTMLCanvasElement, type: string, qualite: number): string {
  return toile.toDataURL(type, qualite)
}

/** Capture du SMS de paiement : la référence doit rester LISIBLE par l'administrateur. */
export const RECU_COTE_MAX = 1000
export const RECU_OCTETS_MAX = 150 * 1024

/**
 * Réduit et compresse une photo en data-URL prête à enregistrer.
 * @throws ErreurPhoto si le fichier n'est pas une image ou reste trop lourd.
 */
export async function compresserPhoto(fichier: File, coteMax = PHOTO_COTE_MAX, octetsMax = PHOTO_OCTETS_MAX): Promise<string> {
  // Type VIDE accepté : certains sélecteurs Android (gestionnaire de fichiers,
  // Drive) n'en donnent pas pour une vraie photo. Le décodage tranchera.
  if (fichier.type && !fichier.type.startsWith('image/')) throw new ErreurPhoto('Ce fichier n\'est pas une image')

  const source = await lirePhoto(fichier)
  try {
    const echelle = Math.min(1, coteMax / Math.max(source.l, source.h))
    const l = Math.max(1, Math.round(source.l * echelle))
    const h = Math.max(1, Math.round(source.h * echelle))

    const toile = document.createElement('canvas')
    toile.width = l; toile.height = h
    const ctx = toile.getContext('2d')
    if (!ctx) throw new ErreurPhoto('Traitement d\'image indisponible')
    // Fond blanc : un PNG transparent aplati en JPEG deviendrait noir.
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, l, h)
    source.dessiner(ctx, l, h)

    // WebP quand le navigateur sait le produire (≈ 30 % plus léger), sinon JPEG.
    const webpPossible = encoder(toile, 'image/webp', 0.7).startsWith('data:image/webp')
    const type = webpPossible ? 'image/webp' : 'image/jpeg'

    for (const qualite of [0.72, 0.6, 0.5, 0.4, 0.3]) {
      const encodee = encoder(toile, type, qualite)
      if (encodee.length <= octetsMax) return encodee
    }
    // Dernier recours : on rétrécit encore une fois (par paliers pour une
    // grande image, d'un coup à 128 px pour une vignette).
    if (coteMax > 128) return compresserPhoto(fichier, coteMax > PHOTO_COTE_MAX ? Math.round(coteMax * 0.7) : 128, octetsMax)
    throw new ErreurPhoto('Photo trop lourde, réessayez avec une image plus simple')
  } finally { source.liberer() }
}

/** Initiales d'un nom, repli quand il n'y a pas de photo (« Ndiaye Fall » → « NF »). */
export function initiales(nom?: string | null): string {
  const parties = String(nom || '').trim().split(/\s+/).filter(Boolean)
  if (parties.length === 0) return '?'
  if (parties.length === 1) return parties[0].slice(0, 2).toUpperCase()
  return (parties[0][0] + parties[parties.length - 1][0]).toUpperCase()
}
