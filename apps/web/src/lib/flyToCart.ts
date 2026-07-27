/* Design 3.4 — Ajout au panier « balistique » : le produit tapé se clone en
 * vignette qui suit une courbe jusqu'au panier, puis le badge rebondit. Causalité
 * visible + plaisir immédiat. Web Animations API (aucune dépendance),
 * reduced-motion respecté. */

export function flyToCart(source: HTMLElement | null, targetSelector = '.total-bar') {
  if (!source) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const target = document.querySelector<HTMLElement>(targetSelector)
  if (!target) return

  const s = source.getBoundingClientRect()
  const t = target.getBoundingClientRect()

  const ghost = document.createElement('div')
  ghost.textContent = '🛒'
  ghost.setAttribute('aria-hidden', 'true')
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${s.left + s.width / 2 - 16}px`,
    top: `${s.top + s.height / 2 - 16}px`,
    width: '32px', height: '32px', lineHeight: '32px', textAlign: 'center',
    fontSize: '22px', zIndex: '9998', pointerEvents: 'none',
    filter: 'drop-shadow(0 6px 10px rgba(30,27,75,.35))',
  } as CSSStyleDeclaration)
  document.body.appendChild(ghost)

  const dx = t.left + t.width / 2 - (s.left + s.width / 2)
  const dy = t.top + t.height / 2 - (s.top + s.height / 2)

  const anim = ghost.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(1.15)`, opacity: 1, offset: 0.5 }, // arc (courbe de Bézier)
    { transform: `translate(${dx}px, ${dy}px) scale(.3)`, opacity: 0.2 },
  ], { duration: 620, easing: 'cubic-bezier(.5,.05,.6,1)' })

  anim.onfinish = () => {
    ghost.remove()
    // Rebond du panier (spring).
    target.animate([
      { transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' },
    ], { duration: 320, easing: 'cubic-bezier(.34,1.5,.5,1)' })
  }
}
