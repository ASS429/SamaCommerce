import { describe, it, expect } from 'vitest'
import {
  lTotal, lRefTotal, lCogs, lCount, lPerDisplay, lMarge, lRemise, lSousPlancher, cartTotal, qtyStr, type CartLine,
} from './cart'
import type { Product, ProductUnit } from './api'

// Produits de test
const riz: Product = { id: 1, name: 'Riz', category_id: null, scent: null, price: 500, price_achat: 350, stock: 50000, unite_base: 'g', prix_min: 400, negociable: true }
const savon: Product = { id: 2, name: 'Savon', category_id: null, scent: null, price: 300, price_achat: 200, stock: 100, unite_base: 'piece', prix_min: null, negociable: false }
const sac: ProductUnit = { id: 9, product_id: 1, libelle: 'Sac 50kg', facteur: 50000, prix: 27000 }

const line = (over: Partial<CartLine> & { product: Product }): CartLine => ({ unit: null, qtyBase: 1, prixReel: 0, ...over })

describe('cart — calculs POS (miroir serveur, entiers)', () => {
  it('détail au poids : 730 g de riz à 500/kg = 365 F', () => {
    const l = line({ product: riz, qtyBase: 730, prixReel: 500 })
    expect(lCount(l)).toBeCloseTo(0.73)
    expect(lTotal(l)).toBe(365)
    expect(lCogs(l)).toBe(Math.round(730 * 350 / 1000)) // 256
    expect(lMarge(l)).toBe(365 - 256)
  })

  it('pièce : 3 savons à 300 = 900 F, aucune remise', () => {
    const l = line({ product: savon, qtyBase: 3, prixReel: 300 })
    expect(lTotal(l)).toBe(900)
    expect(lRefTotal(l)).toBe(900)
    expect(lRemise(l)).toBe(0)
    expect(lCogs(l)).toBe(600)
  })

  it('négociation : 1 kg de riz vendu 400 au lieu de 500 → remise 100', () => {
    const l = line({ product: riz, qtyBase: 1000, prixReel: 400 })
    expect(lTotal(l)).toBe(400)
    expect(lRefTotal(l)).toBe(500)
    expect(lRemise(l)).toBe(100)
  })

  it('conditionnement de gros : 1 sac 50kg = 27000, cogs sur 50kg', () => {
    const l = line({ product: riz, unit: sac, qtyBase: 50000, prixReel: 27000 })
    expect(lTotal(l)).toBe(27000)
    expect(lCogs(l)).toBe(Math.round(50000 * 350 / 1000)) // 17500
    expect(qtyStr(l)).toBe('×1 Sac 50kg')
  })

  it('plancher : prix ramené à l\'unité d\'affichage vs prix_min', () => {
    const ok = line({ product: riz, qtyBase: 1000, prixReel: 450 })
    const sous = line({ product: riz, qtyBase: 1000, prixReel: 350 })
    expect(lPerDisplay(ok)).toBe(450)
    expect(lSousPlancher(ok)).toBe(false)
    expect(lPerDisplay(sous)).toBe(350)
    expect(lSousPlancher(sous)).toBe(true) // 350 < 400
  })

  it('produit sans plancher n\'est jamais "sous plancher"', () => {
    const l = line({ product: savon, qtyBase: 1, prixReel: 1 })
    expect(lSousPlancher(l)).toBe(false)
  })

  it('total du panier = somme des lignes', () => {
    const cart = [
      line({ product: savon, qtyBase: 2, prixReel: 300 }), // 600
      line({ product: riz, qtyBase: 1000, prixReel: 500 }), // 500
    ]
    expect(cartTotal(cart)).toBe(1100)
  })
})
