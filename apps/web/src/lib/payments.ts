/* Moyens de paiement — source unique de vérité (libellés + logos officiels).
 * Séparé du composant pour rester importable partout sans casser le
 * rafraîchissement à chaud de Vite. */

export type PayMethod = 'especes' | 'wave' | 'orange'

export const PAY_METHODS: {
  id: PayMethod
  label: string
  sub: string
  logo?: string
  emoji?: string
  tone?: string
}[] = [
  { id: 'especes', label: 'Espèces', sub: 'Paiement en liquide', emoji: '💵', tone: 'cash' },
  { id: 'wave', label: 'Wave', sub: 'Paiement mobile', logo: '/pay/wave.png' },
  { id: 'orange', label: 'Orange Money', sub: 'Paiement mobile', logo: '/pay/orange-money.png' },
]

/** Libellé lisible d'un moyen de paiement (historique, reçus, exports…). */
export function payLabel(id?: string | null): string {
  return PAY_METHODS.find((m) => m.id === id)?.label ?? (id === 'credit' ? 'Crédit' : id ?? '—')
}
