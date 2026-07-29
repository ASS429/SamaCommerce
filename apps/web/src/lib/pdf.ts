/* Documents PDF de la boutique (chiffres, caisse, crédits, inventaire…).
 *
 * Avant : `doc.text('SamaCommerce — Caisse')` puis un tableau brut, sans
 * accents (« especes », « Rembourse »), sans nom de boutique, sans date, sans
 * pagination. Ce document circule pourtant : on le montre au comptable, à la
 * banque, au fournisseur, parfois à un bailleur pour un microcrédit.
 *
 * Ici : bandeau d'en-tête aux couleurs de la boutique, cartouches de synthèse,
 * tableau zébré, ligne de totaux, pied de page paginé. Tout est SYNCHRONE
 * (aucune image à charger) pour que l'export marche aussi hors-ligne.
 */

/* jsPDF + autoTable pèsent ~180 Ko : ils sont chargés À LA DEMANDE, au clic sur
 * « PDF ». Sinon la section Stock (non lazy) les embarquerait dans le bundle
 * principal — inacceptable sur une connexion 3G de marché. Les imports
 * ci-dessous sont donc de TYPE uniquement (effacés à la compilation). */
import type jsPDF from 'jspdf'
import type { RowInput } from 'jspdf-autotable'

/** Palette de la charte, en RVB (jsPDF ne prend pas l'hexadécimal partout). */
const VIOLET: [number, number, number] = [124, 58, 237]
const VIOLET_DARK: [number, number, number] = [91, 33, 182]
const INK: [number, number, number] = [30, 27, 75]
const MUTED: [number, number, number] = [107, 114, 128]
const TINT: [number, number, number] = [237, 233, 254]

const MARGIN = 14

/** Montant sans espace insécable : jsPDF ne sait pas rendre U+202F. */
export const money = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0)).replace(/[\u202f\u00a0]/g, ' ') + ' F'

export type PdfSummary = { label: string; value: string; tone?: 'brand' | 'green' | 'red' | 'orange' }

export type PdfSpec = {
  /** Titre du document (« Chiffres », « Caisse du jour »…). */
  title: string
  /** Sous-titre : période couverte, filtre appliqué… */
  subtitle?: string
  boutique: { nom: string; telephone?: string | null }
  /** Cartouches de synthèse affichés sous l'en-tête. */
  summary?: PdfSummary[]
  columns: string[]
  rows: RowInput[]
  /** Ligne de totaux (mise en avant en pied de tableau). */
  foot?: RowInput
  /** Colonnes à aligner à droite (indices) — typiquement les montants. */
  rightAlign?: number[]
  /** Note libre imprimée sous le tableau. */
  note?: string
}

const TONES: Record<string, [number, number, number]> = {
  brand: VIOLET, green: [16, 185, 129], red: [239, 68, 68], orange: [245, 158, 11],
}

/** Bandeau violet : identité de la boutique + nature du document. */
function drawHeader(doc: jsPDF, spec: PdfSpec) {
  const w = doc.internal.pageSize.getWidth()

  doc.setFillColor(...VIOLET_DARK)
  doc.rect(0, 0, w, 30, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
  doc.text(spec.boutique.nom, MARGIN, 13)

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  const contact = spec.boutique.telephone ? `Tel. ${spec.boutique.telephone}` : 'SamaCommerce'
  doc.text(contact, MARGIN, 20)

  // Nature du document, calée à droite.
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
  doc.text(spec.title, w - MARGIN, 13, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  const edite = `Édité le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  doc.text(edite, w - MARGIN, 20, { align: 'right' })

  let y = 40
  if (spec.subtitle) {
    doc.setTextColor(...MUTED); doc.setFontSize(10)
    doc.text(spec.subtitle, MARGIN, 37)
    y = 44
  }
  return y
}

/** Cartouches de synthèse : les 2 à 4 chiffres que l'on regarde en premier. */
function drawSummary(doc: jsPDF, items: PdfSummary[], y: number): number {
  const w = doc.internal.pageSize.getWidth()
  const avail = w - MARGIN * 2
  const gap = 4
  const cw = (avail - gap * (items.length - 1)) / items.length
  const ch = 20

  items.forEach((it, i) => {
    const x = MARGIN + i * (cw + gap)
    doc.setFillColor(...TINT)
    doc.roundedRect(x, y, cw, ch, 3, 3, 'F')
    doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    doc.text(it.label, x + 4, y + 7)
    doc.setTextColor(...(TONES[it.tone || 'brand'] || VIOLET)); doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
    doc.text(it.value, x + 4, y + 15)
  })

  return y + ch + 6
}

/** Pied de page paginé, ajouté une fois le document complet. */
function drawFooters(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  const total = doc.getNumberOfPages()

  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setDrawColor(...TINT); doc.setLineWidth(0.4)
    doc.line(MARGIN, h - 14, w - MARGIN, h - 14)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED)
    doc.text('Document généré par SamaCommerce', MARGIN, h - 9)
    doc.text(`Page ${i} / ${total}`, w - MARGIN, h - 9, { align: 'right' })
  }
}

/** Construit le document complet et déclenche le téléchargement. */
export async function exportPdf(filename: string, spec: PdfSpec) {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })

  let y = drawHeader(doc, spec)
  if (spec.summary?.length) y = drawSummary(doc, spec.summary, y)

  const rightAlign = new Set(spec.rightAlign ?? [])
  const columnStyles: Record<number, { halign: 'right' }> = {}
  rightAlign.forEach((i) => { columnStyles[i] = { halign: 'right' } })

  autoTable(doc, {
    startY: y,
    head: [spec.columns],
    body: spec.rows,
    foot: spec.foot ? [spec.foot] : undefined,
    margin: { left: MARGIN, right: MARGIN, bottom: 20 },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.6, textColor: INK, lineColor: TINT, lineWidth: 0.1 },
    headStyles: { fillColor: VIOLET, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
    footStyles: { fillColor: TINT, textColor: VIOLET_DARK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 249, 255] },
    columnStyles,
  })

  if (spec.note) {
    const after = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...MUTED)
    doc.text(spec.note, MARGIN, after + 8, { maxWidth: doc.internal.pageSize.getWidth() - MARGIN * 2 })
  }

  drawFooters(doc)
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}
