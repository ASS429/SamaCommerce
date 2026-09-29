import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  lirePreferenceTheme, estSombre, systemeEnModeSombre, preferenceThemeSuivante, appliquerThemeEnregistre,
  suivreThemeSysteme, definirPreferenceTheme,
} from './theme'

/** Simule le réglage jour/nuit du téléphone. */
function simulerSysteme(sombre: boolean) {
  const auditeurs: (() => void)[] = []
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-color-scheme: dark') ? sombre : false,
    media: q,
    addEventListener: (_: string, rappel: () => void) => { auditeurs.push(rappel) },
    removeEventListener: () => {},
  }))
  return auditeurs
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.style.colorScheme = ''
  document.head.innerHTML = '<meta name="theme-color" content="#7C3AED">'
})

describe('préférence de thème', () => {
  it('vaut « auto » par défaut : on suit l\'appareil tant que rien n\'est choisi', () => {
    simulerSysteme(false)
    expect(lirePreferenceTheme()).toBe('auto')
  })

  it('ignore une valeur inconnue en stockage et retombe sur auto', () => {
    localStorage.setItem('samacommerce_theme', 'bleu')
    simulerSysteme(false)
    expect(lirePreferenceTheme()).toBe('auto')
  })

  it('respecte un choix explicite du commerçant', () => {
    localStorage.setItem('samacommerce_theme', 'clair')
    simulerSysteme(true) // téléphone en nuit…
    expect(lirePreferenceTheme()).toBe('clair')
    expect(estSombre()).toBe(false) // …mais le choix manuel gagne
  })
})

describe('mode auto', () => {
  it('suit le mode nuit du téléphone', () => {
    simulerSysteme(true)
    expect(systemeEnModeSombre()).toBe(true)
    expect(estSombre()).toBe(true)
  })

  it('suit le mode jour du téléphone', () => {
    simulerSysteme(false)
    expect(estSombre()).toBe(false)
  })
})

describe('appliquerThemeEnregistre', () => {
  it('pose la classe, le color-scheme et la couleur de barre en mode nuit', () => {
    simulerSysteme(true)
    appliquerThemeEnregistre()
    expect(document.documentElement.classList.contains('sombre')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#13111F')
  })

  it('reste en clair quand l\'appareil est en clair', () => {
    simulerSysteme(false)
    appliquerThemeEnregistre()
    expect(document.documentElement.classList.contains('sombre')).toBe(false)
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#7C3AED')
  })
})

describe('suivreThemeSysteme', () => {
  it('bascule en direct quand le téléphone change, en mode auto', () => {
    let sombre = false
    const auditeurs: (() => void)[] = []
    vi.stubGlobal('matchMedia', (q: string) => ({
      get matches() { return q.includes('dark') ? sombre : false },
      media: q,
      addEventListener: (_: string, rappel: () => void) => { auditeurs.push(rappel) },
      removeEventListener: () => {},
    }))

    appliquerThemeEnregistre()
    suivreThemeSysteme()
    expect(document.documentElement.classList.contains('sombre')).toBe(false)

    sombre = true
    auditeurs.forEach((rappel) => rappel())
    expect(document.documentElement.classList.contains('sombre')).toBe(true)
  })

  it('n\'écrase pas un choix explicite quand le téléphone change', () => {
    let sombre = false
    const auditeurs: (() => void)[] = []
    vi.stubGlobal('matchMedia', (q: string) => ({
      get matches() { return q.includes('dark') ? sombre : false },
      media: q,
      addEventListener: (_: string, rappel: () => void) => { auditeurs.push(rappel) },
      removeEventListener: () => {},
    }))

    definirPreferenceTheme('clair')
    suivreThemeSysteme()
    sombre = true
    auditeurs.forEach((rappel) => rappel())
    expect(document.documentElement.classList.contains('sombre')).toBe(false)
  })
})

describe('cycle auto → clair → sombre', () => {
  it('boucle dans l\'ordre attendu', () => {
    expect(preferenceThemeSuivante('auto')).toBe('clair')
    expect(preferenceThemeSuivante('clair')).toBe('sombre')
    expect(preferenceThemeSuivante('sombre')).toBe('auto')
  })

  it('efface la préférence en repassant sur auto', () => {
    simulerSysteme(false)
    definirPreferenceTheme('sombre')
    expect(localStorage.getItem('samacommerce_theme')).toBe('sombre')
    definirPreferenceTheme('auto')
    expect(localStorage.getItem('samacommerce_theme')).toBeNull()
  })
})
