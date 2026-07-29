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
 * avec le cache hors-ligne. Au-delà de la limite dure, on refuse plutôt que de
 * faire grossir la base sans que le commerçant comprenne pourquoi ça rame.
 */

/** Côté maximal de l'image enregistrée (px). */
export const PHOTO_MAX_DIM = 256
/** Taille maximale de la data-URL produite (caractères ≈ octets). */
export const PHOTO_MAX_BYTES = 24 * 1024
/** Garde-fou serveur : au-delà, la requête est rejetée (cf. validation API). */
export const PHOTO_HARD_LIMIT = 60 * 1024

export class PhotoError extends Error {}

/** Charge le fichier en bitmap en respectant l'orientation EXIF du téléphone. */
async function decode(file: File): Promise<{ w: number; h: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    // imageOrientation: sans ça, les photos prises en portrait arrivent couchées.
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { w: bmp.width, h: bmp.height, draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h), close: () => bmp.close() }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new PhotoError('Image illisible'))
      el.src = url
    })
    return { w: img.naturalWidth, h: img.naturalHeight, draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h), close: () => URL.revokeObjectURL(url) }
  } catch (e) { URL.revokeObjectURL(url); throw e }
}

function toDataUrl(canvas: HTMLCanvasElement, type: string, quality: number): string {
  return canvas.toDataURL(type, quality)
}

/**
 * Réduit et compresse une photo en data-URL prête à enregistrer.
 * @throws PhotoError si le fichier n'est pas une image ou reste trop lourd.
 */
export async function compressPhoto(file: File, maxDim = PHOTO_MAX_DIM): Promise<string> {
  if (!file.type.startsWith('image/')) throw new PhotoError('Ce fichier n\'est pas une image')

  const src = await decode(file)
  try {
    const scale = Math.min(1, maxDim / Math.max(src.w, src.h))
    const w = Math.max(1, Math.round(src.w * scale))
    const h = Math.max(1, Math.round(src.h * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new PhotoError('Traitement d\'image indisponible')
    // Fond blanc : un PNG transparent aplati en JPEG deviendrait noir.
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h)
    src.draw(ctx, w, h)

    // WebP quand le navigateur sait le produire (≈ 30 % plus léger), sinon JPEG.
    const webpOk = toDataUrl(canvas, 'image/webp', 0.7).startsWith('data:image/webp')
    const type = webpOk ? 'image/webp' : 'image/jpeg'

    for (const q of [0.72, 0.6, 0.5, 0.4, 0.3]) {
      const url = toDataUrl(canvas, type, q)
      if (url.length <= PHOTO_MAX_BYTES) return url
    }
    // Dernier recours : on rétrécit encore une fois.
    if (maxDim > 128) return compressPhoto(file, 128)
    throw new PhotoError('Photo trop lourde, réessayez avec une image plus simple')
  } finally { src.close() }
}

/** Initiales d'un nom, repli quand il n'y a pas de photo (« Ndiaye Fall » → « NF »). */
export function initials(name?: string | null): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
