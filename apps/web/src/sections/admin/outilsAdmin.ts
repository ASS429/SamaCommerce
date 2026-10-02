/* Outils du panneau d'administration : navigation par l'adresse, clés du
 * cache, noms, formats de dates et de montants, statut d'un commerçant.
 * (Les composants partagés sont dans communs.tsx.) */

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { LigneCommercant, StatutCommercant } from '../../outils/api'

// ─── Navigation : la vue et son élément choisi vivent dans l'adresse ───
// (#/paiements?id=12). Le bouton Retour du téléphone ferme un volet, et un
// lien copié rouvre le bon écran.

export type Vue = 'accueil' | 'paiements' | 'commercants' | 'plans' | 'finances' | 'parametres'
const VUES: Vue[] = ['accueil', 'paiements', 'commercants', 'plans', 'finances', 'parametres']
export type Parametres = Record<string, string | number | null | undefined>

function lireAdresse(): { vue: Vue; params: URLSearchParams } {
  const [chemin = '', requete = ''] = window.location.hash.replace(/^#\/?/, '').split('?')
  return { vue: (VUES as string[]).includes(chemin) ? (chemin as Vue) : 'accueil', params: new URLSearchParams(requete) }
}

export function useAdresse() {
  const [adresse, definirAdresse] = useState(lireAdresse)
  useEffect(() => {
    const surChangement = () => definirAdresse(lireAdresse())
    window.addEventListener('hashchange', surChangement)
    return () => window.removeEventListener('hashchange', surChangement)
  }, [])
  return adresse
}

/** `remplacer` : sans nouvelle entrée d'historique (sélection automatique, filtres). */
export function aller(vue: Vue, params: Parametres = {}, remplacer = false) {
  const p = new URLSearchParams()
  for (const [cle, valeur] of Object.entries(params)) {
    if (valeur !== null && valeur !== undefined && valeur !== '') p.set(cle, String(valeur))
  }
  const requete = p.toString()
  const cible = `#/${vue}${requete ? '?' + requete : ''}`
  if (cible === window.location.hash) return
  if (remplacer) {
    history.replaceState(history.state, '', cible)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = cible
  }
}

/** Liste et volet côte à côte (ordinateur) ou volet plein écran (téléphone). */
export function useEcranLarge() {
  const requete = '(min-width: 1024px)'
  const [large, definirLarge] = useState(() => window.matchMedia(requete).matches)
  useEffect(() => {
    const media = window.matchMedia(requete)
    const surChangement = () => definirLarge(media.matches)
    media.addEventListener('change', surChangement)
    return () => media.removeEventListener('change', surChangement)
  }, [])
  return large
}

// ─── Cache des données : tout ce qui est « admin » se relit d'un coup ───
// après une écriture. Les vues se recoupent (une validation change la file,
// la fiche du commerçant, le tableau de bord et les finances) : invalider
// le préfixe entier est plus sûr que de deviner ce qui a bougé.

export const CLES_ADMIN = {
  tout: ['admin'] as const,
  tableau: ['admin', 'tableau'] as const,
  paiements: (statut: string) => ['admin', 'paiements', statut] as const,
  paiement: (id: number) => ['admin', 'paiement', id] as const,
  commercants: (filtre: string, recherche: string) => ['admin', 'commercants', filtre, recherche] as const,
  commercant: (id: number) => ['admin', 'commercant', id] as const,
  plans: ['admin', 'plans'] as const,
  reglages: ['admin', 'reglages'] as const,
  finances: (mois: string) => ['admin', 'finances', mois] as const,
  appareils: ['admin', 'appareils'] as const,
}

export function useRafraichirAdmin() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: CLES_ADMIN.tout })
}

export type Ton = 'ok' | 'info' | 'attention' | 'danger' | 'neutre' | 'violet'

export function initiale(texte: string | null | undefined): string {
  return (texte ?? '').trim().charAt(0).toUpperCase() || '?'
}

/** Nom affichable d'un commerçant : son commerce, sinon son identifiant. */
export function nomCommercant(c: { nom_commerce: string | null; identifiant: string }): string {
  return c.nom_commerce?.trim() || c.identifiant
}

// ─── Dates et montants ───

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

const jourSeul = (iso: string) => {
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number)
  return { a, m, j }
}

/** « 2026-10-28 » → « 28 oct. » ; date seule, sans décalage de fuseau. */
export function dateCourte(iso: string | null | undefined): string {
  if (!iso) return ''
  const { m, j } = jourSeul(iso)
  if (!m || !j) return ''
  return `${j === 1 ? '1er' : j} ${MOIS_COURTS[m - 1]}`
}

