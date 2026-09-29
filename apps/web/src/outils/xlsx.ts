/* Écriture de vrais fichiers .xlsx (Excel / LibreOffice / Google Sheets).
 *
 * POURQUOI PAS DU CSV. Le CSV s'ouvrait « tout collé » : séparateur deviné de
 * travers selon la version d'Excel, montants transformés en dates, aucune mise
 * en forme. Un commerçant qui envoie ce fichier à son comptable passe pour
 * quelqu'un qui bricole. Ici : en-tête figé, colonnes dimensionnées, filtres,
 * montants formatés en F CFA, ligne de totaux.
 *
 * POURQUOI PAS SheetJS. ~400 Ko de paquet pour écrire une feuille. Un .xlsx
 * n'est qu'une archive ZIP de quelques fichiers XML : on l'écrit à la main avec
 * fflate (8 Ko), déjà présent dans l'arbre de dépendances.
 *
 * Les noms de fichiers et de balises XML (`workbook.xml`, `<sheetData>`…) sont
 * imposés par le format Office Open XML : ils ne se traduisent pas.
 */

// fflate n'est chargé qu'au clic sur « Excel » (même raison que pour le PDF :
// la section Stock n'est pas différée, tout import statique alourdit le paquet).

export type ValeurCellule = string | number | null | undefined
export type TypeColonne = 'texte' | 'montant' | 'nombre' | 'pourcentage' | 'date'
export type ColonneClasseur = { entete: string; largeur?: number; type?: TypeColonne }

export type Classeur = {
  /** Nom de l'onglet (31 caractères max, sans : \ / ? * [ ]). */
  onglet?: string
  /** Titre affiché en A1 (ex. « Inventaire »). */
  titre?: string
  /** Ligne de contexte : boutique, période, date d'édition. */
  sousTitre?: string
  colonnes: ColonneClasseur[]
  lignes: ValeurCellule[][]
  /** Ligne de totaux, alignée sur les colonnes (cellules vides autorisées). */
  totaux?: ValeurCellule[]
}

const echapper = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 0 → A, 25 → Z, 26 → AA … */
export function lettreColonne(indice: number): string {
  let s = ''
  let n = indice
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 } while (n >= 0)
  return s
}

/* Indices des styles déclarés dans styles.xml (ordre de <cellXfs>). */
const STYLE = { base: 0, titre: 1, sousTitre: 2, entete: 3, texte: 4, montant: 5, nombre: 6, pourcentage: 7, texteTotal: 8, montantTotal: 9, nombreTotal: 10 } as const

const FEUILLE_DE_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0&quot; F&quot;"/><numFmt numFmtId="165" formatCode="0.0&quot; %&quot;"/></numFmts>
<fonts count="5">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="16"/><color rgb="FF5B21B6"/><name val="Calibri"/></font>
<font><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF1E1B4B"/><name val="Calibri"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF7C3AED"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEDE9FE"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFE7E2F7"/></left><right style="thin"><color rgb="FFE7E2F7"/></right><top style="thin"><color rgb="FFE7E2F7"/></top><bottom style="thin"><color rgb="FFE7E2F7"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="11">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="4" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>
</cellXfs>
</styleSheet>`

function cellule(reference: string, v: ValeurCellule, style: number): string {
  if (v === null || v === undefined || v === '') return `<c r="${reference}" s="${style}"/>`
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${reference}" s="${style}"><v>${v}</v></c>`
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${echapper(String(v))}</t></is></c>`
}

/** Style d'une cellule de données selon le type déclaré de la colonne. */
function styleDe(type: TypeColonne | undefined, total: boolean): number {
  if (total) return type === 'montant' ? STYLE.montantTotal : type === 'nombre' || type === 'pourcentage' ? STYLE.nombreTotal : STYLE.texteTotal
  switch (type) {
    case 'montant': return STYLE.montant
    case 'nombre': return STYLE.nombre
    case 'pourcentage': return STYLE.pourcentage
    default: return STYLE.texte
  }
}

function xmlFeuille(classeur: Classeur): string {
  const colonnes = classeur.colonnes
  const derniereColonne = lettreColonne(Math.max(0, colonnes.length - 1))
  const rangees: string[] = []
  let r = 0

  if (classeur.titre) { r++; rangees.push(`<row r="${r}" ht="21" customHeight="1">${cellule('A' + r, classeur.titre, STYLE.titre)}</row>`) }
  if (classeur.sousTitre) { r++; rangees.push(`<row r="${r}">${cellule('A' + r, classeur.sousTitre, STYLE.sousTitre)}</row>`) }
  if (r > 0) r++ // ligne vide de respiration

  const rangeeEntete = r + 1
  rangees.push(`<row r="${rangeeEntete}" ht="26" customHeight="1">${colonnes.map((c, i) => cellule(lettreColonne(i) + rangeeEntete, c.entete, STYLE.entete)).join('')}</row>`)
  r = rangeeEntete

  for (const ligne of classeur.lignes) {
    r++
    rangees.push(`<row r="${r}">${colonnes.map((c, i) => cellule(lettreColonne(i) + r, ligne[i], styleDe(c.type, false))).join('')}</row>`)
  }
  if (classeur.totaux) {
    r++
    rangees.push(`<row r="${r}">${colonnes.map((c, i) => cellule(lettreColonne(i) + r, classeur.totaux![i], styleDe(c.type, true))).join('')}</row>`)
  }

  const largeurs = colonnes.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largeur ?? Math.max(12, Math.min(40, c.entete.length + 6))}" customWidth="1"/>`).join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${rangeeEntete}" topLeftCell="A${rangeeEntete + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${largeurs}</cols>
<sheetData>${rangees.join('')}</sheetData>
<autoFilter ref="A${rangeeEntete}:${derniereColonne}${rangeeEntete}"/>
</worksheet>`
}

/** Construit l'archive .xlsx en mémoire. */
export async function construireClasseur(classeur: Classeur): Promise<Blob> {
  const { zipSync, strToU8 } = await import('fflate')
  const nomOnglet = echapper((classeur.onglet || 'Feuille1').replace(/[:\\/?*[\]]/g, ' ').slice(0, 31))

  const fichiers: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${nomOnglet}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    'xl/styles.xml': strToU8(FEUILLE_DE_STYLES),
    'xl/worksheets/sheet1.xml': strToU8(xmlFeuille(classeur)),
  }

  return new Blob([zipSync(fichiers, { level: 6 }) as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** Déclenche le téléchargement du classeur. */
export async function exporterClasseur(nomFichier: string, classeur: Classeur) {
  const blob = await construireClasseur(classeur)
  const adresse = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = adresse
  lien.download = nomFichier.endsWith('.xlsx') ? nomFichier : `${nomFichier}.xlsx`
  lien.click()
  setTimeout(() => URL.revokeObjectURL(adresse), 1000)
}
