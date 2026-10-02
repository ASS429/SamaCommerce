import { afterEach, describe, expect, it, vi } from 'vitest'
import { EnregistreurVocal, MicroIndisponible, calculerOndes, encoderWav, niveauSonore, reechantillonner } from './enregistreurVocal'

const lire = async (son: Blob) => new DataView(await son.arrayBuffer())
const texte = (vue: DataView, position: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => vue.getUint8(position + i)))

afterEach(() => vi.unstubAllGlobals())

describe('Le message vocal envoyé à l’oreille (WAV mono 16 kHz)', () => {
  it('écrit un en-tête WAV que Soynade accepte', async () => {
    const vue = await lire(encoderWav(new Float32Array([0, 1, -1, 0.5]), 16000))

    expect(texte(vue, 0)).toBe('RIFF')
    expect(texte(vue, 8)).toBe('WAVE')
    expect(texte(vue, 12)).toBe('fmt ')
    expect(vue.getUint16(20, true)).toBe(1) // PCM
    expect(vue.getUint16(22, true)).toBe(1) // mono
    expect(vue.getUint32(24, true)).toBe(16000)
    expect(vue.getUint32(28, true)).toBe(32000) // octets par seconde
    expect(texte(vue, 36)).toBe('data')
    expect(vue.getUint32(40, true)).toBe(8)
    expect([0, 1, 2, 3].map((i) => vue.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 16383])
  })

  it('ramène les 48 kHz du micro à 16 kHz en moyennant les échantillons', () => {
    const sortie = reechantillonner(new Float32Array([0, 0, 3, 3, 3, 3]), 48000, 16000)
    expect(Array.from(sortie)).toEqual([1, 3])
    expect(reechantillonner(new Float32Array(48000), 48000, 16000)).toHaveLength(16000)
  })

  it('dessine l’onde de la bulle : des barres rapportées au pic, jamais tout à fait plates', () => {
    const ondes = calculerOndes(new Float32Array([0, 0, 0.5, 0.5, 1, 1, 0, 0]), 4)
    expect(ondes).toEqual([0.12, 0.5, 1, 0.12])
  })

  it('mesure le niveau sonore pour animer l’écoute', () => {
    expect(niveauSonore(new Float32Array(100))).toBe(0)
    expect(niveauSonore(new Float32Array(100).fill(0.5))).toBe(1)
  })
})

describe('L’accès au micro', () => {
  it('un micro refusé par le commerçant est signalé comme tel', async () => {
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('non', 'NotAllowedError')) } })
    await expect(new EnregistreurVocal().demarrer()).rejects.toMatchObject({ raison: 'refuse' })
  })

  it('un appareil sans micro est signalé comme tel', async () => {
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('rien', 'NotFoundError')) } })
    await expect(new EnregistreurVocal().demarrer()).rejects.toMatchObject({ raison: 'absent' })
  })

  it('un navigateur sans enregistrement est signalé comme tel', async () => {
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: undefined })
    await expect(new EnregistreurVocal().demarrer()).rejects.toBeInstanceOf(MicroIndisponible)
  })
})