/** Jour et mois d'un instant (« 18 oct. »), dans le fuseau de l'appareil. */
export function jourCourt(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS_COURTS[d.getMonth()]}`
}

/** « 2026-10 » → « octobre 2026 ». */
export function moisLong(mois: string, avecAnnee = true): string {
  const [a, m] = mois.split('-').map(Number)
  if (!a || !m) return mois
  return MOIS_LONGS[m - 1] + (avecAnnee ? ` ${a}` : '')
}

/** « octobre » → « d’octobre » ; « mars » → « de mars ». */
export function deMois(mois: string): string {
  const nom = moisLong(mois, false)
  return /^[aeiouyéèêàâîïôû]/i.test(nom) ? `d’${nom}` : `de ${nom}`
}

export const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1)

/** « 2026-10 » → « Oct. » (axe d'un graphique). */
export function moisCourt(mois: string): string {
  const m = Number(mois.split('-')[1])
  return m ? majuscule(MOIS_COURTS[m - 1]) : mois
}

/** « 1 abonné payant », « 14 abonnés payants » (0 reste au singulier en français). */
export const pluriel = (n: number, un: string, plusieurs: string) => `${new Intl.NumberFormat('fr-FR').format(n)} ${n > 1 ? plusieurs : un}`

/** « à l’instant », « il y a 17 h », « hier », « il y a 4 jours ». */
export function depuis(iso: string | null | undefined, maintenant = Date.now()): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const minutes = Math.max(0, Math.round((maintenant - t) / 60_000))
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const heures = Math.round(minutes / 60)
  if (heures < 24) return `il y a ${heures} h`
  const jours = Math.round(minutes / 1440)
  if (jours <= 1) return 'hier'
  if (jours < 31) return `il y a ${jours} jours`
  const mois = Math.round(jours / 30.4)
  return mois < 12 ? `il y a ${mois} mois` : `il y a ${Math.floor(mois / 12)} an${mois >= 24 ? 's' : ''}`
}

/** Dernière activité d'un commerçant : « Vu aujourd’hui », « Vu il y a 18 j ». */
export function vu(iso: string | null | undefined, maintenant = new Date()): string {
  if (!iso) return 'Jamais connecté'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const minuit = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const jours = Math.round((minuit(maintenant) - minuit(d)) / 86_400_000)
  if (jours <= 0) return 'Vu aujourd’hui'
  if (jours === 1) return 'Vu hier'
  return `Vu il y a ${jours} j`
}

/** Montant court pour un graphique : 12 500 → « 12,5 k ». */
export function montantCourt(n: number): string {
  if (Math.abs(n) < 1000) return `${n} F`
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n / 1000)} k`
}

/** Écart entre le montant déclaré et le prix : « Il manque 500 F ». */
export function texteEcart(ecart: number): string {
  const valeur = new Intl.NumberFormat('fr-FR').format(Math.abs(ecart)) + ' F'
  return ecart < 0 ? `Il manque ${valeur}` : `${valeur} de trop`
}

// ─── Statut d'un commerçant ───

const TONS_STATUT: Record<StatutCommercant, Ton> = {
  bloque: 'neutre', attente: 'violet', expire: 'danger', essai_fin: 'attention', bientot: 'attention', essai: 'info', actif: 'ok', gratuit: 'neutre',
}

/** La pastille d'une ligne : un mot, et le délai quand il compte. */
export function pastilleStatut(c: Pick<LigneCommercant, 'statut' | 'jours_restants'>): { ton: Ton; texte: string } {
  const j = c.jours_restants
  const texte = (() => {
    switch (c.statut) {
      case 'bloque': return 'Bloqué'
      case 'attente': return 'Paiement à vérifier'
      case 'expire': return j !== null && j >= 0 ? `Expiré · grâce ${j} j` : 'Expiré'
      case 'essai_fin':
      case 'essai': return j !== null ? `Essai · ${j} j` : 'Essai'
      case 'bientot': return j === null ? 'Échéance proche' : j <= 0 ? 'Expire aujourd’hui' : j === 1 ? 'Expire demain' : `Expire dans ${j} j`
      case 'actif': return 'Actif'
      default: return 'Gratuit'
    }
  })()
  return { ton: TONS_STATUT[c.statut], texte }
}

/** Colonne « Échéance » : la date qui compte selon la situation. */
export function echeanceCourte(c: Pick<LigneCommercant, 'source' | 'echeance'>): string {
  if (!c.echeance) return 'Sans échéance'
  if (c.source === 'essai') return `Fin le ${dateCourte(c.echeance)}`
  if (c.source === 'grace') return `Grâce jusqu’au ${dateCourte(c.echeance)}`
  return `Le ${dateCourte(c.echeance)}`
}

/** Message d'une erreur d'API, pour une bulle ou un formulaire. */
export function messageErreur(e: unknown, repli = 'L’opération n’a pas abouti. Réessayez.'): string {
  const donnees = (e as { response?: { data?: { erreur?: string; message?: string; errors?: Record<string, string[]> } } })?.response?.data
  const premiere = donnees?.errors ? Object.values(donnees.errors)[0]?.[0] : undefined
  if (premiere) return premiere
  if (donnees?.erreur) return donnees.erreur
  if (!(e as { response?: unknown })?.response) return 'Le serveur ne répond pas. Vérifiez la connexion et réessayez.'
  return donnees?.message || repli
}
