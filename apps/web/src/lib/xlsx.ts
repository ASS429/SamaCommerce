/* Écriture de vrais fichiers .xlsx (Excel / LibreOffice / Google Sheets).
 *
 * POURQUOI PAS DU CSV. Le CSV s'ouvrait « tout collé » : séparateur deviné de
 * travers selon la version d'Excel, montants transformés en dates, aucune mise
 * en forme. Un commerçant qui envoie ce fichier à son comptable passe pour
 * quelqu'un qui bricole. Ici : en-tête figé, colonnes dimensionnées, filtres,
 * montants formatés en F CFA, ligne de totaux.
 *
 * POURQUOI PAS SheetJS. ~400 Ko de bundle pour écrire une feuille. Un .xlsx
 * n'est qu'une archive ZIP de quelques fichiers XML : on l'écrit à la main avec
 * fflate (8 Ko), déjà présent dans l'arbre de dépendances.
 */

// fflate n'est chargé qu'au clic sur « Excel » (même raison que pour le PDF :
// la section Stock n'est pas en lazy, tout import statique gonfle le bundle).

export type XlsxValue = string | number | null | undefined
export type XlsxType = 'text' | 'money' | 'number' | 'percent' | 'date'
export type XlsxColumn = { header: string; width?: number; type?: XlsxType }

export type XlsxDoc = {
  /** Nom de l'onglet (31 caractères max, sans : \ / ? * [ ]). */
  sheet?: string
  /** Titre affiché en A1 (ex. « Inventaire »). */
  title?: string
  /** Ligne de contexte : boutique, période, date d'édition. */
  subtitle?: string
  columns: XlsxColumn[]
  rows: XlsxValue[][]
  /** Ligne de totaux, alignée sur les colonnes (cellules vides autorisées). */
  totals?: XlsxValue[]
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 0 → A, 25 → Z, 26 → AA … */
export function colLetter(index: number): string {
  let s = ''
  let n = index
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 } while (n >= 0)
  return s
}

/* Index des styles déclarés dans styles.xml (ordre de <cellXfs>). */
const S = { base: 0, title: 1, subtitle: 2, header: 3, text: 4, money: 5, number: 6, percent: 7, totalText: 8, totalMoney: 9, totalNumber: 10 } as const

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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

function cell(ref: string, v: XlsxValue, style: number): string {
  if (v === null || v === undefined || v === '') return `<c r="${ref}" s="${style}"/>`
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}" s="${style}"><v>${v}</v></c>`
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`
}

/** Style d'une cellule de données selon le type déclaré de la colonne. */
function styleFor(type: XlsxType | undefined, total: boolean): number {
  if (total) return type === 'money' ? S.totalMoney : type === 'number' || type === 'percent' ? S.totalNumber : S.totalText
  switch (type) {
    case 'money': return S.money
    case 'number': return S.number
    case 'percent': return S.percent
    default: return S.text
  }
}

function sheetXml(doc: XlsxDoc): string {
  const cols = doc.columns
  const lastCol = colLetter(Math.max(0, cols.length - 1))
  const rows: string[] = []
  let r = 0

  if (doc.title) { r++; rows.push(`<row r="${r}" ht="21" customHeight="1">${cell('A' + r, doc.title, S.title)}</row>`) }
  if (doc.subtitle) { r++; rows.push(`<row r="${r}">${cell('A' + r, doc.subtitle, S.subtitle)}</row>`) }
  if (r > 0) r++ // ligne vide de respiration

  const headerRow = r + 1
  rows.push(`<row r="${headerRow}" ht="26" customHeight="1">${cols.map((c, i) => cell(colLetter(i) + headerRow, c.header, S.header)).join('')}</row>`)
  r = headerRow

  for (const line of doc.rows) {
    r++
    rows.push(`<row r="${r}">${cols.map((c, i) => cell(colLetter(i) + r, line[i], styleFor(c.type, false))).join('')}</row>`)
  }
  if (doc.totals) {
    r++
    rows.push(`<row r="${r}">${cols.map((c, i) => cell(colLetter(i) + r, doc.totals![i], styleFor(c.type, true))).join('')}</row>`)
  }

  const widths = cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? Math.max(12, Math.min(40, c.header.length + 6))}" customWidth="1"/>`).join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${widths}</cols>
<sheetData>${rows.join('')}</sheetData>
<autoFilter ref="A${headerRow}:${lastCol}${headerRow}"/>
</worksheet>`
}

/** Construit l'archive .xlsx en mémoire. */
export async function buildXlsx(doc: XlsxDoc): Promise<Blob> {
  const { zipSync, strToU8 } = await import('fflate')
  const sheetName = esc((doc.sheet || 'Feuille1').replace(/[:\\/?*[\]]/g, ' ').slice(0, 31))

  const files: Record<string, Uint8Array> = {
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
<sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    'xl/styles.xml': strToU8(STYLES),
    'xl/worksheets/sheet1.xml': strToU8(sheetXml(doc)),
  }

  return new Blob([zipSync(files, { level: 6 }) as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** Déclenche le téléchargement du classeur. */
export async function exportXlsx(filename: string, doc: XlsxDoc) {
  const blob = await buildXlsx(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
