import { describe, it, expect } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { construireClasseur, lettreColonne } from './xlsx'

/** Décompresse le classeur produit et rend ses parties en texte. */
async function parties(classeur: Parameters<typeof construireClasseur>[0]) {
  const archive = await construireClasseur(classeur)
  const fichiers = unzipSync(new Uint8Array(await archive.arrayBuffer()))
  return Object.fromEntries(Object.entries(fichiers).map(([k, v]) => [k, strFromU8(v)]))
}

describe('lettreColonne', () => {
  it('convertit un indice de colonne en lettre Excel', () => {
    expect(lettreColonne(0)).toBe('A')
    expect(lettreColonne(25)).toBe('Z')
    expect(lettreColonne(26)).toBe('AA')
    expect(lettreColonne(27)).toBe('AB')
  })
})

describe('construireClasseur', () => {
  const classeur = {
    onglet: 'Stock',
    titre: 'Inventaire du stock',
    sousTitre: 'Boutique Ndiaye',
    colonnes: [
      { entete: 'Produit', largeur: 30 },
      { entete: 'Stock', type: 'nombre' as const },
      { entete: 'Valeur', type: 'montant' as const },
    ],
    lignes: [['Riz "parfumé" & thé', 12, 45000], ['Huile', 3, 9000]],
    totaux: ['TOTAL', 15, 54000],
  }

  it('produit une archive contenant les parties obligatoires d\'un .xlsx', async () => {
    const p = await parties(classeur)
    for (const f of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']) {
      expect(p[f], `partie manquante : ${f}`).toBeTruthy()
    }
    expect(p['xl/workbook.xml']).toContain('name="Stock"')
  })

  it('écrit les nombres en valeurs numériques et le texte en chaînes', async () => {
    const feuille = (await parties(classeur))['xl/worksheets/sheet1.xml']
    expect(feuille).toContain('<v>45000</v>')          // montant = nombre, pas du texte
    expect(feuille).toContain('Huile')
  })

  it('échappe les caractères XML dangereux (sinon le fichier est illisible)', async () => {
    const feuille = (await parties(classeur))['xl/worksheets/sheet1.xml']
    expect(feuille).toContain('Riz &quot;parfumé&quot; &amp; thé')
  })

  it('fige l\'en-tête et pose un filtre automatique', async () => {
    const feuille = (await parties(classeur))['xl/worksheets/sheet1.xml']
    expect(feuille).toContain('state="frozen"')
    expect(feuille).toContain('<autoFilter ref="A4:C4"/>') // titre + sous-titre + ligne vide
  })

  it('nettoie un nom d\'onglet interdit par Excel', async () => {
    const p = await parties({ ...classeur, onglet: 'Ventes/2026:[jan]' })
    const nom = p['xl/workbook.xml'].match(/<sheet name="([^"]*)"/)?.[1] ?? ''
    // Excel refuse : \ / ? * [ ] et les noms de plus de 31 caractères.
    expect(nom).not.toMatch(/[:\\/?*[\]]/)
    expect(nom).toContain('Ventes')
    expect(nom.length).toBeLessThanOrEqual(31)
  })

  it('tronque un nom d\'onglet trop long', async () => {
    const p = await parties({ ...classeur, onglet: 'Un titre vraiment beaucoup trop long pour Excel' })
    const nom = p['xl/workbook.xml'].match(/<sheet name="([^"]*)"/)?.[1] ?? ''
    expect(nom.length).toBe(31)
  })
})
