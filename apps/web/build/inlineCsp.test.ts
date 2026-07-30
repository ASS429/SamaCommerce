import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { inlineScriptHashes } from './inlineCsp.ts'

/* `import.meta.url` n'est pas une URL `file:` sous Vitest (le module passe par
   la transformation de Vite) : on part de la racine du projet, que Vitest
   fixe sur le dossier de sa configuration. */
const INDEX_HTML = resolve(process.cwd(), 'index.html')

describe('inlineScriptHashes — CSP des scripts inline', () => {
  it('hache un script inline', () => {
    const h = inlineScriptHashes('<script>alert(1)</script>')
    expect(h).toHaveLength(1)
    expect(h[0]).toMatch(/^'sha256-[A-Za-z0-9+/]+=*'$/)
  })

  it("ignore les scripts externes, déjà couverts par 'self'", () => {
    expect(inlineScriptHashes('<script type="module" src="/assets/index.js"></script>')).toEqual([])
    expect(inlineScriptHashes('<script src = "/registerSW.js"></script>')).toEqual([])
  })

  it('ignore les balises vides', () => {
    expect(inlineScriptHashes('<script></script><script>\n  \n</script>')).toEqual([])
  })

  /* Le navigateur hache le contenu EXACT de la balise. Normaliser les espaces
     produirait une empreinte ne correspondant à rien, et le script resterait
     bloqué sans que rien ne le signale. */
  it('distingue deux scripts qui ne diffèrent que par les espaces', () => {
    expect(inlineScriptHashes('<script>var x=1</script>')[0])
      .not.toBe(inlineScriptHashes('<script>var x = 1</script>')[0])
  })

  it('dédoublonne deux scripts identiques', () => {
    expect(inlineScriptHashes('<script>go()</script><script>go()</script>')).toHaveLength(1)
  })

  it('gère plusieurs scripts inline distincts, attributs compris', () => {
    expect(inlineScriptHashes('<script>a()</script><script defer>b()</script>')).toHaveLength(2)
  })

  /* Le vrai garde-fou : le script anti-flash de index.html DOIT produire une
     empreinte. S'il disparaît ou change de forme sans que la CSP suive, le
     flash blanc en mode nuit revient en production. */
  it('couvre le script anti-flash réellement présent dans index.html', () => {
    const html = readFileSync(INDEX_HTML, 'utf8')
    expect(html).toContain('samacommerce_theme')
    expect(inlineScriptHashes(html).length).toBeGreaterThanOrEqual(1)
  })
})
