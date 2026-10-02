import { describe, expect, it } from 'vitest'
import { dateCourte, deMois, depuis, echeanceCourte, messageErreur, montantCourt, moisCourt, pastilleStatut, pluriel, texteEcart, vu } from './outilsAdmin'

const MAINTENANT = new Date(2026, 9, 18, 15, 0).getTime() // 18 octobre 2026, 15 h

describe('dates du panneau', () => {
  it('écrit une date courte sans décalage de fuseau', () => {
    expect(dateCourte('2026-10-28')).toBe('28 oct.')
    expect(dateCourte('2026-11-01')).toBe('1er nov.')
    expect(dateCourte(null)).toBe('')
  })

  it('dit depuis quand, en mots', () => {
    const avant = (minutes: number) => new Date(MAINTENANT - minutes * 60_000).toISOString()
    expect(depuis(avant(0), MAINTENANT)).toBe('à l’instant')
    expect(depuis(avant(12), MAINTENANT)).toBe('il y a 12 min')
    expect(depuis(avant(17 * 60), MAINTENANT)).toBe('il y a 17 h')
    expect(depuis(avant(30 * 60), MAINTENANT)).toBe('hier')
    expect(depuis(avant(4 * 1440), MAINTENANT)).toBe('il y a 4 jours')
    expect(depuis(null, MAINTENANT)).toBe('')
  })

  it('compte la dernière activité en jours de calendrier', () => {
    const maintenant = new Date(MAINTENANT)
    expect(vu(new Date(2026, 9, 18, 8, 0).toISOString(), maintenant)).toBe('Vu aujourd’hui')
    expect(vu(new Date(2026, 9, 17, 23, 30).toISOString(), maintenant)).toBe('Vu hier')
    expect(vu(new Date(2026, 8, 30, 12, 0).toISOString(), maintenant)).toBe('Vu il y a 18 j')
    expect(vu(null, maintenant)).toBe('Jamais connecté')
  })

  it('accorde les mois et les nombres', () => {
    expect(deMois('2026-10')).toBe('d’octobre')
    expect(deMois('2026-08')).toBe('d’août')
    expect(deMois('2026-03')).toBe('de mars')
    expect(moisCourt('2026-07')).toBe('Juil.')
    expect(pluriel(0, 'abonné', 'abonnés')).toBe('0 abonné')
    expect(pluriel(1, 'abonné', 'abonnés')).toBe('1 abonné')
    expect(pluriel(14, 'abonné', 'abonnés')).toBe('14 abonnés')
  })
})

describe('montants', () => {
  it('raccourcit les montants des barres', () => {
    expect(montantCourt(12500)).toBe('12,5 k')
    expect(montantCourt(45000)).toBe('45 k')
    expect(montantCourt(500)).toBe('500 F')
  })

  it('dit l’écart entre déclaré et attendu', () => {
    expect(texteEcart(-500)).toMatch(/^Il manque 500 F$/)
    expect(texteEcart(1000)).toMatch(/^1\s000 F de trop$/)
  })
})

describe('statut d’un commerçant', () => {
  it('donne un mot et le délai quand il compte', () => {
    expect(pastilleStatut({ statut: 'essai', jours_restants: 30 })).toEqual({ ton: 'info', texte: 'Essai · 30 j' })
    expect(pastilleStatut({ statut: 'bientot', jours_restants: 3 })).toEqual({ ton: 'attention', texte: 'Expire dans 3 j' })
    expect(pastilleStatut({ statut: 'bientot', jours_restants: 1 }).texte).toBe('Expire demain')
    expect(pastilleStatut({ statut: 'bientot', jours_restants: 0 }).texte).toBe('Expire aujourd’hui')
    expect(pastilleStatut({ statut: 'expire', jours_restants: 2 })).toEqual({ ton: 'danger', texte: 'Expiré · grâce 2 j' })
    expect(pastilleStatut({ statut: 'attente', jours_restants: null })).toEqual({ ton: 'violet', texte: 'Paiement à vérifier' })
    expect(pastilleStatut({ statut: 'gratuit', jours_restants: null })).toEqual({ ton: 'neutre', texte: 'Gratuit' })
    expect(pastilleStatut({ statut: 'bloque', jours_restants: null })).toEqual({ ton: 'neutre', texte: 'Bloqué' })
  })

  it('montre la date qui compte selon la situation', () => {
    expect(echeanceCourte({ source: 'essai', echeance: '2026-10-24' })).toBe('Fin le 24 oct.')
    expect(echeanceCourte({ source: 'paye', echeance: '2026-10-28' })).toBe('Le 28 oct.')
    expect(echeanceCourte({ source: 'grace', echeance: '2026-10-22' })).toBe('Grâce jusqu’au 22 oct.')
    expect(echeanceCourte({ source: 'gratuit', echeance: null })).toBe('Sans échéance')
  })
})

describe('messages d’erreur', () => {
  it('préfère le premier message de validation, puis l’erreur métier', () => {
    expect(messageErreur({ response: { data: { errors: { numero_wave: ['Numéro Wave invalide.'] } } } })).toBe('Numéro Wave invalide.')
    expect(messageErreur({ response: { data: { erreur: 'Le compte Wave n’a que 5 000 F.' } } })).toBe('Le compte Wave n’a que 5 000 F.')
    expect(messageErreur(new Error('réseau'))).toMatch(/serveur ne répond pas/)
  })
})
