/* Sections activables — « je ne me sers que de Vendre et Inventaire ».
 *
 * POURQUOI. L'application couvre 17 sections (caisse, livraisons, équipe,
 * multi-boutique…). Une gargote qui vend du café n'en utilise que deux : tout
 * le reste est du bruit qui allonge la barre du bas et la colonne de gauche, et
 * qui perd un utilisateur qui ne lit pas. Chacun compose donc SON application.
 *
 * COMMENT. On enregistre la liste des sections DÉSACTIVÉES (et non celle des
 * activées) : une section ajoutée dans une future version est ainsi visible par
 * défaut, au lieu de rester invisible chez tous ceux qui avaient déjà réglé
 * leurs préférences.
 *
 * OÙ. En localStorage : c'est un réglage d'AFFICHAGE, il doit s'appliquer
 * instantanément et hors ligne. Conséquence assumée : il est propre à
 * l'appareil ; le même commerçant sur un second téléphone repart de zéro.
 */

import type { View } from '../sections/Home'

const KEY = 'samacommerce_modules_off'
/** Événement interne : permet à App de se redessiner quand on change un réglage. */
export const MODULES_EVENT = 'sc:modules'

/** Sections que l'utilisateur peut masquer. Accueil et Paramètres n'y sont PAS :
 *  masquer Paramètres rendrait le réglage lui-même inaccessible. */
export const TOGGLEABLE: { view: View; icon: string; label: string; hint: string }[] = [
  { view: 'vente', icon: '💳', label: 'Vendre', hint: 'Encaisser une vente' },
  { view: 'stock', icon: '📦', label: 'Stock', hint: 'Produits et quantités' },
  { view: 'categories', icon: '🏷️', label: 'Catégories', hint: 'Ranger les produits' },
  { view: 'rapports', icon: '📈', label: 'Chiffres', hint: 'Ventes et graphiques' },
  { view: 'inventaire', icon: '📋', label: 'Inventaire', hint: 'Bénéfices et marges' },
  { view: 'credits', icon: '📝', label: 'Crédits', hint: 'Dettes des clients' },
  { view: 'clients', icon: '👤', label: 'Clients', hint: 'Fichier clients' },
  { view: 'caisse', icon: '💰', label: 'Caisse', hint: 'Clôture de journée' },
  { view: 'ia', icon: '🤖', label: 'Réappro IA', hint: 'Prévision de rupture' },
  { view: 'fournisseurs', icon: '🚚', label: 'Fournisseurs', hint: 'Qui vous livre' },
  { view: 'commandes', icon: '📋', label: 'Commandes', hint: 'Réappro fournisseurs' },
  { view: 'livraisons', icon: '🛵', label: 'Livraisons', hint: 'Suivi des réappros' },
  { view: 'returns', icon: '↩️', label: 'Retours', hint: 'Remboursements' },
  { view: 'boutiques', icon: '🏬', label: 'Boutiques', hint: 'Multi-boutique' },
  { view: 'equipe', icon: '👥', label: 'Équipe', hint: 'Employés et droits' },
]

/** Sections toujours accessibles, quel que soit le réglage. */
const ALWAYS: View[] = ['menu', 'profil']

function read(): View[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((v): v is View => typeof v === 'string') : []
  } catch { return [] }
}

/** Sections masquées par l'utilisateur. */
export function getDisabled(): View[] {
  return read()
}

/** Une section est-elle visible ? */
export function isModuleEnabled(view: View): boolean {
  if (ALWAYS.includes(view)) return true
  return !read().includes(view)
}

/** Active ou masque une section, puis prévient l'application. */
export function setModuleEnabled(view: View, enabled: boolean) {
  if (ALWAYS.includes(view)) return
  const off = new Set(read())
  if (enabled) off.delete(view)
  else off.add(view)
  localStorage.setItem(KEY, JSON.stringify([...off]))
  window.dispatchEvent(new Event(MODULES_EVENT))
}

/** Réactive tout (bouton « Tout afficher »). */
export function resetModules() {
  localStorage.removeItem(KEY)
  window.dispatchEvent(new Event(MODULES_EVENT))
}

/* ─── Réglages annexes de la même famille (options d'usage) ─── */

const PRINT_KEY = 'samacommerce_autoprint'

/** Impression automatique du reçu après encaissement (boutiques équipées). */
export function autoPrintEnabled(): boolean {
  return localStorage.getItem(PRINT_KEY) === '1'
}

export function setAutoPrint(on: boolean) {
  if (on) localStorage.setItem(PRINT_KEY, '1')
  else localStorage.removeItem(PRINT_KEY)
  window.dispatchEvent(new Event(MODULES_EVENT))
}
