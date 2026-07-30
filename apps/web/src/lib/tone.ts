/* Familles de couleur des surfaces pleines (cf. theme.css § SURFACES EN COULEUR).
 *
 * Pourquoi une fonction plutôt qu'un index de boucle : une catégorie doit
 * garder LA MÊME couleur d'une session à l'autre. Si la teinte venait de la
 * position dans la liste, ajouter « Boissons » repeindrait tout le reste — et
 * le commerçant qui repère son rayon au rose ne le retrouverait plus. On la
 * déduit donc du nom, comme les pictogrammes et les pastilles de produits.
 */

export const TONES = ['green', 'blue', 'violet', 'orange', 'teal', 'pink'] as const
export type Tone = (typeof TONES)[number]

/** Teinte stable déduite du nom. Même nom ⇒ même couleur, toujours. */
export function toneOf(name?: string | null): Tone {
  const s = name || ''
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return TONES[h % TONES.length]
}
