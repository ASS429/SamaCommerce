// i18n léger (FR par défaut, Wolof, Anglais).
// Le changement de langue recharge la page (cf. Home.cycleLang), donc les
// constantes évaluées à l'import (NAV, TITLES…) prennent bien la nouvelle langue.
export type Lang = 'fr' | 'wo' | 'en'

const DICT: Record<string, Record<Lang, string>> = {
  // Accueil
  'home.quickActions': { fr: 'Actions rapides', wo: 'Liggéey bu gaaw', en: 'Quick actions' },
  'home.welcome': { fr: 'Bienvenue !', wo: 'Dalal ak jàmm !', en: 'Welcome!' },
  'home.logout': { fr: '🔓 Déconnexion', wo: '🔓 Génn', en: '🔓 Log out' },

  // Navigation (une clé par vue)
  'nav.menu': { fr: 'Accueil', wo: 'Kër', en: 'Home' },
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
  'nav.returns': { fr: 'Retours', wo: 'Dellu', en: 'Returns' },
  'nav.boutiques': { fr: 'Boutiques', wo: 'Butik', en: 'Shops' },
  'nav.equipe': { fr: 'Équipe', wo: 'Ekib', en: 'Team' },
  'nav.profil': { fr: 'Paramètres', wo: 'Paramet', en: 'Settings' },

  // Titres de page (avec emoji)
  'title.menu': { fr: '🏪 Sama Commerce', wo: '🏪 Sama Commerce', en: '🏪 Sama Commerce' },
  'title.vente': { fr: '💳 Vendre', wo: '💳 Jaay', en: '💳 Sell' },
  'title.stock': { fr: '📦 Mon Stock', wo: '📦 Sama Marsandiis', en: '📦 My Stock' },
  'title.categories': { fr: '🏷️ Catégories', wo: '🏷️ Xeet', en: '🏷️ Categories' },
  'title.rapports': { fr: '📈 Chiffres', wo: '📈 Limu', en: '📈 Reports' },
  'title.inventaire': { fr: '📋 Inventaire', wo: '📋 Teew', en: '📋 Inventory' },
  'title.credits': { fr: '📝 Crédits', wo: '📝 Bor', en: '📝 Credits' },
  'title.clients': { fr: '👤 Clients', wo: '👤 Kliyaan', en: '👤 Customers' },
  'title.fournisseurs': { fr: '🚚 Fournisseurs', wo: '🚚 Jaaykat', en: '🚚 Suppliers' },
  'title.caisse': { fr: '💰 Caisse', wo: '💰 Kees', en: '💰 Cash' },
  'title.commandes': { fr: '📋 Commandes', wo: '📋 Komaand', en: '📋 Orders' },
  'title.returns': { fr: '↩️ Retours', wo: '↩️ Dellu', en: '↩️ Returns' },
  'title.livraisons': { fr: '🚚 Livraisons', wo: '🚚 Yóbbu', en: '🚚 Deliveries' },
  'title.boutiques': { fr: '🏬 Boutiques', wo: '🏬 Butik', en: '🏬 Shops' },
  'title.equipe': { fr: '👥 Équipe', wo: '👥 Ekib', en: '👥 Team' },
  'title.profil': { fr: '👤 Paramètres', wo: '👤 Paramet', en: '👤 Settings' },
  'title.ia': { fr: '🤖 Réappro IA', wo: '🤖 Yeesal IA', en: '🤖 AI Restock' },

  // Boutons d'action cœur (accueil)
  'btn.sell': { fr: 'VENDRE', wo: 'JAAY', en: 'SELL' },
  'btn.stock': { fr: 'STOCK', wo: 'MARSANDIIS', en: 'STOCK' },
  'btn.categories': { fr: 'CATÉGORIES', wo: 'XEET', en: 'CATEGORIES' },
  'btn.reports': { fr: 'CHIFFRES', wo: 'LIMU', en: 'REPORTS' },
  'btn.inventory': { fr: 'INVENTAIRE', wo: 'TEEW', en: 'INVENTORY' },
  'btn.credits': { fr: 'CRÉDITS', wo: 'BOR', en: 'CREDITS' },

  // Actions communes
  'common.save': { fr: 'Enregistrer', wo: 'Denc', en: 'Save' },
  'common.cancel': { fr: 'Annuler', wo: 'Bàyyi', en: 'Cancel' },
  'common.add': { fr: 'Ajouter', wo: 'Yokk', en: 'Add' },
  'common.delete': { fr: 'Supprimer', wo: 'Far', en: 'Delete' },
  'common.edit': { fr: 'Modifier', wo: 'Soppi', en: 'Edit' },
  'common.confirm': { fr: 'Confirmer', wo: 'Wóoral', en: 'Confirm' },
  'common.close': { fr: 'Fermer', wo: 'Tëj', en: 'Close' },
  'common.search': { fr: 'Rechercher…', wo: 'Seet…', en: 'Search…' },
  'common.loading': { fr: 'Chargement…', wo: 'Mu ngi yeb…', en: 'Loading…' },
  'common.noData': { fr: 'Aucune donnée', wo: 'Amul dara', en: 'No data' },
  'common.total': { fr: 'Total', wo: 'Mboole', en: 'Total' },
  'common.quantity': { fr: 'Quantité', wo: 'Ñaata', en: 'Quantity' },
  'common.price': { fr: 'Prix', wo: 'Njëg', en: 'Price' },

  // Menu « Plus » (mobile)
  'plus.title': { fr: 'Toutes les fonctions', wo: 'Liggéey yépp', en: 'All features' },
}

const LANG_KEY = 'samacommerce_lang'

export function getLang(): Lang {
  return (localStorage.getItem(LANG_KEY) as Lang) || 'fr'
}
export function setLang(lang: Lang) {
  localStorage.setItem(LANG_KEY, lang)
}
export function t(key: string): string {
  const lang = getLang()
  return DICT[key]?.[lang] ?? DICT[key]?.fr ?? key
}

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'fr', label: '🇫🇷 FR' },
  { code: 'wo', label: '🇸🇳 WO' },
  { code: 'en', label: '🇬🇧 EN' },
]
