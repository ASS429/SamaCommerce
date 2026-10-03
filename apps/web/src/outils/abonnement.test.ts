import { describe, expect, it } from 'vitest'
import { atoutsDuPlan, dateLongue, delai, equivalentMensuel, presDeLaLimite, prixPeriode, quand, texteEtat, texteUtilisation } from './abonnement'
import type { EtatAbonnement, LimitesPlan, PlanPublic } from './api'

const plan = (code: PlanPublic['code'], nom: string, prix: number, annuel: number | null, limites: LimitesPlan, fonctionnalites: string[] = [], devis = false): PlanPublic => ({
  code, nom, accroche: null, prix_mensuel: prix, prix_annuel: annuel, sur_devis: devis, prix_a_partir_de: devis ? 15000 : null,
  limites, fonctionnalites, ordre: 1,
})
// Le catalogue livré par les migrations du 02/10/2026 (abonnements, puis assistant vocal).
const ESSENTIEL = ['rapports_complets', 'exports', 'relances_whatsapp', 'fournisseurs_commandes', 'inventaire_retours', 'assistant_vocal']
const PRO = [...ESSENTIEL, 'livraisons', 'journal_activite', 'tableau_boutiques']
const PLANS = [
  plan('gratuit', 'Gratuit', 0, 0, { boutiques: 1, employes: 0, produits: 100, ia: 5 }),
  plan('essentiel', 'Essentiel', 2500, 25000, { boutiques: 1, employes: 2, produits: null, ia: 30 }, ESSENTIEL),
  plan('pro', 'Pro', 5000, 50000, { boutiques: 3, employes: null, produits: null, ia: null }, PRO),
  plan('entreprise', 'Entreprise', 0, null, { boutiques: null, employes: null, produits: null, ia: null }, [...PRO, 'accompagnement'], true),
]

const etat = (champs: Partial<EtatAbonnement>): EtatAbonnement => ({
  plan: PLANS[2], source: 'gratuit', plan_paye: null, fin_le: null, grace_jusqu_au: null, essai_jusqu_au: null,
  plan_essai: null, plan_expire: null, expire_le: null, jours_restants: null,
  limites: PLANS[2].limites, fonctionnalites: [], ...champs,
})

describe('dates et délais', () => {
  it('écrit la date en toutes lettres, sans décalage de fuseau', () => {
    expect(dateLongue('2026-11-01')).toBe('1er novembre 2026')
    expect(dateLongue('2026-12-19T00:00:00.000000Z')).toBe('19 décembre 2026')
    expect(dateLongue('2026-10-24', false)).toBe('24 octobre')
    expect(dateLongue(null)).toBe('')
  })

  it("dit « aujourd'hui » et « demain » plutôt que « dans 0 jour »", () => {
    expect(delai(0)).toBe("aujourd'hui")
    expect(delai(1)).toBe('demain')
    expect(delai(4)).toBe('dans 4 jours')
  })
})

describe('prix', () => {
  it("donne le prix de la période, rien pour un plan sur devis", () => {
    expect(prixPeriode(PLANS[1], 'mois')).toBe(2500)
    expect(prixPeriode(PLANS[1], 'an')).toBe(25000)
    expect(prixPeriode(PLANS[3], 'mois')).toBeNull()
  })

  it("ramène l'année au mois, arrondi", () => {
    expect(equivalentMensuel(PLANS[1])).toBe(2083)
    expect(equivalentMensuel(PLANS[2])).toBe(4167)
    expect(equivalentMensuel(PLANS[3])).toBeNull()
  })
})

