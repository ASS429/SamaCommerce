import { describe, expect, it } from 'vitest'
import { APPUI_COURT_MS, SEUIL_ANNULER, SEUIL_VERROUILLER, deciderGeste, estAppuiCourt, formaterDuree, suivreDoigt } from './gesteVocal'

describe('Le geste du bouton vocal, comme sur WhatsApp', () => {
  it('glisser vers la gauche au-delà du seuil annule le message', () => {
    expect(deciderGeste(-SEUIL_ANNULER + 1, 0)).toBe('continuer')
    expect(deciderGeste(-SEUIL_ANNULER, 0)).toBe('annuler')
  })

  it('un geste vif vers la gauche annule avant le seuil ; un tremblement du doigt, non', () => {
    expect(deciderGeste(-60, 0, -1.2)).toBe('annuler')
    expect(deciderGeste(-20, 0, -1.2)).toBe('continuer')
    expect(deciderGeste(-60, 0, -0.3)).toBe('continuer')
  })

  it('monter franchement verrouille ; une diagonale vers la gauche ne verrouille pas', () => {
    expect(deciderGeste(0, -SEUIL_VERROUILLER)).toBe('verrouiller')
    expect(deciderGeste(-100, -SEUIL_VERROUILLER)).toBe('continuer')
    expect(deciderGeste(0, -SEUIL_VERROUILLER + 1)).toBe('continuer')
  })

  it('le bouton ne suit le doigt que vers la gauche ou vers le haut, un axe à la fois', () => {
    expect(suivreDoigt(40, 30)).toEqual({ x: 0, y: 0 })
    expect(suivreDoigt(-50, -10)).toEqual({ x: -50, y: 0 })
    expect(suivreDoigt(-10, -50)).toEqual({ x: 0, y: -50 })
  })

  it('un appui bref est un simple toucher, qui explique le geste au lieu d’envoyer', () => {
    expect(estAppuiCourt(APPUI_COURT_MS - 1)).toBe(true)
    expect(estAppuiCourt(APPUI_COURT_MS)).toBe(false)
  })

  it('affiche les durées comme WhatsApp', () => {
    expect(formaterDuree(0)).toBe('0:00')
    expect(formaterDuree(7.9)).toBe('0:07')
    expect(formaterDuree(62)).toBe('1:02')
    expect(formaterDuree(-3)).toBe('0:00')
  })
})
