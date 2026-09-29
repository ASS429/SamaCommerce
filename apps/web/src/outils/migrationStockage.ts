/* Reprise du stockage du navigateur laissé par l'ANCIENNE version (noms anglais).
 *
 * TEMPORAIRE — retrait prévu trois mois après la francisation (cf. glossaire,
 * sections 3 et 9.2). Les noms anglais ci-dessous SONT l'ancien stockage : ils
 * ne peuvent pas être traduits, puisque c'est ce qu'il faut relire.
 *
 * POURQUOI. Au premier lancement de la version française, le téléphone garde
 * tout ce que l'ancienne version a écrit : le jeton de session (sans lui, le
 * commerçant est déconnecté), le code PIN du comptoir, les sections masquées,
 * le thème… Chaque valeur est recopiée sous son nouveau nom, traduite si
 * besoin, et l'ancienne n'est effacée qu'APRÈS une écriture vérifiée.
 *
 * Les ventes hors ligne en attente (IndexedDB) sont reprises à part, par la
 * file elle-même (cf. fileHorsLigne.recupererVentesDeLAncienneVersion).
 *
 * QUAND. Avant TOUT le reste, au tout début du démarrage : certaines valeurs
 * (langue, thème) sont lues dès l'import des modules.
 */

type Conversion = (ancienne: string) => string | null

/** Ancienne clé → nouvelle clé, et conversion éventuelle de la valeur. */
const CLES: [ancienne: string, nouvelle: string, conversion?: Conversion][] = [
  ['samacommerce_token', 'samacommerce_jeton'],
  ['samacommerce_user', 'samacommerce_utilisateur', traduireUtilisateur],
  // Valeur conservée à l'identique : c'est le nom du jeton côté serveur.
  ['samacommerce_device', 'samacommerce_appareil'],
  ['samacommerce_lang', 'samacommerce_langue'],
  ['samacommerce_invite', 'samacommerce_invitation'],
  ['samacommerce_onboarded', 'samacommerce_premiers_pas_vus'],
  ['samacommerce_modules_off', 'samacommerce_sections_masquees', traduireSections],
  ['samacommerce_autoprint', 'samacommerce_impression_auto'],
  ['samacommerce_prefs_dirty', 'samacommerce_reglages_a_envoyer'],
  // Empreinte du code conservée : le sel du hachage n'a pas changé.
  ['samacommerce_pin', 'samacommerce_code_pin'],
  ['samacommerce_pin_delay', 'samacommerce_delai_verrou'],
  ['sc_stock_sort', 'samacommerce_tri_stock', (v) => TRIS[v] ?? v],
  ['sc_notif', 'samacommerce_notifications'],
]

/** La clé du thème garde son nom ; seules ses valeurs changent. */
const CLE_THEME = 'samacommerce_theme'
const THEMES: Record<string, string> = { light: 'clair', dark: 'sombre' }

const TRIS: Record<string, string> = {
  recent: 'recents', 'stock-asc': 'stock-croissant', 'stock-desc': 'stock-decroissant', 'prix-desc': 'prix-decroissant',
}

const SECTIONS: Record<string, string> = { returns: 'retours', menu: 'accueil' }

function traduireSections(brut: string): string | null {
  const liste = JSON.parse(brut)
  if (!Array.isArray(liste)) return null
  return JSON.stringify(liste.map((v) => (typeof v === 'string' ? SECTIONS[v] ?? v : v)))
}

/** Champs de l'utilisateur mémorisé (et de ses boutiques) : ancien → nouveau. */
const CHAMPS_UTILISATEUR: Record<string, string> = {
  username: 'identifiant', company_name: 'nom_commerce', current_boutique_id: 'boutique_active_id',
  phone: 'telephone', status: 'statut', payment_status: 'statut_paiement', payment_method: 'moyen_paiement',
  amount: 'montant', upgrade_status: 'statut_demande_premium', created_at: 'cree_le', updated_at: 'modifie_le',
  twofa_enabled: 'double_facteur_actif', is_employee: 'est_employe', modules_off: 'sections_masquees',
  auto_print: 'impression_auto', owner_id: 'proprietaire_id', name: 'nom', address: 'adresse',
  is_primary: 'est_principale', user_id: 'utilisateur_id',
}
const VALEURS_UTILISATEUR: Record<string, Record<string, string>> = {
  role: { user: 'commercant' },
  plan: { Free: 'Gratuit' },
}

function traduireObjet(valeur: unknown, parent?: string): unknown {
  if (Array.isArray(valeur)) {
    return valeur.map((v) => (parent === 'sections_masquees' && typeof v === 'string' ? SECTIONS[v] ?? v : traduireObjet(v)))
  }
  if (valeur && typeof valeur === 'object') {
    return Object.fromEntries(Object.entries(valeur).map(([cle, v]) => {
      const nouvelle = CHAMPS_UTILISATEUR[cle] ?? cle
      const convertie = typeof v === 'string' ? VALEURS_UTILISATEUR[nouvelle]?.[v] ?? v : traduireObjet(v, nouvelle)
      return [nouvelle, convertie]
    }))
  }
  return valeur
}

/* L'utilisateur est relu depuis le serveur (`/auth/moi`) à chaque ouverture ;
   la traduction ne sert qu'à l'affichage immédiat — et hors ligne, où le
   serveur ne répond pas. */
function traduireUtilisateur(brut: string): string | null {
  const utilisateur = JSON.parse(brut)
  return utilisateur && typeof utilisateur === 'object' ? JSON.stringify(traduireObjet(utilisateur)) : null
}

/**
 * Recopie chaque ancienne clé sous son nouveau nom. Sans effet si l'ancienne
 * version n'a rien laissé. Renvoie le nombre de valeurs reprises.
 */
export function migrerStockageLocal(stockage: Storage = localStorage): number {
  let reprises = 0
  try {
    for (const [ancienne, nouvelle, conversion] of CLES) {
      const valeur = stockage.getItem(ancienne)
      if (valeur === null) continue
      // Une valeur déjà écrite par la nouvelle version fait foi.
      if (stockage.getItem(nouvelle) === null) {
        let convertie: string | null = valeur
        try { convertie = conversion ? conversion(valeur) : valeur } catch { convertie = null }
        if (convertie === null) { stockage.removeItem(ancienne); continue } // illisible : rien à reprendre
        stockage.setItem(nouvelle, convertie)
        if (stockage.getItem(nouvelle) !== convertie) continue // écriture refusée : on garde l'ancienne
        reprises++
      }
      stockage.removeItem(ancienne)
    }

    const theme = stockage.getItem(CLE_THEME)
    if (theme !== null && THEMES[theme]) {
      stockage.setItem(CLE_THEME, THEMES[theme])
      reprises++
    }
  } catch {
    /* Stockage indisponible (navigation privée stricte) : rien à reprendre, et
       surtout rien qui doive empêcher l'application de démarrer. */
  }
  return reprises
}

/**
 * L'ancien cache des réponses de l'API (service worker) contient des réponses
 * au FORMAT ANGLAIS. Hors ligne, il pourrait être servi à la nouvelle version,
 * qui n'y trouverait aucun des champs attendus : on l'efface. Le nouveau cache
 * porte un autre nom (`cache-api`, cf. vite.config.ts).
 */
export async function effacerAncienCacheApi(): Promise<void> {
  try { await globalThis.caches?.delete('api-cache') } catch { /* sans effet */ }
}
