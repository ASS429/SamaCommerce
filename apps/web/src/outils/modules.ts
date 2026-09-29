/* Sections activables — « je ne me sers que de Vendre et Inventaire ».
 *
 * POURQUOI. L'application couvre 17 sections (caisse, livraisons, équipe,
 * multi-boutique…). Une gargote qui vend du café n'en utilise que deux : tout
 * le reste est du bruit qui allonge la barre du bas et la colonne de gauche, et
 * qui perd un utilisateur qui ne lit pas. Chacun compose donc SON application.
 *
 * COMMENT. On enregistre la liste des sections MASQUÉES (et non celle des
 * affichées) : une section ajoutée dans une future version est ainsi visible
 * par défaut, au lieu de rester invisible chez tous ceux qui avaient déjà réglé
 * leurs préférences.
 *
 * OÙ. Le localStorage reste la source de vérité LOCALE : le réglage s'applique
 * instantanément, même hors ligne. Il est ensuite ENVOYÉ au compte
 * (`PUT /auth/preferences`), et rechargé à chaque `/auth/moi` : le commerçant
 * retrouve donc son application sur son second téléphone.
 *
 * Règle d'arbitrage en cas de conflit : si des changements locaux n'ont pas
 * encore pu partir (drapeau « à envoyer », typiquement une modification faite
 * hors ligne), c'est le LOCAL qui gagne et qui est envoyé au serveur. Sinon le
 * serveur fait foi. Simple, prévisible, et sans horloge à synchroniser.
 */

import { modifierPreferences, type Preferences } from './api'
import type { Ecran } from '../sections/Accueil'

const CLE_SECTIONS = 'samacommerce_sections_masquees'
const CLE_IMPRESSION = 'samacommerce_impression_auto'
/** Des réglages locaux attendent d'être envoyés au serveur. */
const CLE_A_ENVOYER = 'samacommerce_reglages_a_envoyer'
/** Événement interne : permet à Application de se redessiner quand on change un réglage. */
export const EVENEMENT_SECTIONS = 'samacommerce:sections'

/** Sections que l'utilisateur peut masquer. Accueil et Paramètres n'y sont PAS :
 *  masquer Paramètres rendrait le réglage lui-même inaccessible. */
export const SECTIONS_MASQUABLES: { ecran: Ecran; icone: string; libelle: string; aide: string }[] = [
  { ecran: 'vente', icone: '💳', libelle: 'Vendre', aide: 'Encaisser une vente' },
  { ecran: 'stock', icone: '📦', libelle: 'Stock', aide: 'Produits et quantités' },
  { ecran: 'categories', icone: '🏷️', libelle: 'Catégories', aide: 'Ranger les produits' },
  { ecran: 'rapports', icone: '📈', libelle: 'Chiffres', aide: 'Ventes et graphiques' },
  { ecran: 'inventaire', icone: '📋', libelle: 'Inventaire', aide: 'Bénéfices et marges' },
  { ecran: 'credits', icone: '📝', libelle: 'Crédits', aide: 'Dettes des clients' },
  { ecran: 'clients', icone: '👤', libelle: 'Clients', aide: 'Fichier clients' },
  { ecran: 'caisse', icone: '💰', libelle: 'Caisse', aide: 'Clôture de journée' },
  { ecran: 'ia', icone: '🤖', libelle: 'Réappro IA', aide: 'Prévision de rupture' },
  { ecran: 'fournisseurs', icone: '🚚', libelle: 'Fournisseurs', aide: 'Qui vous livre' },
  { ecran: 'commandes', icone: '📋', libelle: 'Commandes', aide: 'Réappro fournisseurs' },
  { ecran: 'livraisons', icone: '🛵', libelle: 'Livraisons', aide: 'Suivi des réappros' },
  { ecran: 'retours', icone: '↩️', libelle: 'Retours', aide: 'Remboursements' },
  { ecran: 'boutiques', icone: '🏬', libelle: 'Boutiques', aide: 'Multi-boutique' },
  { ecran: 'equipe', icone: '👥', libelle: 'Équipe', aide: 'Employés et droits' },
]

/** Sections toujours accessibles, quel que soit le réglage. */
const TOUJOURS_VISIBLES: Ecran[] = ['accueil', 'profil']

