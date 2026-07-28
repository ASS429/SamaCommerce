/* Identité VISUELLE des produits.
 *
 * Pourquoi : la majorité des commerçants visés ne lisent pas couramment. Dans
 * une boutique réelle, on reconnaît la marchandise à l'œil. Une liste de noms
 * écrits est donc inutilisable ; chaque produit doit porter une image.
 *
 * Comment : on déduit un pictogramme du NOM du produit (aucune saisie
 * supplémentaire, et ça marche aussi pour les produits déjà enregistrés).
 * Chaîne de repli : mot-clé du nom → emoji de la catégorie → caisse générique.
 *
 * Choix des pictogrammes : uniquement des emoji ANCIENS et largement supportés.
 * Sur un téléphone d'entrée de gamme, un emoji trop récent s'affiche en carré
 * vide — pour un utilisateur qui ne lit pas, ce serait pire que tout.
 */

/** Retire les accents et met en minuscules (« Riz parfumé » → « riz parfume »). */
function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/* Mots-clés → pictogramme. Français + termes courants au Sénégal (wolof).
 * L'ordre compte : le premier mot-clé trouvé gagne, donc on place les termes
 * spécifiques avant les génériques (« huile de palme » avant « huile »). */
const RULES: [string[], string][] = [
  // Céréales & féculents
  [['riz', 'ceeb'], '🍚'],
  [['pain', 'baguette', 'mburu'], '🍞'],
  [['spaghetti', 'pate', 'macaroni', 'nouille'], '🍝'],
  [['farine', 'ble', 'mil', 'mais', 'sorgho', 'couscous', 'thiere'], '🌾'],
  [['haricot', 'niebe', 'lentille', 'pois'], '🫘'],

  // Épicerie de base
  [['huile'], '🧴'],
  [['sucre', 'suukar'], '🍬'],
  [['sel', 'khorom'], '🧂'],
  [['tomate', 'concentre'], '🍅'],
  [['oignon', 'soble'], '🧅'],
  [['ail'], '🧄'],
  [['piment', 'kani'], '🌶️'],
  [['arachide', 'cacahuete', 'gerte'], '🥜'],
  [['miel'], '🍯'],
  [['beurre'], '🧈'],
  [['fromage'], '🧀'],
  [['oeuf', 'nen'], '🥚'],
  [['cube', 'bouillon', 'jumbo', 'maggi'], '🧊'],

  // Boissons
  [['eau', 'ndox'], '💧'],
  [['jus', 'bissap', 'bouye', 'ditakh'], '🧃'],
  [['soda', 'coca', 'fanta', 'sprite', 'gazeuse', 'boisson'], '🥤'],
  [['lait', 'meew'], '🥛'],
  [['cafe', 'nescafe', 'touba'], '☕'],
  [['the', 'attaya', 'warga'], '🍵'],

  // Frais
  [['poisson', 'thiof', 'yaboy', 'jen'], '🐟'],
  [['viande', 'boeuf', 'mouton', 'yapp'], '🥩'],
  [['poulet', 'volaille', 'ganaar'], '🍗'],
  [['banane'], '🍌'],
  [['orange', 'mandarine'], '🍊'],
  [['mangue', 'mango'], '🥭'],
  [['pasteque', 'melon'], '🍉'],
  [['patate', 'pomme de terre'], '🥔'], // avant « pomme » : sinon le fruit gagne
  [['pomme'], '🍎'],
  [['citron'], '🍋'],
  [['carotte'], '🥕'],
  [['legume', 'salade'], '🥬'],

  // Snacks & sucreries
  [['biscuit', 'gateau', 'cake'], '🍪'],
  [['bonbon', 'sucette', 'chocolat'], '🍫'],
  [['glace', 'creme glacee'], '🍦'],
  [['chips'], '🍟'],

  // Hygiène & entretien
  [['savon', 'saabu'], '🧼'],
  [['lessive', 'omo', 'detergent', 'javel'], '🧴'],
  [['papier', 'mouchoir', 'serviette'], '🧻'],
  [['dentifrice', 'brosse a dent'], '🦷'],
  [['couche', 'pampers'], '🍼'],
  [['parfum', 'deodorant'], '💨'],

  // Maison & divers
  [['allumette', 'briquet', 'charbon', 'gaz'], '🔥'],
  [['bougie'], '🕯️'],
  [['pile', 'batterie'], '🔋'],
  [['ampoule', 'lampe'], '💡'],
  [['recharge', 'credit', 'forfait', 'puce', 'sim'], '📱'],
  [['cigarette', 'tabac'], '🚬'],
  [['medicament', 'paracetamol', 'pharmacie'], '💊'],
  [['cahier', 'stylo', 'crayon', 'livre', 'fourniture'], '📒'],
  [['chaussure', 'sandale'], '👟'],
  [['vetement', 'tissu', 'pagne', 'habit'], '👕'],
  [['sachet', 'sac'], '🛍️'],
  [['ciment', 'brique'], '🧱'],
]

/** Pictogramme d'un produit : mot-clé du nom, sinon emoji de la catégorie, sinon caisse. */
export function productIcon(name?: string | null, categoryEmoji?: string | null): string {
  const n = normalize(name || '')
  if (n) {
    // Découpage en MOTS : une correspondance par sous-chaîne ferait matcher
    // « pate » dans « patate » (spaghetti au lieu de pomme de terre).
    const words = n.split(/[^a-z0-9]+/).filter(Boolean)
    const matches = (kw: string) =>
      kw.includes(' ')
        ? n.includes(kw) // mot-clé composé (« pomme de terre »)
        : words.some((w) => w === kw || w === kw + 's' || w === kw + 'x') // + pluriels

    for (const [keywords, icon] of RULES) {
      if (keywords.some(matches)) return icon
    }
  }
  return categoryEmoji || '📦'
}

/* Teinte de fond dérivée du nom : deux produits voisins n'ont jamais la même
 * pastille, ce qui aide à les distinguer même quand le pictogramme est proche.
 * Palette douce (le pictogramme doit rester l'élément dominant). */
const TINTS = ['#EDE9FE', '#DBEAFE', '#DCFCE7', '#FEF3C7', '#FCE7F3', '#E0F2FE', '#FEE2E2', '#F3E8FF']

export function productTint(name?: string | null): string {
  const s = name || ''
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return TINTS[h % TINTS.length]
}
