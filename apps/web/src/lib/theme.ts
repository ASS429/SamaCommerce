/* Design 3.5 — Bascule jour/nuit en « éclipse radiale » : au lieu d'un switch sec,
 * le nouveau thème se révèle en cercle qui s'étend depuis le bouton (View
 * Transitions API). Repli propre si l'API ou reduced-motion l'exigent. */

function apply(goDark: boolean) {
  document.documentElement.classList.toggle('dark', goDark)
  localStorage.setItem('samacommerce_theme', goDark ? 'dark' : 'light')
}

type StartViewTransition = (cb: () => void) => { ready: Promise<void> }

export function toggleTheme(origin?: { x: number; y: number }) {
  const goDark = !document.documentElement.classList.contains('dark')
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const start = (document as unknown as { startViewTransition?: StartViewTransition }).startViewTransition

  if (!start || reduced) { apply(goDark); return }

  const transition = start.call(document, () => apply(goDark))
  transition.ready.then(() => {
    const x = origin?.x ?? window.innerWidth / 2
    const y = origin?.y ?? 0
    const end = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
      { duration: 500, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' },
    )
  }).catch(() => {})
}
