/* WhatsApp — le canal de communication réel des commerçants sénégalais.
 *
 * Deux problèmes réglés ici :
 *
 * 1. LE NUMÉRO. wa.me exige un numéro INTERNATIONAL sans « + » ni espaces.
 *    Or on saisit « 77 123 45 67 », « 77-123-45-67 » ou « +221 77 123 45 67 ».
 *    Sans normalisation, WhatsApp ouvre une page « numéro invalide » et le
 *    commerçant croit que l'application est cassée. On préfixe donc l'indicatif
 *    du Sénégal (221) sur les numéros locaux à 9 chiffres (7X XXX XX XX).
 *
 * 2. LE MESSAGE. Un pavé de texte est illisible pour un client peu alphabétisé.
 *    Les gabarits ci-dessous sont donc courts, aérés, et chaque ligne commence
 *    par un pictogramme qui porte le sens (🧾 reçu, 💰 total, ⏰ échéance…).
 */

/** Indicatif par défaut (Sénégal). */
const DEFAULT_CC = '221'

/**
 * Met un numéro au format attendu par wa.me (chiffres uniquement, indicatif inclus).
 * Renvoie `null` si le numéro est inexploitable — l'appelant doit alors demander
 * le numéro plutôt que d'ouvrir un lien mort.
 */
export function normalizePhone(raw?: string | null, countryCode = DEFAULT_CC): string | null {
  if (!raw) return null
  let d = String(raw).replace(/[^\d+]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  else if (d.startsWith('00')) d = d.slice(2)
  else if (d.startsWith('0')) d = d.slice(1) // 0 national → on le retire avant l'indicatif
  if (!d) return null
  // Numéro local (9 chiffres au Sénégal : 7X XXX XX XX) → on ajoute l'indicatif.
  if (d.length <= 9) d = countryCode + d
  return d.length >= 8 && d.length <= 15 ? d : null
}

/** Lien wa.me prêt à ouvrir. Sans numéro valide : ouvre WhatsApp avec le seul texte. */
export function waLink(phone: string | null | undefined, message: string): string {
  const n = normalizePhone(phone)
  const text = encodeURIComponent(message)
  return n ? `https://wa.me/${n}?text=${text}` : `https://wa.me/?text=${text}`
}

/** Ouvre WhatsApp dans un nouvel onglet. */
export function openWhatsapp(phone: string | null | undefined, message: string) {
  window.open(waLink(phone, message), '_blank', 'noopener')
}

/** Lien d'appel téléphonique (bouton « Appeler »). */
export function telLink(phone?: string | null): string | null {
  const n = normalizePhone(phone)
  return n ? `tel:+${n}` : null
}

/* ─────────────────────────── Gabarits de messages ─────────────────────────── */

export type Boutique = { nom: string; telephone?: string | null }

// Intl fr-FR separe les milliers par une espace insecable etroite (U+202F) que
// certaines polices WhatsApp rendent mal : on la remplace par une espace simple.
const money = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)).replace(/[\u202f\u00a0]/g, ' ') + ' F'
const dateFr = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d
  return Number.isNaN(x.getTime()) ? String(d) : x.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Signature commune : on rappelle QUI écrit et comment le rappeler. */
function signature(b: Boutique): string {
  return `\n🏪 *${b.nom}*` + (b.telephone ? `\n📞 ${b.telephone}` : '')
}

