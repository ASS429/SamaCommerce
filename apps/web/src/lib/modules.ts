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
 * OÙ. Le localStorage reste la source de vérité LOCALE : le réglage s'applique
 * instantanément, même hors ligne. Il est ensuite POUSSÉ sur le compte
 * (`PUT /auth/preferences`), et rechargé à chaque `/auth/me` : le commerçant
 * retrouve donc son application sur son second téléphone.
 *
 * Règle d'arbitrage en cas de conflit : si des changements locaux n'ont pas
 * encore pu partir (drapeau « dirty », typiquement une modification faite hors
 * ligne), c'est le LOCAL qui gagne et qui est envoyé au serveur. Sinon le
 * serveur fait foi. Simple, prévisible, et sans horloge à synchroniser.
 */

import { updatePreferences, type Preferences } from './api'
import type { View } from '../sections/Home'

const KEY = 'samacommerce_modules_off'
const PRINT_KEY = 'samacommerce_autoprint'
/** Des réglages locaux attendent d'être envoyés au serveur. */
const DIRTY_KEY = 'samacommerce_prefs_dirty'
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

/** Active ou masque une section, puis prévient l'application et le serveur. */
export function setModuleEnabled(view: View, enabled: boolean) {
  if (ALWAYS.includes(view)) return
  const off = new Set(read())
  if (enabled) off.delete(view)
  else off.add(view)
  localStorage.setItem(KEY, JSON.stringify([...off]))
  changed()
}

/** Réactive tout (bouton « Tout afficher »). */
export function resetModules() {
  localStorage.removeItem(KEY)
  changed()
}

/* ─── Réglages annexes de la même famille (options d'usage) ─── */

/** Impression automatique du reçu après encaissement (boutiques équipées). */
export function autoPrintEnabled(): boolean {
  return localStorage.getItem(PRINT_KEY) === '1'
}

export function setAutoPrint(on: boolean) {
  if (on) localStorage.setItem(PRINT_KEY, '1')
  else localStorage.removeItem(PRINT_KEY)
  changed()
}

/* ─────────────────── Synchronisation avec le compte ─────────────────── */

/** État local complet, tel qu'il part au serveur. */
function snapshot(): Preferences {
  return { modules_off: read(), auto_print: autoPrintEnabled() }
}

function isDirty(): boolean {
  return localStorage.getItem(DIRTY_KEY) === '1'
}

let timer: ReturnType<typeof setTimeout> | undefined

/** Réglage modifié : on prévient l'UI, puis on pousse (groupé). */
function changed() {
  localStorage.setItem(DIRTY_KEY, '1')
  window.dispatchEvent(new Event(MODULES_EVENT))
  // Regroupe une rafale de bascules en un seul appel réseau.
  clearTimeout(timer)
  timer = setTimeout(() => { void pushPreferences() }, 500)
}

/**
 * Envoie les réglages locaux au compte. En cas d'échec (hors ligne), le
 * drapeau reste posé : la prochaine ouverture ou le retour du réseau réessaie.
 */
export async function pushPreferences(): Promise<void> {
  if (!localStorage.getItem('samacommerce_token')) return
  try {
    await updatePreferences(snapshot())
    localStorage.removeItem(DIRTY_KEY)
  } catch { /* on retentera : le drapeau « dirty » est conservé */ }
}

/**
 * Applique les réglages venus du compte (réponse de `/auth/me`).
 * Si des changements locaux attendent d'être envoyés, c'est l'inverse : on
 * pousse le local plutôt que de l'écraser.
 */
export function hydrateFromServer(prefs?: Preferences | null): void {
  if (isDirty()) { void pushPreferences(); return }
  if (!prefs) return

  const off = Array.isArray(prefs.modules_off) ? prefs.modules_off.filter((v) => typeof v === 'string') : []
  localStorage.setItem(KEY, JSON.stringify(off))
  if (prefs.auto_print) localStorage.setItem(PRINT_KEY, '1')
  else localStorage.removeItem(PRINT_KEY)

  window.dispatchEvent(new Event(MODULES_EVENT))
}

/** Nettoyage à la déconnexion : le compte suivant ne doit pas hériter de l'écran du précédent. */
export function clearLocalPreferences(): void {
  localStorage.removeItem(KEY)
  localStorage.removeItem(PRINT_KEY)
  localStorage.removeItem(DIRTY_KEY)
}
