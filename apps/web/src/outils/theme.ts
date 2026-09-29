/* Thème clair / sombre.
 *
 * Trois états, pas deux : « auto » (on suit le réglage du TÉLÉPHONE), « clair »
 * et « sombre » (choix explicite du commerçant, qui l'emporte sur l'appareil).
 * Auto est la valeur par défaut : un vendeur qui a mis son Android en mode nuit
 * retrouve la même ambiance dans l'application, sans rien régler — et le soir,
 * au marché, l'écran cesse d'éblouir tout seul.
 *
 * Design 3.5 — la bascule se révèle en « éclipse radiale » (View Transitions).
 *
 * Le script anti-flash de index.html applique la MÊME règle avant le premier
 * rendu : toute modification ici doit y être reportée.
 */

export type PreferenceTheme = 'auto' | 'clair' | 'sombre'

const CLE = 'samacommerce_theme'

/** Préférence enregistrée. Toute valeur inconnue (ou absente) = auto. */
export function lirePreferenceTheme(): PreferenceTheme {
  const v = localStorage.getItem(CLE)
  return v === 'clair' || v === 'sombre' ? v : 'auto'
}

/** Le système d'exploitation est-il en mode nuit ? */
export function systemeEnModeSombre(): boolean {
  return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

/** Thème RÉELLEMENT affiché pour une préférence donnée. */
export function estSombre(preference: PreferenceTheme = lirePreferenceTheme()): boolean {
  return preference === 'auto' ? systemeEnModeSombre() : preference === 'sombre'
}

/** Applique le thème au DOM (classe + color-scheme natif + couleur de la barre). */
function peindre(sombre: boolean) {
  const racine = document.documentElement
  racine.classList.toggle('sombre', sombre)
  // color-scheme : les contrôles natifs (select, date, barres de défilement) suivent aussi.
  racine.style.colorScheme = sombre ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sombre ? '#13111F' : '#7C3AED')
}

/** À appeler une fois au démarrage, avant le rendu. */
export function appliquerThemeEnregistre() {
  peindre(estSombre())
}

/** Suit les changements de thème du téléphone tant qu'on est en mode auto. */
export function suivreThemeSysteme(): () => void {
  const requete = window.matchMedia('(prefers-color-scheme: dark)')
  const surChangement = () => { if (lirePreferenceTheme() === 'auto') peindre(requete.matches) }
  requete.addEventListener('change', surChangement)
  return () => requete.removeEventListener('change', surChangement)
}

type DemarrerTransition = (rappel: () => void) => { ready: Promise<void> }

/** Change la préférence (auto / clair / sombre) avec l'animation d'éclipse. */
export function definirPreferenceTheme(preference: PreferenceTheme, origine?: { x: number; y: number }) {
  const appliquer = () => {
    if (preference === 'auto') localStorage.removeItem(CLE)
    else localStorage.setItem(CLE, preference)
    peindre(estSombre(preference))
  }

  const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const demarrer = (document as unknown as { startViewTransition?: DemarrerTransition }).startViewTransition
  if (!demarrer || mouvementReduit) { appliquer(); return }

  demarrer.call(document, appliquer).ready.then(() => {
    const x = origine?.x ?? window.innerWidth / 2
    const y = origine?.y ?? 0
    const rayon = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${rayon}px at ${x}px ${y}px)`] },
      { duration: 500, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' },
    )
  }).catch(() => {})
}

/* Ordre du cycle : auto → clair → sombre → auto.
 * L'utilisateur qui ne lit pas voit défiler 📱 (comme mon téléphone) → ☀️ →
 * 🌙 : trois images distinctes, aucun texte à déchiffrer. */
const CYCLE: PreferenceTheme[] = ['auto', 'clair', 'sombre']

export function preferenceThemeSuivante(depuis: PreferenceTheme = lirePreferenceTheme()): PreferenceTheme {
  return CYCLE[(CYCLE.indexOf(depuis) + 1) % CYCLE.length]
}

/** Passe à la préférence suivante du cycle. Renvoie la nouvelle préférence. */
export function changerTheme(origine?: { x: number; y: number }): PreferenceTheme {
  const suivante = preferenceThemeSuivante()
  definirPreferenceTheme(suivante, origine)
  return suivante
}

/** Libellé + pictogramme d'une préférence (pour les boutons). */
export const LIBELLES_THEME: Record<PreferenceTheme, { icone: string; libelle: string }> = {
  auto: { icone: '📱', libelle: 'Auto' },
  clair: { icone: '☀️', libelle: 'Clair' },
  sombre: { icone: '🌙', libelle: 'Sombre' },
}
