import { describe, expect, it } from 'vitest'
import { TEINTES, teinteDe } from './teinte'

describe('teinteDe — couleur stable des rayons', () => {
  it('rend toujours la même couleur pour le même nom', () => {
    expect(teinteDe('Boissons')).toBe(teinteDe('Boissons'))
    expect(teinteDe('Céréales')).toBe(teinteDe('Céréales'))
  })

  it('ne rend qu\'une couleur du jeu défini', () => {
    for (const nom of ['Boissons', 'Céréales', 'Hygiène', 'Conserves', 'Sucreries', 'Épicerie', '', 'x']) {
      expect(TEINTES).toContain(teinteDe(nom))
    }
  })

  /* Le vrai risque : indexer sur la position dans la liste. Ajouter un rayon
     repeindrait alors tous les suivants, et le commerçant qui repère son
     rayon à la couleur ne le retrouverait plus. */
  it('ne dépend pas de l\'ordre ni du nombre de rayons', () => {
    const avant = ['Céréales', 'Boissons'].map(teinteDe)
    const apres = ['Hygiène', 'Céréales', 'Conserves', 'Boissons'].map(teinteDe)
    expect(apres[1]).toBe(avant[0])
    expect(apres[3]).toBe(avant[1])
  })

  /* La francisation a renommé les teintes : chaque rayon doit pourtant garder
     SA couleur. Ces valeurs sont celles qu'affichait l'application avant
     (Boissons « green », Céréales « violet », Alimentation « pink »,
     Hygiène « teal »). */
  it('garde à chaque rayon la couleur qu\'il avait avant la francisation', () => {
    const attendu: Record<string, string> = { Boissons: 'vert', Céréales: 'violet', Alimentation: 'rose', Hygiène: 'sarcelle' }
    for (const [nom, teinte] of Object.entries(attendu)) expect(teinteDe(nom)).toBe(teinte)
  })

  it('accepte un nom absent sans planter', () => {
    expect(TEINTES).toContain(teinteDe(null))
    expect(TEINTES).toContain(teinteDe(undefined))
  })

  /* Deux rayons voisins dans la liste ne doivent pas se retrouver de la même
     couleur trop souvent : sinon la teinte cesse d'identifier quoi que ce soit. */
  it('répartit les noms courants sur plusieurs couleurs', () => {
    const noms = ['Céréales', 'Boissons', 'Hygiène', 'Conserves', 'Sucreries', 'Épicerie']
    expect(new Set(noms.map(teinteDe)).size).toBeGreaterThanOrEqual(3)
  })
})
