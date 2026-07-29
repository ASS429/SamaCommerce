import { describe, it, expect } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { buildXlsx, colLetter } from './xlsx'

/** Décompresse le classeur produit et rend ses parties en texte. */
async function parts(doc: Parameters<typeof buildXlsx>[0]) {
  const blob = await buildXlsx(doc)
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  return Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strFromU8(v)]))
}

describe('colLetter', () => {
  it('convertit un index de colonne en lettre Excel', () => {
    expect(colLetter(0)).toBe('A')
    expect(colLetter(25)).toBe('Z')
    expect(colLetter(26)).toBe('AA')
    expect(colLetter(27)).toBe('AB')
  })
})

describe('buildXlsx', () => {
  const doc = {
    sheet: 'Stock',
    title: 'Inventaire du stock',
    subtitle: 'Boutique Ndiaye',
    columns: [
      { header: 'Produit', width: 30 },
      { header: 'Stock', type: 'number' as const },
      { header: 'Valeur', type: 'money' as const },
    ],
    rows: [['Riz "parfumé" & thé', 12, 45000], ['Huile', 3, 9000]],
    totals: ['TOTAL', 15, 54000],
  }

  it('produit une archive contenant les parties obligatoires d\'un .xlsx', async () => {
    const p = await parts(doc)
    for (const f of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']) {
      expect(p[f], `partie manquante : ${f}`).toBeTruthy()
    }
    expect(p['xl/workbook.xml']).toContain('name="Stock"')
  })

  it('écrit les nombres en valeurs numériques et le texte en chaînes', async () => {
    const sheet = (await parts(doc))['xl/worksheets/sheet1.xml']
    expect(sheet).toContain('<v>45000</v>')          // montant = nombre, pas du texte
    expect(sheet).toContain('Huile')
  })

  it('échappe les caractères XML dangereux (sinon le fichier est illisible)', async () => {
    const sheet = (await parts(doc))['xl/worksheets/sheet1.xml']
    expect(sheet).toContain('Riz &quot;parfumé&quot; &amp; thé')
  })

  it('fige l\'en-tête et pose un filtre automatique', async () => {
    const sheet = (await parts(doc))['xl/worksheets/sheet1.xml']
    expect(sheet).toContain('state="frozen"')
    expect(sheet).toContain('<autoFilter ref="A4:C4"/>') // titre + sous-titre + ligne vide
  })

  it('nettoie un nom d\'onglet interdit par Excel', async () => {
    const p = await parts({ ...doc, sheet: 'Ventes/2026:[jan]' })
    const nom = p['xl/workbook.xml'].match(/<sheet name="([^"]*)"/)?.[1] ?? ''
    // Excel refuse : \ / ? * [ ] et les noms de plus de 31 caractères.
    expect(nom).not.toMatch(/[:\\/?*[\]]/)
    expect(nom).toContain('Ventes')
    expect(nom.length).toBeLessThanOrEqual(31)
  })

  it('tronque un nom d\'onglet trop long', async () => {
    const p = await parts({ ...doc, sheet: 'Un titre vraiment beaucoup trop long pour Excel' })
    const nom = p['xl/workbook.xml'].match(/<sheet name="([^"]*)"/)?.[1] ?? ''
    expect(nom.length).toBe(31)
  })
})
