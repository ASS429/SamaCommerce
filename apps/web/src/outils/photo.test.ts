/* Lecture des photos : le défaut « Photo illisible » à chaque essai.
 *
 * Une seule méthode était tentée, avec une option que les navigateurs anciens
 * refusent : sur ces téléphones, TOUTES les photos échouaient. On simule ici
 * ces navigateurs pour vérifier que les méthodes de repli prennent le relais,
 * et que l'échec, quand il est réel, dit quoi faire. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compresserPhoto, estHeic, ErreurPhoto, lirePhoto, MESSAGE_HEIC, MESSAGE_ILLISIBLE } from './photo'

const photo = (nom = 'IMG_0001.jpg', type = 'image/jpeg') => new File([new Uint8Array([1, 2, 3])], nom, { type })

/** Bitmap simulé : `refuseOptions` imite Safari < 17 / Chrome < 110. */
function simulerBitmap({ refuseOptions = false, echoue = false } = {}) {
  const appels: unknown[] = []
  vi.stubGlobal('createImageBitmap', vi.fn(async (_f: File, options?: ImageBitmapOptions) => {
    appels.push(options ?? 'sans option')
    if (echoue) throw new DOMException('The source image could not be decoded.', 'InvalidStateError')
    if (options && refuseOptions) {
      throw new TypeError("Failed to read the 'imageOrientation' property from 'ImageBitmapOptions': The provided value 'from-image' is not a valid enum value.")
    }
    return { width: 4032, height: 3024, close: () => {} }
  }))
  return appels
}

/** Élément <img> simulé : jsdom ne décode aucune image. */
function simulerElementImage(lit: boolean) {
  class FausseImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    naturalWidth = 0
    naturalHeight = 0
    set src(_adresse: string) {
      setTimeout(() => {
        if (lit) { this.naturalWidth = 1600; this.naturalHeight = 1200; this.onload?.() } else this.onerror?.()
      }, 0)
    }
  }
  vi.stubGlobal('Image', FausseImage)
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:photo')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => vi.unstubAllGlobals())

describe('lirePhoto — trois méthodes, de la meilleure à la plus tolérante', () => {
  it('lit normalement la photo avec son orientation', async () => {
    const appels = simulerBitmap()
    simulerElementImage(true)
    const image = await lirePhoto(photo())
    expect(image.l).toBe(4032)
    expect(appels).toEqual([{ imageOrientation: 'from-image' }])
  })

  it('un navigateur qui refuse l\'option d\'orientation ne bloque PLUS la photo', async () => {
    simulerBitmap({ refuseOptions: true })
    simulerElementImage(true)
    const image = await lirePhoto(photo())
    expect(image.l).toBe(1600) // lue par l'élément <img>
  })

  it('en dernier recours, le bitmap sans option', async () => {
    const appels = simulerBitmap({ refuseOptions: true })
    simulerElementImage(false)
    const image = await lirePhoto(photo())
    expect(image.l).toBe(4032)
    expect(appels).toEqual([{ imageOrientation: 'from-image' }, 'sans option'])
  })

  it('HEIC illisible : dit quoi faire, et garde les trois causes techniques', async () => {
    simulerBitmap({ echoue: true })
    simulerElementImage(false)
    const echec = await lirePhoto(photo('IMG_0002.HEIC', 'image/heic')).catch((e) => e)
    expect(echec).toBeInstanceOf(ErreurPhoto)
    expect(echec.message).toBe(MESSAGE_HEIC)
    expect(echec.details).toHaveLength(3)
    expect(echec.details[0]).toContain('InvalidStateError')
  })

  it('autre format illisible : message général, jamais muet', async () => {
    simulerBitmap({ echoue: true })
    simulerElementImage(false)
    const echec = await lirePhoto(photo()).catch((e) => e)
    expect(echec.message).toBe(MESSAGE_ILLISIBLE)
    expect(echec.message).toContain('Prendre une photo')
  })
})

describe('estHeic', () => {
  it('reconnaît le HEIC par son type ou son extension', () => {
    expect(estHeic({ type: 'image/heic', name: 'a' })).toBe(true)
    expect(estHeic({ type: 'image/heif', name: 'a' })).toBe(true)
    expect(estHeic({ type: '', name: 'IMG_1234.HEIC' })).toBe(true)
    expect(estHeic({ type: 'image/jpeg', name: 'IMG_1234.jpg' })).toBe(false)
  })
})

describe('compresserPhoto — contrôle du type', () => {
  beforeEach(() => {
    // jsdom n'a pas de canvas : on s'arrête volontairement après la lecture.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  it('refuse un fichier qui n\'est pas une image', async () => {
    await expect(compresserPhoto(photo('facture.pdf', 'application/pdf'))).rejects.toThrow('n\'est pas une image')
  })

  it('accepte une photo SANS type (certains sélecteurs Android n\'en donnent pas)', async () => {
    simulerBitmap()
    const echec = await compresserPhoto(photo('photo', '')).catch((e) => e)
    // Elle a été lue : l'échec vient du canvas absent de jsdom, pas du type.
    expect(echec.message).toBe('Traitement d\'image indisponible')
  })
})
