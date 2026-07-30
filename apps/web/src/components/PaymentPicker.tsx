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

        {/* Même damier que l'encaissement : un seul geste à apprendre, qu'on
            encaisse une vente ou qu'on enregistre un remboursement. */}
        <div className="paymode-grid">
          {PAY_METHODS.map((m) => (
            <button key={m.id} className={`paymode${m.tone === 'cash' ? ' paymode-cash' : ''}`} onClick={() => onPick(m.id)}>
              {m.logo
                ? <img src={m.logo} alt="" width={30} height={30} loading="lazy" />
                : <span className="pm-ico" aria-hidden="true">{m.emoji}</span>}
              <span className="pm-body"><span className="pm-t">{m.label}</span><span className="pm-s">{m.sub}</span></span>
            </button>
          ))}
        </div>

        <button className="btn-cancel" style={{ width: '100%', marginTop: 10 }} onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}
