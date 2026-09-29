/* Moyens de paiement — source unique de vérité (libellés + logos officiels).
 * Séparé du composant pour rester importable partout sans casser le
 * rafraîchissement à chaud de Vite. */

export type MoyenPaiement = 'especes' | 'wave' | 'orange'

export const MOYENS_PAIEMENT: {
  id: MoyenPaiement
  libelle: string
  sousTitre: string
  logo?: string
  emoji?: string
  teinte?: string
}[] = [
  { id: 'especes', libelle: 'Espèces', sousTitre: 'Paiement en liquide', emoji: '💵', teinte: 'especes' },
  { id: 'wave', libelle: 'Wave', sousTitre: 'Paiement mobile', logo: '/paiement/wave.png' },
  { id: 'orange', libelle: 'Orange Money', sousTitre: 'Paiement mobile', logo: '/paiement/orange-money.png' },
]

/** Libellé lisible d'un moyen de paiement (historique, reçus, exports…). */
export function libellePaiement(id?: string | null): string {
  return MOYENS_PAIEMENT.find((m) => m.id === id)?.libelle ?? (id === 'credit' ? 'Crédit' : id ?? '—')
}
