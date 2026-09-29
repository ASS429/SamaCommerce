// Traductions légères de l'interface (français par défaut, wolof, anglais).
// Le changement de langue recharge la page (cf. Accueil.changerLangue), donc
// les constantes évaluées à l'import (NAVIGATION, TITRES…) prennent bien la
// nouvelle langue.
// Les colonnes `wo` et `en` sont du CONTENU destiné aux utilisateurs : elles
// restent dans leur langue (cf. glossaire, section 3).
export type Langue = 'fr' | 'wo' | 'en'

const DICTIONNAIRE: Record<string, Record<Langue, string>> = {
  // Accueil
  'accueil.actionsRapides': { fr: 'Actions rapides', wo: 'Liggéey bu gaaw', en: 'Quick actions' },
  'accueil.bienvenue': { fr: 'Bienvenue !', wo: 'Dalal ak jàmm !', en: 'Welcome!' },
  'accueil.deconnexion': { fr: '🔓 Déconnexion', wo: '🔓 Génn', en: '🔓 Log out' },

  // Navigation (une clé par écran)
  'nav.accueil': { fr: 'Accueil', wo: 'Kër', en: 'Home' },
  'nav.vente': { fr: 'Vendre', wo: 'Jaay', en: 'Sell' },
  'nav.stock': { fr: 'Stock', wo: 'Marsandiis', en: 'Stock' },
  'nav.rapports': { fr: 'Chiffres', wo: 'Limu', en: 'Reports' },
  'nav.ia': { fr: 'Réappro IA', wo: 'Yeesal IA', en: 'AI Restock' },
  'nav.credits': { fr: 'Crédits', wo: 'Bor', en: 'Credits' },
  'nav.inventaire': { fr: 'Inventaire', wo: 'Teew', en: 'Inventory' },
  'nav.categories': { fr: 'Catégories', wo: 'Xeet', en: 'Categories' },
  'nav.clients': { fr: 'Clients', wo: 'Kliyaan', en: 'Customers' },
  'nav.fournisseurs': { fr: 'Fournisseurs', wo: 'Jaaykat', en: 'Suppliers' },
  'nav.commandes': { fr: 'Commandes', wo: 'Komaand', en: 'Orders' },
  'nav.livraisons': { fr: 'Livraisons', wo: 'Yóbbu', en: 'Deliveries' },
  'nav.caisse': { fr: 'Caisse', wo: 'Kees', en: 'Cash' },
  'nav.retours': { fr: 'Retours', wo: 'Dellu', en: 'Returns' },
  'nav.boutiques': { fr: 'Boutiques', wo: 'Butik', en: 'Shops' },
  'nav.equipe': { fr: 'Équipe', wo: 'Ekib', en: 'Team' },
  'nav.profil': { fr: 'Paramètres', wo: 'Paramet', en: 'Settings' },

  // Titres de page (avec emoji)
  'titre.accueil': { fr: '🏪 Sama Commerce', wo: '🏪 Sama Commerce', en: '🏪 Sama Commerce' },
  'titre.vente': { fr: '💳 Vendre', wo: '💳 Jaay', en: '💳 Sell' },
  'titre.stock': { fr: '📦 Mon Stock', wo: '📦 Sama Marsandiis', en: '📦 My Stock' },
  'titre.categories': { fr: '🏷️ Catégories', wo: '🏷️ Xeet', en: '🏷️ Categories' },
  'titre.rapports': { fr: '📈 Chiffres', wo: '📈 Limu', en: '📈 Reports' },
  'titre.inventaire': { fr: '📋 Inventaire', wo: '📋 Teew', en: '📋 Inventory' },
  'titre.credits': { fr: '📝 Crédits', wo: '📝 Bor', en: '📝 Credits' },
  'titre.clients': { fr: '👤 Clients', wo: '👤 Kliyaan', en: '👤 Customers' },
  'titre.fournisseurs': { fr: '🚚 Fournisseurs', wo: '🚚 Jaaykat', en: '🚚 Suppliers' },
  'titre.caisse': { fr: '💰 Caisse', wo: '💰 Kees', en: '💰 Cash' },
  'titre.commandes': { fr: '📋 Commandes', wo: '📋 Komaand', en: '📋 Orders' },
  'titre.retours': { fr: '↩️ Retours', wo: '↩️ Dellu', en: '↩️ Returns' },
  'titre.livraisons': { fr: '🚚 Livraisons', wo: '🚚 Yóbbu', en: '🚚 Deliveries' },
  'titre.boutiques': { fr: '🏬 Boutiques', wo: '🏬 Butik', en: '🏬 Shops' },
  'titre.equipe': { fr: '👥 Équipe', wo: '👥 Ekib', en: '👥 Team' },
  'titre.profil': { fr: '👤 Paramètres', wo: '👤 Paramet', en: '👤 Settings' },
  'titre.ia': { fr: '🤖 Réappro IA', wo: '🤖 Yeesal IA', en: '🤖 AI Restock' },

  // Boutons d'action principaux (accueil)
  'bouton.vendre': { fr: 'VENDRE', wo: 'JAAY', en: 'SELL' },
  'bouton.stock': { fr: 'STOCK', wo: 'MARSANDIIS', en: 'STOCK' },
  'bouton.categories': { fr: 'CATÉGORIES', wo: 'XEET', en: 'CATEGORIES' },
  'bouton.chiffres': { fr: 'CHIFFRES', wo: 'LIMU', en: 'REPORTS' },
  'bouton.inventaire': { fr: 'INVENTAIRE', wo: 'TEEW', en: 'INVENTORY' },
  'bouton.credits': { fr: 'CRÉDITS', wo: 'BOR', en: 'CREDITS' },

  // Actions communes
  'commun.enregistrer': { fr: 'Enregistrer', wo: 'Denc', en: 'Save' },
  'commun.annuler': { fr: 'Annuler', wo: 'Bàyyi', en: 'Cancel' },
  'commun.ajouter': { fr: 'Ajouter', wo: 'Yokk', en: 'Add' },
  'commun.supprimer': { fr: 'Supprimer', wo: 'Far', en: 'Delete' },
  'commun.modifier': { fr: 'Modifier', wo: 'Soppi', en: 'Edit' },
  'commun.confirmer': { fr: 'Confirmer', wo: 'Wóoral', en: 'Confirm' },
  'commun.fermer': { fr: 'Fermer', wo: 'Tëj', en: 'Close' },
  'commun.rechercher': { fr: 'Rechercher…', wo: 'Seet…', en: 'Search…' },
  'commun.chargement': { fr: 'Chargement…', wo: 'Mu ngi yeb…', en: 'Loading…' },
  'commun.aucuneDonnee': { fr: 'Aucune donnée', wo: 'Amul dara', en: 'No data' },
  'commun.total': { fr: 'Total', wo: 'Mboole', en: 'Total' },
  'commun.quantite': { fr: 'Quantité', wo: 'Ñaata', en: 'Quantity' },
  'commun.prix': { fr: 'Prix', wo: 'Njëg', en: 'Price' },

  // Volet « Plus » (mobile)
  'plus.titre': { fr: 'Toutes les fonctions', wo: 'Liggéey yépp', en: 'All features' },
}

const CLE_LANGUE = 'samacommerce_langue'

export function lireLangue(): Langue {
  return (localStorage.getItem(CLE_LANGUE) as Langue) || 'fr'
}
export function choisirLangue(langue: Langue) {
  localStorage.setItem(CLE_LANGUE, langue)
}
export function traduire(cle: string): string {
  const langue = lireLangue()
  return DICTIONNAIRE[cle]?.[langue] ?? DICTIONNAIRE[cle]?.fr ?? cle
}

export const LANGUES: { code: Langue; libelle: string }[] = [
  { code: 'fr', libelle: '🇫🇷 FR' },
  { code: 'wo', libelle: '🇸🇳 WO' },
  { code: 'en', libelle: '🇬🇧 EN' },
]
