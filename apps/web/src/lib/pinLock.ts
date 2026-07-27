/* S11 — Verrouillage local par PIN au comptoir.
 *
 * Un téléphone de boutique passe de main en main : après une période d'inactivité,
 * l'app se verrouille et exige un PIN à 4 chiffres avant de continuer. Le PIN est
 * stocké HASHÉ (SHA-256 + sel) dans localStorage — il protège contre un client
 * curieux, pas contre un attaquant ayant un accès physique complet à l'appareil. */

const PIN_KEY = 'samacommerce_pin'
const DELAY_KEY = 'samacommerce_pin_delay' // minutes avant verrouillage
export const DEFAULT_LOCK_DELAY_MIN = 3

async function hash(pin: string): Promise<string> {
  const salt = 'samacommerce.v3'
  const bytes = new TextEncoder().encode(salt + ':' + pin)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function hasPin(): boolean {
  return !!localStorage.getItem(PIN_KEY)
}

export async function setPin(pin: string): Promise<void> {
  localStorage.setItem(PIN_KEY, await hash(pin))
}

export function clearPin(): void {
  localStorage.removeItem(PIN_KEY)
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(PIN_KEY)
  if (!stored) return true
  return stored === (await hash(pin))
}

export function getLockDelayMin(): number {
  const raw = localStorage.getItem(DELAY_KEY)
  const n = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_LOCK_DELAY_MIN
}

export function setLockDelayMin(min: number): void {
  localStorage.setItem(DELAY_KEY, String(min))
}
