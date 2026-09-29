/* Design 3.4 — Ajout au panier « balistique » : le produit touché se clone en
 * vignette qui suit une courbe jusqu'au panier, puis le panier rebondit.
 * Causalité visible + plaisir immédiat. Web Animations API (aucune
 * dépendance), mouvement réduit respecté. */

export function envolVersPanier(source: HTMLElement | null, selecteurCible = '.barre-total') {
  if (!source) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const cible = document.querySelector<HTMLElement>(selecteurCible)
  if (!cible) return

  const s = source.getBoundingClientRect()
  const c = cible.getBoundingClientRect()

  const fantome = document.createElement('div')
  fantome.textContent = '🛒'
  fantome.setAttribute('aria-hidden', 'true')
  Object.assign(fantome.style, {
    position: 'fixed',
    left: `${s.left + s.width / 2 - 16}px`,
    top: `${s.top + s.height / 2 - 16}px`,
    width: '32px', height: '32px', lineHeight: '32px', textAlign: 'center',
    fontSize: '22px', zIndex: '9998', pointerEvents: 'none',
    filter: 'drop-shadow(0 6px 10px rgba(30,27,75,.35))',
  } as CSSStyleDeclaration)
  document.body.appendChild(fantome)

  const dx = c.left + c.width / 2 - (s.left + s.width / 2)
  const dy = c.top + c.height / 2 - (s.top + s.height / 2)

  const animation = fantome.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(1.15)`, opacity: 1, offset: 0.5 }, // arc (courbe de Bézier)
    { transform: `translate(${dx}px, ${dy}px) scale(.3)`, opacity: 0.2 },
  ], { duration: 620, easing: 'cubic-bezier(.5,.05,.6,1)' })

  animation.onfinish = () => {
    fantome.remove()
    // Rebond du panier (ressort).
    cible.animate([
      { transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' },
    ], { duration: 320, easing: 'cubic-bezier(.34,1.5,.5,1)' })
  }
}
