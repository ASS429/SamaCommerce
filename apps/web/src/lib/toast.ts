/* Toasts + confirmation/prompt stylés (basés DOM, utilisables partout).
 *
 * SÉCURITÉ (S1) : aucun message n'est jamais injecté via innerHTML. Tout texte
 * fourni (potentiellement un nom de produit/client renvoyé par l'API) passe par
 * `textContent`, ce qui neutralise toute charge XSS (`<img src=x onerror=…>`).
 * La structure DOM est bâtie par createElement ; seul le HTML statique interne
 * (icônes, mise en page) est écrit par nos soins. */

function wrap(): HTMLElement {
  let w = document.querySelector<HTMLElement>('.toast-wrap')
  if (!w) {
    w = document.createElement('div')
    w.className = 'toast-wrap'
    // Accessibilité : les toasts sont annoncés aux lecteurs d'écran.
    w.setAttribute('role', 'status')
    w.setAttribute('aria-live', 'polite')
    w.setAttribute('aria-atomic', 'false')
    document.body.appendChild(w)
  }
  return w
}

type ToastType = 'success' | 'error' | 'info'
type ToastOptions = {
  duration?: number
  /** Action « Annuler » (undo) : bouton affiché à droite du toast. */
  action?: { label: string; onClick: () => void }
}

export function toast(message: string, type: ToastType = 'success', opts: ToastOptions = {}) {
  const duration = opts.duration ?? (type === 'error' ? 3800 : 2600)
  const el = document.createElement('div')
  el.className = `toast ${type}`

  // Icône (statique — sûr).
  const iconEl = document.createElement('span')
  iconEl.className = 'toast-icon'
  iconEl.textContent = type === 'success' ? '✅' : type === 'error' ? '⛔' : 'ℹ️'
  iconEl.setAttribute('aria-hidden', 'true')

  // Message (données utilisateur — TOUJOURS via textContent).
  const msgEl = document.createElement('span')
  msgEl.className = 'toast-msg'
  msgEl.textContent = message

  el.appendChild(iconEl)
  el.appendChild(msgEl)

  let timer: ReturnType<typeof setTimeout> | undefined
  const dismiss = () => {
    if (timer) clearTimeout(timer)
    el.classList.add('out')
    setTimeout(() => el.remove(), 250)
  }

  // Action « Annuler » optionnelle (undo sur suppression, cf. 3.6).
  if (opts.action) {
    const btn = document.createElement('button')
    btn.className = 'toast-action'
    btn.type = 'button'
    btn.textContent = opts.action.label
    btn.addEventListener('click', () => {
      opts.action!.onClick()
      dismiss()
    })
    el.appendChild(btn)
  }

  // Barre de progression de l'auto-dismiss.
  const bar = document.createElement('div')
  bar.className = 'toast-progress'
  bar.style.animationDuration = `${duration}ms`
  el.appendChild(bar)

  wrap().appendChild(el)
  timer = setTimeout(dismiss, duration)
  return dismiss
}

/** Confirmation stylée — renvoie une Promise<boolean>. */
export function confirmAsync(message: string, confirmLabel = 'Confirmer'): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'

    const box = document.createElement('div')
    box.className = 'modal-box'
    box.style.maxWidth = '360px'
    box.setAttribute('role', 'alertdialog')
    box.setAttribute('aria-modal', 'true')

    const title = document.createElement('div')
    title.className = 'modal-title'
    title.textContent = 'Confirmer'

    const p = document.createElement('p')
    p.style.cssText = 'text-align:center;color:var(--muted);font-size:14px;margin-bottom:4px'
    p.textContent = message // ← données utilisateur, jamais innerHTML

    const actions = document.createElement('div')
    actions.className = 'modal-actions'
    const noBtn = document.createElement('button')
    noBtn.className = 'btn-cancel'
    noBtn.type = 'button'
    noBtn.textContent = 'Annuler'
    const yesBtn = document.createElement('button')
    yesBtn.className = 'btn-confirm'
    yesBtn.type = 'button'
    yesBtn.textContent = confirmLabel
    actions.append(noBtn, yesBtn)

    box.append(title, p, actions)
    overlay.appendChild(box)

    const close = (v: boolean) => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(v) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false) }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false) })
    noBtn.addEventListener('click', () => close(false))
    yesBtn.addEventListener('click', () => close(true))
    document.addEventListener('keydown', onKey)
    document.body.appendChild(overlay)
    setTimeout(() => yesBtn.focus(), 50)
  })
}

/** Saisie stylée — renvoie une Promise<string|null>. */
export function promptAsync(message: string, placeholder = '', initial = ''): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'

    const box = document.createElement('div')
    box.className = 'modal-box'
    box.style.maxWidth = '360px'
    box.setAttribute('role', 'dialog')
    box.setAttribute('aria-modal', 'true')

    const title = document.createElement('div')
    title.className = 'modal-title'
    title.textContent = message // ← données utilisateur, jamais innerHTML

    const group = document.createElement('div')
    group.className = 'form-group'
    const input = document.createElement('input')
    input.placeholder = placeholder // les attributs DOM ne sont pas exécutables
    input.value = initial
    group.appendChild(input)

    const actions = document.createElement('div')
    actions.className = 'modal-actions'
    const noBtn = document.createElement('button')
    noBtn.className = 'btn-cancel'
    noBtn.type = 'button'
    noBtn.textContent = 'Annuler'
    const yesBtn = document.createElement('button')
    yesBtn.className = 'btn-confirm'
    yesBtn.type = 'button'
    yesBtn.textContent = 'Valider'
    actions.append(noBtn, yesBtn)

    box.append(title, group, actions)
    overlay.appendChild(box)

    const close = (v: string | null) => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(v) }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(null)
      if (e.key === 'Enter') close(input.value)
    }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null) })
    noBtn.addEventListener('click', () => close(null))
    yesBtn.addEventListener('click', () => close(input.value))
    document.addEventListener('keydown', onKey)
    document.body.appendChild(overlay)
    setTimeout(() => input.focus(), 50)
  })
}
