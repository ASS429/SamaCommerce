import { describe, it, expect } from 'vitest'
import { iconeProduit, fondProduit } from './iconeProduit'

describe('iconeProduit — identité visuelle des produits', () => {
  it('reconnaît les produits courants d’une boutique', () => {
    expect(iconeProduit('Riz parfumé (kg)')).toBe('🍚')
    expect(iconeProduit('Huile (litre)')).toBe('🧴')
    expect(iconeProduit('Sucre (kg)')).toBe('🍬')
    expect(iconeProduit('Eau minérale')).toBe('💧')
    expect(iconeProduit('Jus en sachet')).toBe('🧃')
  })

  it('ignore les accents et la casse', () => {
    expect(iconeProduit('CAFÉ TOUBA')).toBe('☕')
    expect(iconeProduit('thé')).toBe('🍵')
  })

  it('accepte les pluriels', () => {
    expect(iconeProduit('Oignons')).toBe('🧅')
    expect(iconeProduit('Oeufs')).toBe('🥚')
  })

  it('ne confond pas des mots qui se contiennent', () => {
    // « pate » (spaghetti) est un préfixe de « patate » : la correspondance
    // doit se faire sur le MOT entier, pas sur la sous-chaîne.
    expect(iconeProduit('Patate douce')).toBe('🥔')
    expect(iconeProduit('Pâtes')).toBe('🍝')
  })

  it('gère les mots-clés composés', () => {
    expect(iconeProduit('Pomme de terre')).toBe('🥔')
    expect(iconeProduit('Pomme')).toBe('🍎')
  })

  it('reconnaît des termes locaux (wolof)', () => {
    expect(iconeProduit('Ceeb')).toBe('🍚')
    expect(iconeProduit('Attaya')).toBe('🍵')
    expect(iconeProduit('Saabu')).toBe('🧼')
  })

  it('retombe sur l’emoji de la catégorie puis sur un générique', () => {
    expect(iconeProduit('Article inconnu XYZ', '🥤')).toBe('🥤')
    expect(iconeProduit('Article inconnu XYZ')).toBe('📦')
    expect(iconeProduit('')).toBe('📦')
    expect(iconeProduit(null)).toBe('📦')
  })

  it('donne une teinte stable et valide par produit', () => {
    expect(fondProduit('Riz')).toBe(fondProduit('Riz')) // déterministe
    expect(fondProduit('Riz')).toMatch(/^#[0-9A-F]{6}$/i)
    expect(fondProduit(null)).toMatch(/^#[0-9A-F]{6}$/i)
  })
})
