/* Thème clair / sombre.
 *
 * Trois états, pas deux : « auto » (on suit le réglage du TÉLÉPHONE), « clair »
 * et « sombre » (choix explicite du commerçant, qui l'emporte sur l'appareil).
 * Auto est la valeur par défaut : un vendeur qui a mis son Android en mode nuit
 * retrouve la même ambiance dans l'application, sans rien régler — et le soir,
 * au marché, l'écran cesse d'éblouir tout seul.
 *
 * Design 3.5 — la bascule se révèle en « éclipse radiale » (View Transitions).
 */

export type ThemePref = 'auto' | 'light' | 'dark'

const KEY = 'samacommerce_theme'

/** Préférence enregistrée. Toute valeur inconnue (ou absente) = auto. */
export function getThemePref(): ThemePref {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : 'auto'
}

/** Le système d'exploitation est-il en mode nuit ? */
export function systemPrefersDark(): boolean {
  return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

/** Thème RÉELLEMENT affiché pour une préférence donnée. */
export function isDark(pref: ThemePref = getThemePref()): boolean {
  return pref === 'auto' ? systemPrefersDark() : pref === 'dark'
}

/** Applique le thème au DOM (classe + color-scheme natif + couleur de la barre). */
function paint(dark: boolean) {
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  // color-scheme : les contrôles natifs (select, date, scrollbars) suivent aussi.
  root.style.colorScheme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#13111F' : '#7C3AED')
}

/** À appeler une fois au démarrage, avant le rendu. */
export function applyStoredTheme() {
  paint(isDark())
}

/** Suit les changements de thème du téléphone tant qu'on est en mode auto. */
export function watchSystemTheme(): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => { if (getThemePref() === 'auto') paint(mq.matches) }
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}

type StartViewTransition = (cb: () => void) => { ready: Promise<void> }

/** Change la préférence (auto / clair / sombre) avec l'animation d'éclipse. */
export function setThemePref(pref: ThemePref, origin?: { x: number; y: number }) {
  const apply = () => {
    if (pref === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
    paint(isDark(pref))
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const start = (document as unknown as { startViewTransition?: StartViewTransition }).startViewTransition
  if (!start || reduced) { apply(); return }

  start.call(document, apply).ready.then(() => {
    const x = origin?.x ?? window.innerWidth / 2
    const y = origin?.y ?? 0
    const end = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
      { duration: 500, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' },
    )
  }).catch(() => {})
}

/* Ordre du cycle : auto → clair → sombre → auto.
 * L'utilisateur qui ne lit pas voit défiler 📱 (comme mon téléphone) → ☀️ →
 * 🌙 : trois images distinctes, aucun texte à déchiffrer. */
const CYCLE: ThemePref[] = ['auto', 'light', 'dark']

export function nextThemePref(from: ThemePref = getThemePref()): ThemePref {
  return CYCLE[(CYCLE.indexOf(from) + 1) % CYCLE.length]
}

/** Passe à la préférence suivante du cycle. Renvoie la nouvelle préférence. */
export function cycleTheme(origin?: { x: number; y: number }): ThemePref {
  const next = nextThemePref()
  setThemePref(next, origin)
  return next
}

/** Libellé + pictogramme d'une préférence (pour les boutons). */
export const THEME_LABEL: Record<ThemePref, { icon: string; label: string }> = {
  auto: { icon: '📱', label: 'Auto' },
  light: { icon: '☀️', label: 'Clair' },
  dark: { icon: '🌙', label: 'Sombre' },
}
