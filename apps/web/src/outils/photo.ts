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

export class ErreurPhoto extends Error {}

/** Charge le fichier en image en respectant l'orientation EXIF du téléphone. */
async function decoder(fichier: File): Promise<{ l: number; h: number; dessiner: (ctx: CanvasRenderingContext2D, l: number, h: number) => void; liberer: () => void }> {
  if (typeof createImageBitmap === 'function') {
    // imageOrientation : sans elle, les photos prises en portrait arrivent couchées.
    const image = await createImageBitmap(fichier, { imageOrientation: 'from-image' })
    return { l: image.width, h: image.height, dessiner: (ctx, l, h) => ctx.drawImage(image, 0, 0, l, h), liberer: () => image.close() }
  }
  const adresse = URL.createObjectURL(fichier)
  try {
    const image = await new Promise<HTMLImageElement>((resoudre, rejeter) => {
      const element = new Image()
      element.onload = () => resoudre(element)
      element.onerror = () => rejeter(new ErreurPhoto('Image illisible'))
      element.src = adresse
    })
    return { l: image.naturalWidth, h: image.naturalHeight, dessiner: (ctx, l, h) => ctx.drawImage(image, 0, 0, l, h), liberer: () => URL.revokeObjectURL(adresse) }
  } catch (e) { URL.revokeObjectURL(adresse); throw e }
}

function versDataUrl(toile: HTMLCanvasElement, type: string, qualite: number): string {
  return toile.toDataURL(type, qualite)
}

/**
 * Réduit et compresse une photo en data-URL prête à enregistrer.
 * @throws ErreurPhoto si le fichier n'est pas une image ou reste trop lourd.
 */
export async function compresserPhoto(fichier: File, coteMax = PHOTO_COTE_MAX): Promise<string> {
  if (!fichier.type.startsWith('image/')) throw new ErreurPhoto('Ce fichier n\'est pas une image')

  const source = await decoder(fichier)
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
    const webpPossible = versDataUrl(toile, 'image/webp', 0.7).startsWith('data:image/webp')
    const type = webpPossible ? 'image/webp' : 'image/jpeg'

    for (const qualite of [0.72, 0.6, 0.5, 0.4, 0.3]) {
      const dataUrl = versDataUrl(toile, type, qualite)
      if (dataUrl.length <= PHOTO_OCTETS_MAX) return dataUrl
    }
    // Dernier recours : on rétrécit encore une fois.
    if (coteMax > 128) return compresserPhoto(fichier, 128)
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
