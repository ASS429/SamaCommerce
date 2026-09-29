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
const INDICATIF_PAR_DEFAUT = '221'

/**
 * Met un numéro au format attendu par wa.me (chiffres uniquement, indicatif inclus).
 * Renvoie `null` si le numéro est inexploitable — l'appelant doit alors demander
 * le numéro plutôt que d'ouvrir un lien mort.
 */
export function normaliserTelephone(brut?: string | null, indicatif = INDICATIF_PAR_DEFAUT): string | null {
  if (!brut) return null
  let chiffres = String(brut).replace(/[^\d+]/g, '')
  if (chiffres.startsWith('+')) chiffres = chiffres.slice(1)
  else if (chiffres.startsWith('00')) chiffres = chiffres.slice(2)
  else if (chiffres.startsWith('0')) chiffres = chiffres.slice(1) // 0 national → on le retire avant l'indicatif
  if (!chiffres) return null
  // Numéro local (9 chiffres au Sénégal : 7X XXX XX XX) → on ajoute l'indicatif.
  if (chiffres.length <= 9) chiffres = indicatif + chiffres
  return chiffres.length >= 8 && chiffres.length <= 15 ? chiffres : null
}

/** Lien wa.me prêt à ouvrir. Sans numéro valide : ouvre WhatsApp avec le seul texte. */
export function lienWhatsapp(telephone: string | null | undefined, message: string): string {
  const numero = normaliserTelephone(telephone)
  const texte = encodeURIComponent(message)
  return numero ? `https://wa.me/${numero}?text=${texte}` : `https://wa.me/?text=${texte}`
}

/** Ouvre WhatsApp dans un nouvel onglet. */
export function ouvrirWhatsapp(telephone: string | null | undefined, message: string) {
  window.open(lienWhatsapp(telephone, message), '_blank', 'noopener')
}

/** Lien d'appel téléphonique (bouton « Appeler »). */
export function lienAppel(telephone?: string | null): string | null {
  const numero = normaliserTelephone(telephone)
  return numero ? `tel:+${numero}` : null
}

/* ─────────────────────────── Gabarits de messages ─────────────────────────── */

export type Boutique = { nom: string; telephone?: string | null }

// Intl fr-FR sépare les milliers par une espace insécable étroite (U+202F) que
// certaines polices de WhatsApp rendent mal : on la remplace par une espace simple.
const montant = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)).replace(/[  ]/g, ' ') + ' F'
const dateFr = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d
  return Number.isNaN(x.getTime()) ? String(d) : x.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Signature commune : on rappelle QUI écrit et comment le rappeler. */
function signature(b: Boutique): string {
  return `\n🏪 *${b.nom}*` + (b.telephone ? `\n📞 ${b.telephone}` : '')
}

/** Reçu de vente envoyé au client juste après l'encaissement. */
export function messageRecu(b: Boutique, options: {
  lignes: { libelle: string; total: number }[]
  total: number
  paiement?: string | null
  client?: string | null
}): string {
  const PAIEMENT: Record<string, string> = {
    especes: '💵 Espèces', wave: '📲 Wave', orange: '📲 Orange Money', credit: '📝 Crédit (à payer plus tard)',
  }
  const lignes = options.lignes.map((l) => `• ${l.libelle} — ${montant(l.total)}`).join('\n')
  return [
    `🧾 *REÇU D'ACHAT*`,
    options.client ? `👤 ${options.client}` : null,
    `📅 ${dateFr(new Date())} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
    '',
    lignes,
    '',
    `💰 *TOTAL : ${montant(options.total)}*`,
    options.paiement ? PAIEMENT[options.paiement] || options.paiement : null,
    '',
    'Merci de votre confiance 🙏',
    signature(b),
  ].filter((l) => l !== null).join('\n')
}

/** Rappel amical d'une dette (crédit) arrivée à échéance. */
export function messageRappelCredit(b: Boutique, options: {
  client: string
  montant: number
  echeance?: string | null
  produit?: string | null
}): string {
  const retard = options.echeance ? new Date(options.echeance) < new Date(new Date().toDateString()) : false
  return [
    `${retard ? '⏰' : '🔔'} *RAPPEL${retard ? ' — échéance dépassée' : ''}*`,
    `👤 Bonjour ${options.client},`,
    '',
    options.produit ? `📦 Achat : ${options.produit}` : null,
    `💰 Reste à payer : *${montant(options.montant)}*`,
    options.echeance ? `📅 Échéance : ${dateFr(options.echeance)}` : null,
    '',
    retard ? 'Merci de passer régler dès que possible 🙏' : 'Merci de penser à régler avant la date 🙏',
    signature(b),
  ].filter((l) => l !== null).join('\n')
}

/** Bon de commande envoyé au fournisseur. */
export function messageCommande(b: Boutique, options: {
  fournisseur?: string | null
  reference?: string | number | null
  lignes: { libelle: string; quantite: number; unite?: string | null; total?: number }[]
  total?: number
  dateSouhaitee?: string | null
  notes?: string | null
}): string {
  const lignes = options.lignes
    .map((l) => `• ${l.libelle} × ${l.quantite}${l.unite ? ' ' + l.unite : ''}${l.total ? ` — ${montant(l.total)}` : ''}`)
    .join('\n')
  return [
    `📋 *BON DE COMMANDE*${options.reference ? ` n°${options.reference}` : ''}`,
    options.fournisseur ? `🚚 ${options.fournisseur}` : null,
    `📅 ${dateFr(new Date())}`,
    '',
    lignes || '(à préciser)',
    '',
    options.total ? `💰 *TOTAL estimé : ${montant(options.total)}*` : null,
    options.dateSouhaitee ? `🗓️ Livraison souhaitée : ${dateFr(options.dateSouhaitee)}` : null,
    options.notes ? `📝 ${options.notes}` : null,
    '',
    'Merci de confirmer disponibilité et prix 🙏',
    signature(b),
  ].filter((l) => l !== null).join('\n')
}

/** Invitation d'un employé à rejoindre la boutique. */
export function messageInvitation(b: Boutique, options: { lien: string; role: string }): string {
  return [
    `🤝 *INVITATION — ${b.nom}*`,
    '',
    `Tu es invité(e) à rejoindre la boutique sur SamaCommerce`,
    `👔 Rôle : ${options.role === 'gerant' ? 'Gérant' : 'Employé'}`,
    '',
    '1️⃣ Ouvre ce lien :',
    options.lien,
    '2️⃣ Choisis un mot de passe',
    '3️⃣ Tu entres dans la boutique ✅',
    '',
    '⏳ Le lien est valable 3 jours.',
    signature(b),
  ].join('\n')
}

/** Confirmation d'une livraison au client / suivi au fournisseur. */
export function messageLivraison(b: Boutique, options: { reference?: string | number | null; statut: string; note?: string | null }): string {
  const STATUT: Record<string, string> = {
    en_attente: '⏳ En attente de départ', en_cours: '🛵 En route', livree: '✅ Livrée',
  }
  return [
    `🛵 *SUIVI DE LIVRAISON*${options.reference ? ` n°${options.reference}` : ''}`,
    `📍 État : ${STATUT[options.statut] || options.statut}`,
    options.note ? `📝 ${options.note}` : null,
    signature(b),
  ].filter((l) => l !== null).join('\n')
}
