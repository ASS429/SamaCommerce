import { describe, it, expect } from 'vitest'
import { productIcon, productTint } from './productIcon'

describe('productIcon — identité visuelle des produits', () => {
  it('reconnaît les produits courants d’une boutique', () => {
    expect(productIcon('Riz parfumé (kg)')).toBe('🍚')
    expect(productIcon('Huile (litre)')).toBe('🧴')
    expect(productIcon('Sucre (kg)')).toBe('🍬')
    expect(productIcon('Eau minérale')).toBe('💧')
    expect(productIcon('Jus en sachet')).toBe('🧃')
  })

  it('ignore les accents et la casse', () => {
    expect(productIcon('CAFÉ TOUBA')).toBe('☕')
    expect(productIcon('thé')).toBe('🍵')
  })

  it('accepte les pluriels', () => {
    expect(productIcon('Oignons')).toBe('🧅')
    expect(productIcon('Oeufs')).toBe('🥚')
  })

  it('ne confond pas des mots qui se contiennent', () => {
    // « pate » (spaghetti) est un préfixe de « patate » : la correspondance
    // doit se faire sur le MOT entier, pas sur la sous-chaîne.
    expect(productIcon('Patate douce')).toBe('🥔')
    expect(productIcon('Pâtes')).toBe('🍝')
  })

  it('gère les mots-clés composés', () => {
    expect(productIcon('Pomme de terre')).toBe('🥔')
    expect(productIcon('Pomme')).toBe('🍎')
  })

  it('reconnaît des termes locaux (wolof)', () => {
    expect(productIcon('Ceeb')).toBe('🍚')
    expect(productIcon('Attaya')).toBe('🍵')
    expect(productIcon('Saabu')).toBe('🧼')
  })

  it('retombe sur l’emoji de la catégorie puis sur un générique', () => {
    expect(productIcon('Article inconnu XYZ', '🥤')).toBe('🥤')
    expect(productIcon('Article inconnu XYZ')).toBe('📦')
    expect(productIcon('')).toBe('📦')
    expect(productIcon(null)).toBe('📦')
  })

  it('donne une teinte stable et valide par produit', () => {
    expect(productTint('Riz')).toBe(productTint('Riz')) // déterministe
    expect(productTint('Riz')).toMatch(/^#[0-9A-F]{6}$/i)
    expect(productTint(null)).toMatch(/^#[0-9A-F]{6}$/i)
  })
})
