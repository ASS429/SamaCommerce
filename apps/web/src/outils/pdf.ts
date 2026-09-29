/* Documents PDF de la boutique (chiffres, caisse, crédits, inventaire…).
 *
 * Avant : `doc.text('SamaCommerce — Caisse')` puis un tableau brut, sans
 * accents (« especes », « Rembourse »), sans nom de boutique, sans date, sans
 * pagination. Ce document circule pourtant : on le montre au comptable, à la
 * banque, au fournisseur, parfois à un bailleur pour un microcrédit.
 *
 * Ici : bandeau d'en-tête aux couleurs de la boutique, cartouches de synthèse,
 * tableau zébré, ligne de totaux, pied de page paginé. Tout est SYNCHRONE
 * (aucune image à charger) pour que l'export marche aussi hors ligne.
 */

/* jsPDF + autoTable pèsent ~180 Ko : ils sont chargés À LA DEMANDE, au clic sur
 * « PDF ». Sinon la section Stock (non différée) les embarquerait dans le
 * paquet principal — inacceptable sur une connexion 3G de marché. Les imports
 * ci-dessous sont donc de TYPE uniquement (effacés à la compilation). */
import type jsPDF from 'jspdf'
import type { RowInput } from 'jspdf-autotable'

/** Palette de la charte, en RVB (jsPDF ne prend pas l'hexadécimal partout). */
const VIOLET: [number, number, number] = [124, 58, 237]
const VIOLET_FONCE: [number, number, number] = [91, 33, 182]
const ENCRE: [number, number, number] = [30, 27, 75]
const ATTENUE: [number, number, number] = [107, 114, 128]
const TEINTE_FOND: [number, number, number] = [237, 233, 254]

const MARGE = 14

/** Montant sans espace insécable : jsPDF ne sait pas rendre U+202F. */
export const montant = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0)).replace(/[  ]/g, ' ') + ' F'

export type CartouchePdf = { libelle: string; valeur: string; teinte?: 'marque' | 'vert' | 'rouge' | 'orange' }

export type DocumentPdf = {
  /** Titre du document (« Chiffres », « Caisse du jour »…). */
  titre: string
  /** Sous-titre : période couverte, filtre appliqué… */
  sousTitre?: string
  boutique: { nom: string; telephone?: string | null }
  /** Cartouches de synthèse affichés sous l'en-tête. */
  synthese?: CartouchePdf[]
  colonnes: string[]
  lignes: RowInput[]
  /** Ligne de totaux (mise en avant en pied de tableau). */
  pied?: RowInput
  /** Colonnes à aligner à droite (indices) — typiquement les montants. */
  alignesADroite?: number[]
  /** Note libre imprimée sous le tableau. */
  note?: string
}

const TEINTES: Record<string, [number, number, number]> = {
  marque: VIOLET, vert: [16, 185, 129], rouge: [239, 68, 68], orange: [245, 158, 11],
}

/** Bandeau violet : identité de la boutique + nature du document. */
function dessinerEntete(doc: jsPDF, contenu: DocumentPdf) {
  const l = doc.internal.pageSize.getWidth()

  doc.setFillColor(...VIOLET_FONCE)
  doc.rect(0, 0, l, 30, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
  doc.text(contenu.boutique.nom, MARGE, 13)

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  const contact = contenu.boutique.telephone ? `Tel. ${contenu.boutique.telephone}` : 'SamaCommerce'
  doc.text(contact, MARGE, 20)

  // Nature du document, calée à droite.
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
  doc.text(contenu.titre, l - MARGE, 13, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  const edite = `Édité le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  doc.text(edite, l - MARGE, 20, { align: 'right' })

  let y = 40
  if (contenu.sousTitre) {
    doc.setTextColor(...ATTENUE); doc.setFontSize(10)
    doc.text(contenu.sousTitre, MARGE, 37)
    y = 44
  }
  return y
}

/** Cartouches de synthèse : les 2 à 4 chiffres que l'on regarde en premier. */
function dessinerSynthese(doc: jsPDF, cartouches: CartouchePdf[], y: number): number {
  const l = doc.internal.pageSize.getWidth()
  const disponible = l - MARGE * 2
  const ecart = 4
  const largeur = (disponible - ecart * (cartouches.length - 1)) / cartouches.length
  const hauteur = 20

  cartouches.forEach((c, i) => {
    const x = MARGE + i * (largeur + ecart)
    doc.setFillColor(...TEINTE_FOND)
    doc.roundedRect(x, y, largeur, hauteur, 3, 3, 'F')
    doc.setTextColor(...ATTENUE); doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    doc.text(c.libelle, x + 4, y + 7)
    doc.setTextColor(...(TEINTES[c.teinte || 'marque'] || VIOLET)); doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
    doc.text(c.valeur, x + 4, y + 15)
  })

  return y + hauteur + 6
}

/** Pied de page paginé, ajouté une fois le document complet. */
function dessinerPieds(doc: jsPDF) {
  const l = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  const total = doc.getNumberOfPages()

  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setDrawColor(...TEINTE_FOND); doc.setLineWidth(0.4)
    doc.line(MARGE, h - 14, l - MARGE, h - 14)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...ATTENUE)
    doc.text('Document généré par SamaCommerce', MARGE, h - 9)
    doc.text(`Page ${i} / ${total}`, l - MARGE, h - 9, { align: 'right' })
  }
}

/** Construit le document complet et déclenche le téléchargement. */
export async function exporterPdf(nomFichier: string, contenu: DocumentPdf) {
  const [{ default: JsPDF }, { default: tableauAuto }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })

  let y = dessinerEntete(doc, contenu)
  if (contenu.synthese?.length) y = dessinerSynthese(doc, contenu.synthese, y)

  const alignesADroite = new Set(contenu.alignesADroite ?? [])
  const stylesColonnes: Record<number, { halign: 'right' }> = {}
  alignesADroite.forEach((i) => { stylesColonnes[i] = { halign: 'right' } })

  tableauAuto(doc, {
    startY: y,
    head: [contenu.colonnes],
    body: contenu.lignes,
    foot: contenu.pied ? [contenu.pied] : undefined,
    margin: { left: MARGE, right: MARGE, bottom: 20 },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.6, textColor: ENCRE, lineColor: TEINTE_FOND, lineWidth: 0.1 },
    headStyles: { fillColor: VIOLET, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
    footStyles: { fillColor: TEINTE_FOND, textColor: VIOLET_FONCE, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 249, 255] },
    columnStyles: stylesColonnes,
  })

  if (contenu.note) {
    const apres = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...ATTENUE)
    doc.text(contenu.note, MARGE, apres + 8, { maxWidth: doc.internal.pageSize.getWidth() - MARGE * 2 })
  }

  dessinerPieds(doc)
  doc.save(nomFichier.endsWith('.pdf') ? nomFichier : `${nomFichier}.pdf`)
}
