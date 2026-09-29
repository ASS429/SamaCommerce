import { describe, it, expect } from 'vitest'
import {
  normaliserTelephone, lienWhatsapp, lienAppel,
  messageRecu, messageRappelCredit, messageCommande, messageInvitation,
} from './whatsapp'

const BOUTIQUE = { nom: 'Boutique Ndiaye', telephone: '77 111 22 33' }

describe('normaliserTelephone', () => {
  it('préfixe l\'indicatif sénégalais sur un numéro local', () => {
    expect(normaliserTelephone('77 123 45 67')).toBe('221771234567')
    expect(normaliserTelephone('771234567')).toBe('221771234567')
    expect(normaliserTelephone('77-123-45-67')).toBe('221771234567')
  })

  it('accepte les formats internationaux déjà complets', () => {
    expect(normaliserTelephone('+221 77 123 45 67')).toBe('221771234567')
    expect(normaliserTelephone('00221771234567')).toBe('221771234567')
    expect(normaliserTelephone('221771234567')).toBe('221771234567')
  })

  it('retire le zéro national avant d\'ajouter l\'indicatif', () => {
    expect(normaliserTelephone('077 123 4567')).toBe('221771234567')
  })

  it('gère un autre indicatif que le Sénégal', () => {
    expect(normaliserTelephone('612345678', '33')).toBe('33612345678')
  })

  it('renvoie null quand le numéro est inexploitable', () => {
    expect(normaliserTelephone('')).toBeNull()
    expect(normaliserTelephone(null)).toBeNull()
    expect(normaliserTelephone('abc')).toBeNull()
    expect(normaliserTelephone('12')).toBeNull()          // trop court même préfixé
    expect(normaliserTelephone('1234567890123456789')).toBeNull() // trop long
  })
})

describe('lienWhatsapp', () => {
  it('construit un lien wa.me avec numéro normalisé et texte encodé', () => {
    const lien = lienWhatsapp('77 123 45 67', 'Bonjour & merci')
    expect(lien.startsWith('https://wa.me/221771234567?text=')).toBe(true)
    expect(lien).toContain('Bonjour%20%26%20merci')
  })

  it('ouvre WhatsApp sans destinataire quand le numéro est absent', () => {
    expect(lienWhatsapp(null, 'Salut')).toBe('https://wa.me/?text=Salut')
  })
})

describe('lienAppel', () => {
  it('produit un lien tel: international', () => {
    expect(lienAppel('77 123 45 67')).toBe('tel:+221771234567')
  })
  it('renvoie null sans numéro valide', () => {
    expect(lienAppel('')).toBeNull()
  })
})

describe('gabarits de messages', () => {
  it('le reçu contient les lignes, le total et la signature de la boutique', () => {
    const message = messageRecu(BOUTIQUE, {
      lignes: [{ libelle: 'Riz 5 kg', total: 3000 }, { libelle: 'Huile 1 L', total: 1200 }],
      total: 4200,
      paiement: 'wave',
    })
    expect(message).toContain('REÇU')
    expect(message).toContain('Riz 5 kg')
    expect(message).toContain('4 200 F')
    expect(message).toContain('Wave')
    expect(message).toContain('Boutique Ndiaye')
    expect(message).toContain('77 111 22 33')
  })

  it('le rappel de crédit signale le retard quand l\'échéance est dépassée', () => {
    const enRetard = messageRappelCredit(BOUTIQUE, { client: 'Awa', montant: 5000, echeance: '2020-01-01' })
    expect(enRetard).toContain('échéance dépassée')
    expect(enRetard).toContain('⏰')

    const futur = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const aVenir = messageRappelCredit(BOUTIQUE, { client: 'Awa', montant: 5000, echeance: futur })
    expect(aVenir).not.toContain('échéance dépassée')
  })

  it('le bon de commande liste les quantités et le total', () => {
    const message = messageCommande(BOUTIQUE, {
      fournisseur: 'Grossiste Sandaga',
      reference: 12,
      lignes: [{ libelle: 'Riz', quantite: 10, unite: 'sacs', total: 250000 }],
      total: 250000,
    })
    expect(message).toContain('BON DE COMMANDE')
    expect(message).toContain('n°12')
    expect(message).toContain('Riz × 10 sacs')
    expect(message).toContain('250 000 F')
  })

  it('l\'invitation contient le lien et le rôle', () => {
    const message = messageInvitation(BOUTIQUE, { lien: 'https://exemple.sn/?invitation=abc', role: 'gerant' })
    expect(message).toContain('https://exemple.sn/?invitation=abc')
    expect(message).toContain('Gérant')
  })

  it('n\'affiche pas de ligne vide quand la boutique n\'a pas de téléphone', () => {
    const message = messageRecu({ nom: 'Chez Moussa' }, { lignes: [{ libelle: 'Pain', total: 200 }], total: 200 })
    expect(message).toContain('Chez Moussa')
    expect(message).not.toContain('📞')
  })
})
