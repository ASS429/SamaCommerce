/* Empreintes des scripts INLINE du HTML, pour la Content-Security-Policy.
 *
 * Code de BUILD (d'où le dossier `build/` plutôt que `src/` : il tourne dans
 * Node, pas dans le navigateur, et n'est jamais embarqué dans l'application).
 *
 * Pourquoi : `script-src 'self'` bloque tout script inline, y compris le nôtre.
 * En production, le script anti-flash de index.html ne s'exécutait donc jamais
 * et un téléphone en mode nuit affichait un grand flash blanc à chaque
 * chargement — précisément ce que ce script existe pour éviter. Le bug était
 * invisible en développement, où la CSP n'est pas injectée.
 *
 * L'empreinte se calcule au build et non en dur : une virgule changée dans le
 * script invaliderait une valeur figée, et le flash reviendrait en silence.
 */

import { createHash } from 'node:crypto'

/* Une balise `<script>` SANS attribut `src` : c'est la définition d'un script
   inline pour la CSP. Un `<script src=…>` est déjà couvert par 'self'. */
const INLINE_SCRIPT = /<script(?![^>]*\ssrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi

/**
 * Sources à ajouter à `script-src` pour autoriser les scripts inline du HTML.
 * Renvoie des jetons prêts à concaténer, par exemple `'sha256-…='`.
 */
export function inlineScriptHashes(html: string): string[] {
  const empreintes = [...html.matchAll(INLINE_SCRIPT)]
    .map((m) => m[1])
    // Le navigateur hache le contenu EXACT de la balise, espaces compris : on
    // ne normalise donc rien. Seules les balises vides sont ignorées.
    .filter((code) => code.trim() !== '')
    .map((code) => `'sha256-${createHash('sha256').update(code, 'utf8').digest('base64')}'`)
  return [...new Set(empreintes)]
}
