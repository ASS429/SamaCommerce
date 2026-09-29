/* S11 — Verrouillage local par code PIN au comptoir.
 *
 * Un téléphone de boutique passe de main en main : après une période
 * d'inactivité, l'application se verrouille et exige un code à 4 chiffres avant
 * de continuer. Le code est stocké HACHÉ (SHA-256 + sel) dans localStorage — il
 * protège contre un client curieux, pas contre un attaquant ayant un accès
 * physique complet à l'appareil. */

const CLE_CODE = 'samacommerce_code_pin'
const CLE_DELAI = 'samacommerce_delai_verrou' // minutes avant verrouillage
export const DELAI_VERROU_PAR_DEFAUT_MIN = 3

/* Le sel NE DOIT PAS changer : les codes déjà enregistrés sur les téléphones
   ont été hachés avec lui. Le modifier rendrait tous les codes faux, et le
   commerçant resterait bloqué hors de sa caisse. */
const SEL = 'samacommerce.v3'

async function hacher(code: string): Promise<string> {
  const octets = new TextEncoder().encode(SEL + ':' + code)
  const empreinte = await crypto.subtle.digest('SHA-256', octets)
  return Array.from(new Uint8Array(empreinte)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function aUnCode(): boolean {
  return !!localStorage.getItem(CLE_CODE)
}

export async function definirCode(code: string): Promise<void> {
  localStorage.setItem(CLE_CODE, await hacher(code))
}

export function retirerCode(): void {
  localStorage.removeItem(CLE_CODE)
}

export async function verifierCode(code: string): Promise<boolean> {
  const enregistre = localStorage.getItem(CLE_CODE)
  if (!enregistre) return true
  return enregistre === (await hacher(code))
}

export function lireDelaiVerrouMin(): number {
  const brut = localStorage.getItem(CLE_DELAI)
  const n = brut ? parseInt(brut, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : DELAI_VERROU_PAR_DEFAUT_MIN
}

export function definirDelaiVerrouMin(minutes: number): void {
  localStorage.setItem(CLE_DELAI, String(minutes))
}
