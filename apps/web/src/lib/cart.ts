import { displayInfo, type Product, type ProductUnit } from './api'

/**
 * Logique de calcul du panier POS — EXTRACTED pour être testable (T6) et partagée.
 * Règle d'arrondi identique au serveur (SaleController) : tout en entiers (FCFA),
 * `round(qtyBase × prix / facteur)`. Le COGS se calcule sur le facteur d'affichage.
 */
export type CartLine = { product: Product; unit: ProductUnit | null; qtyBase: number; prixReel: number }

/** Facteur vers l'unité de base de la ligne (conditionnement de gros ou détail). */
export const lFactor = (l: CartLine) => (l.unit ? l.unit.facteur : displayInfo(l.product)[1])
/** Prix de référence (catalogue) de l'unité choisie. */
export const lRef = (l: CartLine) => (l.unit ? l.unit.prix : Math.round(Number(l.product.price)))
/** Nombre d'unités de vente (peut être décimal pour le poids). */
export const lCount = (l: CartLine) => l.qtyBase / lFactor(l)
/** Total facturé (prix négocié). */
export const lTotal = (l: CartLine) => Math.round((l.qtyBase * l.prixReel) / lFactor(l))
/** Total au prix de référence (avant remise). */
export const lRefTotal = (l: CartLine) => Math.round((l.qtyBase * lRef(l)) / lFactor(l))
/** Coût de revient (COGS) de la ligne, basé sur le facteur d'affichage. */
export const lCogs = (l: CartLine) => Math.round((l.qtyBase * Number(l.product.price_achat)) / displayInfo(l.product)[1])
/** Libellé de l'unité choisie. */
export const lLabel = (l: CartLine) => (l.unit ? l.unit.libelle : displayInfo(l.product)[0])
/** Prix ramené à l'unité d'affichage (pour comparer au plancher prix_min). */
export const lPerDisplay = (l: CartLine) => Math.round((l.prixReel * displayInfo(l.product)[1]) / lFactor(l))
/** Marge réelle de la ligne (total − COGS). */
export const lMarge = (l: CartLine) => lTotal(l) - lCogs(l)
/** Remise consentie sur la ligne (référence − total). */
export const lRemise = (l: CartLine) => lRefTotal(l) - lTotal(l)
/** true si la ligne passe SOUS le prix plancher du produit. */
export const lSousPlancher = (l: CartLine) => l.product.prix_min != null && lPerDisplay(l) < l.product.prix_min
/** Chaîne « ×2 Sac » / « 1.5 kg ». */
export const qtyStr = (l: CartLine) => {
  const c = lCount(l)
  const cs = Number.isInteger(c) ? String(c) : c.toFixed(c < 1 ? 3 : 2)
  return l.unit ? `×${cs} ${lLabel(l)}` : `${cs} ${lLabel(l)}`
}
/** Total du panier entier. */
export const cartTotal = (cart: CartLine[]) => cart.reduce((s, l) => s + lTotal(l), 0)