describe("bandeau d'état", () => {
  it("annonce la fin de l'essai et rassure sur les données", () => {
    const t = texteEtat(etat({ source: 'essai', essai_jusqu_au: '2026-10-24', jours_restants: 4 }), PLANS)
    expect(t.ton).toBe('essai')
    expect(t.titre).toBe('Votre essai Pro se termine dans 4 jours')
    expect(t.detail).toContain('restent à vous')
    expect(texteEtat(etat({ source: 'essai', jours_restants: 0 }), PLANS).titre).toBe("Votre essai Pro se termine aujourd'hui")
  })

  it("donne l'échéance d'un plan payé", () => {
    expect(texteEtat(etat({ source: 'paye', fin_le: '2026-11-24' }), PLANS).titre).toBe("Plan Pro jusqu'au 24 novembre 2026")
  })

  it('pendant le délai de grâce, dit jusqu’à quand tout fonctionne', () => {
    const t = texteEtat(etat({ source: 'grace', fin_le: '2026-10-15', grace_jusqu_au: '2026-10-22' }), PLANS)
    expect(t.titre).toBe('Votre plan Pro a expiré le 15 octobre 2026')
    expect(t.detail).toContain("jusqu'au 22 octobre 2026")
  })

  it('au plan Gratuit, rappelle le plan expiré s’il y en avait un', () => {
    const t = texteEtat(etat({ plan: PLANS[0], source: 'gratuit', plan_expire: 'pro', expire_le: '2026-10-15' }), PLANS)
    expect(t.titre).toBe('Vous êtes au plan Gratuit')
    expect(t.detail).toBe('Votre plan Pro a pris fin le 15 octobre 2026. Vos données sont toutes là.')
  })
})

describe('ce que chaque plan apporte', () => {
  it('décrit Essentiel par ce qu’il ajoute au Gratuit', () => {
    expect(atoutsDuPlan(PLANS[1], PLANS[0])).toEqual([
      'Produits illimités', '2 employés en plus de vous', '30 conseils de l’IA par mois',
      'Rapports complets, exports PDF et Excel', 'Fournisseurs, commandes et inventaire', 'Relances de crédit par WhatsApp',
      'Assistant vocal : vos questions en wolof ou en français',
    ])
  })

  it('décrit Pro à partir du plan Essentiel', () => {
    expect(atoutsDuPlan(PLANS[2], PLANS[1])).toEqual([
      'Tout le plan Essentiel', 'Employés illimités, chacun avec ses droits', 'Jusqu’à 3 boutiques, suivies ensemble',
      'Conseils de l’IA sans limite : quoi racheter, à qui faire crédit', 'Livraisons et journal d’activité',
    ])
  })

  it("suit les réglages de l'administrateur au lieu d'un texte figé", () => {
    const essentielElargi = { ...PLANS[1], limites: { ...PLANS[1].limites, employes: 3 } }
    expect(atoutsDuPlan(essentielElargi, PLANS[0])).toContain('3 employés en plus de vous')
  })

  it('décrit le Gratuit seul', () => {
    expect(atoutsDuPlan(PLANS[0])).toEqual(['Jusqu’à 100 produits', 'Vous seul, sans employé', 'Une boutique', '5 conseils de l’IA par mois'])
  })
})

describe('quand', () => {
  const maintenant = new Date(2026, 9, 20, 11, 42)
  it('situe une déclaration dans le temps', () => {
    expect(quand(new Date(2026, 9, 20, 9, 42).toISOString(), maintenant)).toBe("Aujourd'hui à 09:42")
    expect(quand(new Date(2026, 9, 19, 18, 5).toISOString(), maintenant)).toBe('Hier à 18:05')
    expect(quand(new Date(2026, 9, 1, 10, 12).toISOString(), maintenant)).toBe('Le 1er octobre à 10:12')
  })
})

describe('utilisation', () => {
  it('écrit la consommation face à la limite', () => {
    expect(texteUtilisation('produits', 97, 100)).toBe('97 sur 100')
    expect(texteUtilisation('produits', 1240, null)).toMatch(/^1\s240$/)
    expect(texteUtilisation('employes', 0, 0)).toBe('Patron seul')
  })

  it('repère le moment où la limite approche', () => {
    expect(presDeLaLimite(90, 100)).toBe(true)
    expect(presDeLaLimite(89, 100)).toBe(false)
    expect(presDeLaLimite(5000, null)).toBe(false)
  })
})
