import confettiLib from 'canvas-confetti'

/* Design 3.4 — Célébration d'encaissement : pluie de confettis aux couleurs de
 * la marque. Respecte prefers-reduced-motion (accessibilité 3.7). */

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const BRAND = ['#7C3AED', '#A78BFA', '#EC4899', '#10B981', '#F59E0B']

export function confetti() {
  if (reduced()) return
  const shoot = (opts: confettiLib.Options) => confettiLib({ colors: BRAND, disableForReducedMotion: true, ...opts })
  // Deux salves latérales qui convergent (600 ms, cf. spec).
  shoot({ particleCount: 45, spread: 70, origin: { x: 0.2, y: 0.9 }, angle: 60, startVelocity: 45 })
  shoot({ particleCount: 45, spread: 70, origin: { x: 0.8, y: 0.9 }, angle: 120, startVelocity: 45 })
  setTimeout(() => shoot({ particleCount: 30, spread: 100, origin: { x: 0.5, y: 0.7 }, startVelocity: 35 }), 150)
}

/** Petite salve pour les micro-célébrations (objectif atteint, etc.). */
export function sparkle(x = 0.5, y = 0.5) {
  if (reduced()) return
  confettiLib({ particleCount: 20, spread: 55, origin: { x, y }, colors: BRAND, scalar: 0.8, disableForReducedMotion: true })
}
