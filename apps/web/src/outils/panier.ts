import { infosAffichage, type Produit, type Conditionnement } from './api'

/**
 * Logique de calcul du panier du point de vente — EXTRAITE pour être testable
 * (T6) et partagée. Règle d'arrondi identique au serveur (ControleurVente) :
 * tout en entiers (FCFA), `round(quantiteBase × prix / facteur)`. Le coût des
 * marchandises se calcule sur le facteur d'affichage.
 */
export type LignePanier = { produit: Produit; conditionnement: Conditionnement | null; quantiteBase: number; prixReel: number }

/** Facteur vers l'unité de base de la ligne (conditionnement de gros ou détail). */
export const facteurLigne = (l: LignePanier) => (l.conditionnement ? l.conditionnement.facteur : infosAffichage(l.produit)[1])
/** Prix de référence (catalogue) de l'unité choisie. */
export const prixReferenceLigne = (l: LignePanier) => (l.conditionnement ? l.conditionnement.prix : Math.round(Number(l.produit.prix_vente)))
/** Nombre d'unités de vente (peut être décimal pour le poids). */
export const nombreLigne = (l: LignePanier) => l.quantiteBase / facteurLigne(l)
/** Total facturé (prix négocié). */
export const totalLigne = (l: LignePanier) => Math.round((l.quantiteBase * l.prixReel) / facteurLigne(l))
/** Total au prix de référence (avant remise). */
export const totalReferenceLigne = (l: LignePanier) => Math.round((l.quantiteBase * prixReferenceLigne(l)) / facteurLigne(l))
/** Coût des marchandises de la ligne, basé sur le facteur d'affichage. */
export const coutLigne = (l: LignePanier) => Math.round((l.quantiteBase * Number(l.produit.prix_achat)) / infosAffichage(l.produit)[1])
/** Libellé de l'unité choisie. */
export const libelleLigne = (l: LignePanier) => (l.conditionnement ? l.conditionnement.libelle : infosAffichage(l.produit)[0])
/** Prix ramené à l'unité d'affichage (pour comparer au plancher prix_min). */
export const prixParAffichage = (l: LignePanier) => Math.round((l.prixReel * infosAffichage(l.produit)[1]) / facteurLigne(l))
/** Marge réelle de la ligne (total − coût). */
export const margeLigne = (l: LignePanier) => totalLigne(l) - coutLigne(l)
/** Remise consentie sur la ligne (référence − total). */
export const remiseLigne = (l: LignePanier) => totalReferenceLigne(l) - totalLigne(l)
/** true si la ligne passe SOUS le prix plancher du produit. */
export const sousPlancher = (l: LignePanier) => l.produit.prix_min != null && prixParAffichage(l) < l.produit.prix_min
/** Chaîne « ×2 Sac » / « 1.5 kg ». */
export const texteQuantite = (l: LignePanier) => {
  const n = nombreLigne(l)
  const ns = Number.isInteger(n) ? String(n) : n.toFixed(n < 1 ? 3 : 2)
  return l.conditionnement ? `×${ns} ${libelleLigne(l)}` : `${ns} ${libelleLigne(l)}`
}
/** Total du panier entier. */
export const totalPanier = (panier: LignePanier[]) => panier.reduce((s, l) => s + totalLigne(l), 0)
