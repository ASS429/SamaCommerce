import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { empreintesScriptsEnLigne } from './empreintesCsp.ts'

/* `import.meta.url` n'est pas une URL `file:` sous Vitest (le module passe par
   la transformation de Vite) : on part de la racine du projet, que Vitest
   fixe sur le dossier de sa configuration. */
const INDEX_HTML = resolve(process.cwd(), 'index.html')

describe('empreintesScriptsEnLigne — CSP des scripts en ligne', () => {
  it('hache un script en ligne', () => {
    const h = empreintesScriptsEnLigne('<script>alert(1)</script>')
    expect(h).toHaveLength(1)
    expect(h[0]).toMatch(/^'sha256-[A-Za-z0-9+/]+=*'$/)
  })

  it("ignore les scripts externes, déjà couverts par 'self'", () => {
    expect(empreintesScriptsEnLigne('<script type="module" src="/assets/index.js"></script>')).toEqual([])
    expect(empreintesScriptsEnLigne('<script src = "/registerSW.js"></script>')).toEqual([])
  })

  it('ignore les balises vides', () => {
    expect(empreintesScriptsEnLigne('<script></script><script>\n  \n</script>')).toEqual([])
  })

  /* Le navigateur hache le contenu EXACT de la balise. Normaliser les espaces
     produirait une empreinte ne correspondant à rien, et le script resterait
     bloqué sans que rien ne le signale. */
  it('distingue deux scripts qui ne diffèrent que par les espaces', () => {
    expect(empreintesScriptsEnLigne('<script>var x=1</script>')[0])
      .not.toBe(empreintesScriptsEnLigne('<script>var x = 1</script>')[0])
  })

  /* La norme HTML convertit CRLF et CR en LF avant de lire la page : un
     index.html extrait en CRLF (Git sous Windows) doit donner l'empreinte que
     le navigateur calculera, celle du même script en LF. */
  it('hache les fins de ligne comme le navigateur les lit', () => {
    const attendue = empreintesScriptsEnLigne('<script>\n  go()\n</script>')[0]
    expect(empreintesScriptsEnLigne('<script>\r\n  go()\r\n</script>')[0]).toBe(attendue)
    expect(empreintesScriptsEnLigne('<script>\r  go()\r</script>')[0]).toBe(attendue)
  })

  it('dédoublonne deux scripts identiques', () => {
    expect(empreintesScriptsEnLigne('<script>go()</script><script>go()</script>')).toHaveLength(1)
  })

  it('gère plusieurs scripts en ligne distincts, attributs compris', () => {
    expect(empreintesScriptsEnLigne('<script>a()</script><script defer>b()</script>')).toHaveLength(2)
  })

  /* Le vrai garde-fou : le script anti-flash de index.html DOIT produire une
     empreinte. S'il disparaît ou change de forme sans que la CSP suive, le
     flash blanc en mode nuit revient en production. */
  it('couvre le script anti-flash réellement présent dans index.html', () => {
    const html = readFileSync(INDEX_HTML, 'utf8')
    expect(html).toContain('samacommerce_theme')
    expect(empreintesScriptsEnLigne(html).length).toBeGreaterThanOrEqual(1)
  })
})
