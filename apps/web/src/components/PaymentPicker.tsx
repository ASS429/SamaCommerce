import { fcfa } from '../lib/api'
import { PAY_METHODS, type PayMethod } from '../lib/payments'

/* Sélecteur de moyen de paiement, avec les logos réels des opérateurs.
 * Utilisé pour l'encaissement ET le remboursement d'un crédit — auparavant
 * ce dernier demandait de TAPER « especes / wave / orange » au clavier, une
 * saisie fastidieuse et source de fautes au comptoir. */

export default function PaymentPicker({ title, amount, onPick, onClose }: {
  title: string
  amount?: number
  onPick: (m: PayMethod) => void
  onClose: () => void
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>

        {amount != null && (
          <div className="pay-amount">
            <span className="pay-amount-label">Montant</span>
            <span className="pay-amount-value">{fcfa(amount)}</span>
          </div>
        )}

        <div className="pay-list">
          {PAY_METHODS.map((m) => (
            <button key={m.id} className={`pay-opt${m.tone ? ' pay-opt-' + m.tone : ''}`} onClick={() => onPick(m.id)}>
              {m.logo
                ? <img className="pay-logo" src={m.logo} alt="" width={40} height={40} loading="lazy" />
                : <span className="pay-logo pay-logo-emoji">{m.emoji}</span>}
              <span className="pay-opt-text"><b>{m.label}</b><small>{m.sub}</small></span>
              <span className="pay-opt-go">›</span>
            </button>
          ))}
        </div>

        <button className="btn-cancel" style={{ width: '100%', marginTop: 10 }} onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}
