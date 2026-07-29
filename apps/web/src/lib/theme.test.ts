import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getThemePref, isDark, systemPrefersDark, nextThemePref, applyStoredTheme, watchSystemTheme, setThemePref } from './theme'

/** Simule le réglage jour/nuit du téléphone. */
function mockSystem(dark: boolean) {
  const listeners: (() => void)[] = []
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-color-scheme: dark') ? dark : false,
    media: q,
    addEventListener: (_: string, cb: () => void) => { listeners.push(cb) },
    removeEventListener: () => {},
  }))
  return listeners
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.style.colorScheme = ''
  document.head.innerHTML = '<meta name="theme-color" content="#7C3AED">'
})

describe('préférence de thème', () => {
  it('vaut « auto » par défaut : on suit l\'appareil tant que rien n\'est choisi', () => {
    mockSystem(false)
    expect(getThemePref()).toBe('auto')
  })

  it('ignore une valeur inconnue en storage et retombe sur auto', () => {
    localStorage.setItem('samacommerce_theme', 'bleu')
    mockSystem(false)
    expect(getThemePref()).toBe('auto')
  })

  it('respecte un choix explicite du commerçant', () => {
    localStorage.setItem('samacommerce_theme', 'light')
    mockSystem(true) // téléphone en nuit…
    expect(getThemePref()).toBe('light')
    expect(isDark()).toBe(false) // …mais le choix manuel gagne
  })
})

describe('mode auto', () => {
  it('suit le mode nuit du téléphone', () => {
    mockSystem(true)
    expect(systemPrefersDark()).toBe(true)
    expect(isDark()).toBe(true)
  })

  it('suit le mode jour du téléphone', () => {
    mockSystem(false)
    expect(isDark()).toBe(false)
  })
})

describe('applyStoredTheme', () => {
  it('pose la classe, le color-scheme et la couleur de barre en mode nuit', () => {
    mockSystem(true)
    applyStoredTheme()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#13111F')
  })

  it('reste en clair quand l\'appareil est en clair', () => {
    mockSystem(false)
    applyStoredTheme()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#7C3AED')
  })
})

describe('watchSystemTheme', () => {
  it('bascule en direct quand le téléphone change, en mode auto', () => {
    let dark = false
    const listeners: (() => void)[] = []
    vi.stubGlobal('matchMedia', (q: string) => ({
      get matches() { return q.includes('dark') ? dark : false },
      media: q,
      addEventListener: (_: string, cb: () => void) => { listeners.push(cb) },
      removeEventListener: () => {},
    }))

    applyStoredTheme()
    watchSystemTheme()
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    dark = true
    listeners.forEach((cb) => cb())
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('n\'écrase pas un choix explicite quand le téléphone change', () => {
    let dark = false
    const listeners: (() => void)[] = []
    vi.stubGlobal('matchMedia', (q: string) => ({
      get matches() { return q.includes('dark') ? dark : false },
      media: q,
      addEventListener: (_: string, cb: () => void) => { listeners.push(cb) },
      removeEventListener: () => {},
    }))

    setThemePref('light')
    watchSystemTheme()
    dark = true
    listeners.forEach((cb) => cb())
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})

describe('cycle auto → clair → sombre', () => {
  it('boucle dans l\'ordre attendu', () => {
    expect(nextThemePref('auto')).toBe('light')
    expect(nextThemePref('light')).toBe('dark')
    expect(nextThemePref('dark')).toBe('auto')
  })

  it('efface la préférence en repassant sur auto', () => {
    mockSystem(false)
    setThemePref('dark')
    expect(localStorage.getItem('samacommerce_theme')).toBe('dark')
    setThemePref('auto')
    expect(localStorage.getItem('samacommerce_theme')).toBeNull()
  })
})