/** Reçu de vente envoyé au client juste après l'encaissement. */
export function receiptMessage(b: Boutique, opts: {
  lignes: { label: string; total: number }[]
  total: number
  paiement?: string | null
  client?: string | null
}): string {
  const PAIEMENT: Record<string, string> = {
    especes: '💵 Espèces', wave: '📲 Wave', orange: '📲 Orange Money', credit: '📝 Crédit (à payer plus tard)',
  }
  const lignes = opts.lignes.map((l) => `• ${l.label} — ${money(l.total)}`).join('\n')
  return [
    `🧾 *REÇU D'ACHAT*`,
    opts.client ? `👤 ${opts.client}` : null,
    `📅 ${dateFr(new Date())} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
    '',
    lignes,
    '',
    `💰 *TOTAL : ${money(opts.total)}*`,
    opts.paiement ? PAIEMENT[opts.paiement] || opts.paiement : null,
    '',
    'Merci de votre confiance 🙏',
    signature(b),
  ].filter((l) => l !== null).join('\n')
}

/** Rappel amical d'une dette (crédit) arrivée à échéance. */
export function creditReminderMessage(b: Boutique, opts: {
  client: string
  montant: number
  echeance?: string | null
  produit?: string | null
}): string {
  const retard = opts.echeance ? new Date(opts.echeance) < new Date(new Date().toDateString()) : false
  return [
    `${retard ? '⏰' : '🔔'} *RAPPEL${retard ? ' — échéance dépassée' : ''}*`,
    `👤 Bonjour ${opts.client},`,
    '',
    opts.produit ? `📦 Achat : ${opts.produit}` : null,
    `💰 Reste à payer : *${money(opts.montant)}*`,
    opts.echeance ? `📅 Échéance : ${dateFr(opts.echeance)}` : null,
    '',
    retard ? 'Merci de passer régler dès que possible 🙏' : 'Merci de penser à régler avant la date 🙏',
    signature(b),
  ].filter((l) => l !== null).join('\n')
}

/** Bon de commande envoyé au fournisseur. */
export function orderMessage(b: Boutique, opts: {
  fournisseur?: string | null
  reference?: string | number | null
  lignes: { label: string; quantite: number; unite?: string | null; total?: number }[]
  total?: number
  dateSouhaitee?: string | null
  notes?: string | null
}): string {
  const lignes = opts.lignes
    .map((l) => `• ${l.label} × ${l.quantite}${l.unite ? ' ' + l.unite : ''}${l.total ? ` — ${money(l.total)}` : ''}`)
    .join('\n')
  return [
    `📋 *BON DE COMMANDE*${opts.reference ? ` n°${opts.reference}` : ''}`,
    opts.fournisseur ? `🚚 ${opts.fournisseur}` : null,
    `📅 ${dateFr(new Date())}`,
    '',
    lignes || '(à préciser)',
    '',
    opts.total ? `💰 *TOTAL estimé : ${money(opts.total)}*` : null,
    opts.dateSouhaitee ? `🗓️ Livraison souhaitée : ${dateFr(opts.dateSouhaitee)}` : null,
    opts.notes ? `📝 ${opts.notes}` : null,
    '',
    'Merci de confirmer disponibilité et prix 🙏',
    signature(b),
  ].filter((l) => l !== null).join('\n')
}

/** Invitation d'un employé à rejoindre la boutique. */
export function inviteMessage(b: Boutique, opts: { lien: string; role: string }): string {
  return [
    `🤝 *INVITATION — ${b.nom}*`,
    '',
    `Tu es invité(e) à rejoindre la boutique sur SamaCommerce`,
    `👔 Rôle : ${opts.role === 'gerant' ? 'Gérant' : 'Employé'}`,
    '',
    '1️⃣ Ouvre ce lien :',
    opts.lien,
    '2️⃣ Crée ton compte',
    '3️⃣ C\'est prêt ✅',
    signature(b),
  ].join('\n')
}

/** Confirmation d'une livraison au client / suivi au fournisseur. */
export function deliveryMessage(b: Boutique, opts: { reference?: string | number | null; statut: string; note?: string | null }): string {
  const STATUT: Record<string, string> = {
    en_attente: '⏳ En attente de départ', en_cours: '🛵 En route', livree: '✅ Livrée',
  }
  return [
    `🛵 *SUIVI DE LIVRAISON*${opts.reference ? ` n°${opts.reference}` : ''}`,
    `📍 État : ${STATUT[opts.statut] || opts.statut}`,
    opts.note ? `📝 ${opts.note}` : null,
    signature(b),
  ].filter((l) => l !== null).join('\n')
}
