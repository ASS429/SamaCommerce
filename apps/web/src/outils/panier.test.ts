import { describe, it, expect } from 'vitest'
import {
  totalLigne, totalReferenceLigne, coutLigne, nombreLigne, prixParAffichage, margeLigne, remiseLigne, sousPlancher,
  totalPanier, texteQuantite, type LignePanier,
} from './panier'
import type { Produit, Conditionnement } from './api'

// Produits de test
const riz: Produit = { id: 1, nom: 'Riz', categorie_id: null, description: null, prix_vente: 500, prix_achat: 350, stock: 50000, unite_base: 'g', prix_min: 400, negociable: true }
const savon: Produit = { id: 2, nom: 'Savon', categorie_id: null, description: null, prix_vente: 300, prix_achat: 200, stock: 100, unite_base: 'piece', prix_min: null, negociable: false }
const sac: Conditionnement = { id: 9, produit_id: 1, libelle: 'Sac 50kg', facteur: 50000, prix: 27000 }

const ligne = (surcharge: Partial<LignePanier> & { produit: Produit }): LignePanier => ({ conditionnement: null, quantiteBase: 1, prixReel: 0, ...surcharge })

describe('panier — calculs du point de vente (miroir du serveur, entiers)', () => {
  it('détail au poids : 730 g de riz à 500/kg = 365 F', () => {
    const l = ligne({ produit: riz, quantiteBase: 730, prixReel: 500 })
    expect(nombreLigne(l)).toBeCloseTo(0.73)
    expect(totalLigne(l)).toBe(365)
    expect(coutLigne(l)).toBe(Math.round(730 * 350 / 1000)) // 256
    expect(margeLigne(l)).toBe(365 - 256)
  })

  it('pièce : 3 savons à 300 = 900 F, aucune remise', () => {
    const l = ligne({ produit: savon, quantiteBase: 3, prixReel: 300 })
    expect(totalLigne(l)).toBe(900)
    expect(totalReferenceLigne(l)).toBe(900)
    expect(remiseLigne(l)).toBe(0)
    expect(coutLigne(l)).toBe(600)
  })

  it('négociation : 1 kg de riz vendu 400 au lieu de 500 → remise 100', () => {
    const l = ligne({ produit: riz, quantiteBase: 1000, prixReel: 400 })
    expect(totalLigne(l)).toBe(400)
    expect(totalReferenceLigne(l)).toBe(500)
    expect(remiseLigne(l)).toBe(100)
  })

  it('conditionnement de gros : 1 sac 50kg = 27000, coût sur 50kg', () => {
    const l = ligne({ produit: riz, conditionnement: sac, quantiteBase: 50000, prixReel: 27000 })
    expect(totalLigne(l)).toBe(27000)
    expect(coutLigne(l)).toBe(Math.round(50000 * 350 / 1000)) // 17500
    expect(texteQuantite(l)).toBe('×1 Sac 50kg')
  })

  it('plancher : prix ramené à l\'unité d\'affichage vs prix_min', () => {
    const correct = ligne({ produit: riz, quantiteBase: 1000, prixReel: 450 })
    const dessous = ligne({ produit: riz, quantiteBase: 1000, prixReel: 350 })
    expect(prixParAffichage(correct)).toBe(450)
    expect(sousPlancher(correct)).toBe(false)
    expect(prixParAffichage(dessous)).toBe(350)
    expect(sousPlancher(dessous)).toBe(true) // 350 < 400
  })

  it('un produit sans plancher n\'est jamais « sous plancher »', () => {
    const l = ligne({ produit: savon, quantiteBase: 1, prixReel: 1 })
    expect(sousPlancher(l)).toBe(false)
  })

  it('total du panier = somme des lignes', () => {
    const panier = [
      ligne({ produit: savon, quantiteBase: 2, prixReel: 300 }), // 600
      ligne({ produit: riz, quantiteBase: 1000, prixReel: 500 }), // 500
    ]
    expect(totalPanier(panier)).toBe(1100)
  })
})
