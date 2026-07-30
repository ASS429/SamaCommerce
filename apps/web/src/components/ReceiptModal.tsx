import { fcfa, getUser } from '../lib/api'
import Logo from './Logo'

export type ReceiptItem = { name: string; qty: number; price: number }

/** Reçu stylé, imprimable via window.print() (CSS @media print isole .receipt-print). */
export default function ReceiptModal({ items, onClose, onWhatsapp }: {
  items: ReceiptItem[]
  onClose: () => void
  onWhatsapp: () => void
}) {
  const boutique = getUser()?.company_name || 'Ma Boutique'
  const total = items.reduce((s, l) => s + l.price * l.qty, 0)
  const date = new Date().toLocaleString('fr-FR')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
        <div className="receipt-print">
          <div className="receipt-head">
            <Logo size={44} style={{ margin: '0 auto 6px', borderRadius: 12 }} />
            <div className="receipt-shop">{boutique}</div>
            <div className="receipt-meta">{date}</div>
          </div>
          <div className="receipt-lines">
            {items.map((l, i) => (
              <div key={i} className="receipt-line">
                <span className="rl-name">{l.name} <span style={{ color: 'var(--muted)' }}>×{l.qty}</span></span>
                <span className="rl-amount">{fcfa(l.price * l.qty)}</span>
              </div>
            ))}
          </div>
          <div className="receipt-total">
            <span className="rt-l">TOTAL</span>
            <span className="rt-v">{fcfa(total)}</span>
          </div>
          <div className="receipt-thanks">Merci de votre achat ! 🙏</div>
        </div>
        {/* WhatsApp d'abord : c'est par là que le reçu part réellement. Peu de
            boutiques ont une imprimante. */}
        <div className="modal-actions no-print">
          <button className="btn-wa" onClick={onWhatsapp}>💬 WhatsApp</button>
          <button className="btn-cancel" style={{ flex: '0 0 auto', minWidth: 96 }} onClick={() => window.print()}>🖨️ Imprimer</button>
        </div>
        <button className="auth-link no-print" onClick={onClose}>Fermer</button>
      </div>
    </div>
  )
}
