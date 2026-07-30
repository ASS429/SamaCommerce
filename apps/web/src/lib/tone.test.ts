import { describe, expect, it } from 'vitest'
import { TONES, toneOf } from './tone'

describe('toneOf — couleur stable des rayons', () => {
  it('rend toujours la même couleur pour le même nom', () => {
    expect(toneOf('Boissons')).toBe(toneOf('Boissons'))
    expect(toneOf('Céréales')).toBe(toneOf('Céréales'))
  })

  it('ne rend qu\'une couleur du jeu défini', () => {
    for (const nom of ['Boissons', 'Céréales', 'Hygiène', 'Conserves', 'Sucreries', 'Épicerie', '', 'x']) {
      expect(TONES).toContain(toneOf(nom))
    }
  })

  /* Le vrai risque : indexer sur la position dans la liste. Ajouter un rayon
     repeindrait alors tous les suivants, et le commerçant qui repère son
     rayon à la couleur ne le retrouverait plus. */
  it('ne dépend pas de l\'ordre ni du nombre de rayons', () => {
    const avant = ['Céréales', 'Boissons'].map(toneOf)
    const apres = ['Hygiène', 'Céréales', 'Conserves', 'Boissons'].map(toneOf)
    expect(apres[1]).toBe(avant[0])
    expect(apres[3]).toBe(avant[1])
  })

  it('accepte un nom absent sans planter', () => {
    expect(TONES).toContain(toneOf(null))
    expect(TONES).toContain(toneOf(undefined))
  })

  /* Deux rayons voisins dans la liste ne doivent pas se retrouver de la même
     couleur trop souvent : sinon la teinte cesse d'identifier quoi que ce soit. */
  it('répartit les noms courants sur plusieurs couleurs', () => {
    const noms = ['Céréales', 'Boissons', 'Hygiène', 'Conserves', 'Sucreries', 'Épicerie']
    expect(new Set(noms.map(toneOf)).size).toBeGreaterThanOrEqual(3)
  })
})
