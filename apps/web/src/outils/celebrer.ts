import confettis from 'canvas-confetti'

/* Design 3.4 — Célébration d'encaissement : pluie de confettis aux couleurs de
 * la marque. Respecte prefers-reduced-motion (accessibilité 3.7). */

const mouvementReduit = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const COULEURS_MARQUE = ['#7C3AED', '#A78BFA', '#EC4899', '#10B981', '#F59E0B']

export function pluieDeConfettis() {
  if (mouvementReduit()) return
  const tirer = (options: confettis.Options) => confettis({ colors: COULEURS_MARQUE, disableForReducedMotion: true, ...options })
  // Deux salves latérales qui convergent (600 ms, cf. spécification).
  tirer({ particleCount: 45, spread: 70, origin: { x: 0.2, y: 0.9 }, angle: 60, startVelocity: 45 })
  tirer({ particleCount: 45, spread: 70, origin: { x: 0.8, y: 0.9 }, angle: 120, startVelocity: 45 })
  setTimeout(() => tirer({ particleCount: 30, spread: 100, origin: { x: 0.5, y: 0.7 }, startVelocity: 35 }), 150)
}

/** Petite salve pour les micro-célébrations (objectif atteint, etc.). */
export function etincelles(x = 0.5, y = 0.5) {
  if (mouvementReduit()) return
  confettis({ particleCount: 20, spread: 55, origin: { x, y }, colors: COULEURS_MARQUE, scalar: 0.8, disableForReducedMotion: true })
}