function lire(): Ecran[] {
  try {
    const brut = localStorage.getItem(CLE_SECTIONS)
    const liste = brut ? JSON.parse(brut) : []
    return Array.isArray(liste) ? liste.filter((v): v is Ecran => typeof v === 'string') : []
  } catch { return [] }
}

/** Sections masquées par l'utilisateur. */
export function sectionsMasquees(): Ecran[] {
  return lire()
}

/** Une section est-elle visible ? */
export function sectionVisible(ecran: Ecran): boolean {
  if (TOUJOURS_VISIBLES.includes(ecran)) return true
  return !lire().includes(ecran)
}

/** Affiche ou masque une section, puis prévient l'application et le serveur. */
export function afficherSection(ecran: Ecran, visible: boolean) {
  if (TOUJOURS_VISIBLES.includes(ecran)) return
  const masquees = new Set(lire())
  if (visible) masquees.delete(ecran)
  else masquees.add(ecran)
  localStorage.setItem(CLE_SECTIONS, JSON.stringify([...masquees]))
  signalerChangement()
}

/** Réaffiche tout (bouton « Tout afficher »). */
export function toutAfficher() {
  localStorage.removeItem(CLE_SECTIONS)
  signalerChangement()
}

/* ─── Réglages annexes de la même famille (options d'usage) ─── */

/** Impression automatique du reçu après encaissement (boutiques équipées). */
export function impressionAutoActive(): boolean {
  return localStorage.getItem(CLE_IMPRESSION) === '1'
}

export function definirImpressionAuto(active: boolean) {
  if (active) localStorage.setItem(CLE_IMPRESSION, '1')
  else localStorage.removeItem(CLE_IMPRESSION)
  signalerChangement()
}

/* ─────────────────── Synchronisation avec le compte ─────────────────── */

/** État local complet, tel qu'il part au serveur. */
function etatLocal(): Preferences {
  return { sections_masquees: lire(), impression_auto: impressionAutoActive() }
}

function reglagesAEnvoyer(): boolean {
  return localStorage.getItem(CLE_A_ENVOYER) === '1'
}

let minuterie: ReturnType<typeof setTimeout> | undefined

/** Réglage modifié : on prévient l'interface, puis on envoie (groupé). */
function signalerChangement() {
  localStorage.setItem(CLE_A_ENVOYER, '1')
  window.dispatchEvent(new Event(EVENEMENT_SECTIONS))
  // Regroupe une rafale de bascules en un seul appel réseau.
  clearTimeout(minuterie)
  minuterie = setTimeout(() => { void envoyerReglages() }, 500)
}

/**
 * Envoie les réglages locaux au compte. En cas d'échec (hors ligne), le
 * drapeau reste posé : la prochaine ouverture ou le retour du réseau réessaie.
 */
export async function envoyerReglages(): Promise<void> {
  if (!localStorage.getItem('samacommerce_jeton')) return
  try {
    await modifierPreferences(etatLocal())
    localStorage.removeItem(CLE_A_ENVOYER)
  } catch { /* on retentera : le drapeau « à envoyer » est conservé */ }
}

/**
 * Applique les réglages venus du compte (réponse de `/auth/moi`).
 * Si des changements locaux attendent d'être envoyés, c'est l'inverse : on
 * envoie le local plutôt que de l'écraser.
 */
export function appliquerReglagesDuServeur(preferences?: Preferences | null): void {
  if (reglagesAEnvoyer()) { void envoyerReglages(); return }
  if (!preferences) return

  const masquees = Array.isArray(preferences.sections_masquees) ? preferences.sections_masquees.filter((v) => typeof v === 'string') : []
  localStorage.setItem(CLE_SECTIONS, JSON.stringify(masquees))
  if (preferences.impression_auto) localStorage.setItem(CLE_IMPRESSION, '1')
  else localStorage.removeItem(CLE_IMPRESSION)

  window.dispatchEvent(new Event(EVENEMENT_SECTIONS))
}

/** Nettoyage à la déconnexion : le compte suivant ne doit pas hériter de l'écran du précédent. */
export function effacerReglagesLocaux(): void {
  localStorage.removeItem(CLE_SECTIONS)
  localStorage.removeItem(CLE_IMPRESSION)
  localStorage.removeItem(CLE_A_ENVOYER)
}
