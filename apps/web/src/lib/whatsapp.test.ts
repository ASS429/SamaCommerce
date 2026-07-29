import { describe, it, expect } from 'vitest'
import {
  normalizePhone, waLink, telLink,
  receiptMessage, creditReminderMessage, orderMessage, inviteMessage,
} from './whatsapp'

const BOUTIQUE = { nom: 'Boutique Ndiaye', telephone: '77 111 22 33' }

describe('normalizePhone', () => {
  it('préfixe l\'indicatif sénégalais sur un numéro local', () => {
    expect(normalizePhone('77 123 45 67')).toBe('221771234567')
    expect(normalizePhone('771234567')).toBe('221771234567')
    expect(normalizePhone('77-123-45-67')).toBe('221771234567')
  })

  it('accepte les formats internationaux déjà complets', () => {
    expect(normalizePhone('+221 77 123 45 67')).toBe('221771234567')
    expect(normalizePhone('00221771234567')).toBe('221771234567')
    expect(normalizePhone('221771234567')).toBe('221771234567')
  })

  it('retire le zéro national avant d\'ajouter l\'indicatif', () => {
    expect(normalizePhone('077 123 4567')).toBe('221771234567')
  })

  it('gère un autre indicatif que le Sénégal', () => {
    expect(normalizePhone('612345678', '33')).toBe('33612345678')
  })

  it('renvoie null quand le numéro est inexploitable', () => {
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone('abc')).toBeNull()
    expect(normalizePhone('12')).toBeNull()          // trop court même préfixé
    expect(normalizePhone('1234567890123456789')).toBeNull() // trop long
  })
})

describe('waLink', () => {
  it('construit un lien wa.me avec numéro normalisé et texte encodé', () => {
    const url = waLink('77 123 45 67', 'Bonjour & merci')
    expect(url.startsWith('https://wa.me/221771234567?text=')).toBe(true)
    expect(url).toContain('Bonjour%20%26%20merci')
  })

  it('ouvre WhatsApp sans destinataire quand le numéro est absent', () => {
    expect(waLink(null, 'Salut')).toBe('https://wa.me/?text=Salut')
  })
})

describe('telLink', () => {
  it('produit un lien tel: international', () => {
    expect(telLink('77 123 45 67')).toBe('tel:+221771234567')
  })
  it('renvoie null sans numéro valide', () => {
    expect(telLink('')).toBeNull()
  })
})

describe('gabarits de messages', () => {
  it('le reçu contient les lignes, le total et la signature de la boutique', () => {
    const msg = receiptMessage(BOUTIQUE, {
      lignes: [{ label: 'Riz 5 kg', total: 3000 }, { label: 'Huile 1 L', total: 1200 }],
      total: 4200,
      paiement: 'wave',
    })
    expect(msg).toContain('REÇU')
    expect(msg).toContain('Riz 5 kg')
    expect(msg).toContain('4 200 F')
    expect(msg).toContain('Wave')
    expect(msg).toContain('Boutique Ndiaye')
    expect(msg).toContain('77 111 22 33')
  })

  it('le rappel de crédit signale le retard quand l\'échéance est dépassée', () => {
    const enRetard = creditReminderMessage(BOUTIQUE, { client: 'Awa', montant: 5000, echeance: '2020-01-01' })
    expect(enRetard).toContain('échéance dépassée')
    expect(enRetard).toContain('⏰')

    const futur = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const aVenir = creditReminderMessage(BOUTIQUE, { client: 'Awa', montant: 5000, echeance: futur })
    expect(aVenir).not.toContain('échéance dépassée')
  })

  it('le bon de commande liste les quantités et le total', () => {
    const msg = orderMessage(BOUTIQUE, {
      fournisseur: 'Grossiste Sandaga',
      reference: 12,
      lignes: [{ label: 'Riz', quantite: 10, unite: 'sacs', total: 250000 }],
      total: 250000,
    })
    expect(msg).toContain('BON DE COMMANDE')
    expect(msg).toContain('n°12')
    expect(msg).toContain('Riz × 10 sacs')
    expect(msg).toContain('250 000 F')
  })

  it('l\'invitation contient le lien et le rôle', () => {
    const msg = inviteMessage(BOUTIQUE, { lien: 'https://exemple.sn/?invite=abc', role: 'gerant' })
    expect(msg).toContain('https://exemple.sn/?invite=abc')
    expect(msg).toContain('Gérant')
  })

  it('n\'affiche pas de ligne vide quand la boutique n\'a pas de téléphone', () => {
    const msg = receiptMessage({ nom: 'Chez Moussa' }, { lignes: [{ label: 'Pain', total: 200 }], total: 200 })
    expect(msg).toContain('Chez Moussa')
    expect(msg).not.toContain('📞')
  })
})
