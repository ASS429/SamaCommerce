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
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <Logo size={44} style={{ margin: '0 auto 6px', borderRadius: 12 }} />
            <div className="sora" style={{ fontSize: 18, fontWeight: 800 }}>{boutique}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{date}</div>
          </div>
          <div style={{ borderTop: '1px dashed var(--line)', borderBottom: '1px dashed var(--line)', padding: '8px 0', margin: '8px 0' }}>
            {items.map((l, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                <span>{l.name} <span style={{ color: 'var(--muted)' }}>×{l.qty}</span></span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fcfa(l.price * l.qty)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="sora" style={{ fontWeight: 700 }}>TOTAL</span>
            <span className="sora" style={{ fontWeight: 800, fontSize: 20, color: 'var(--brand)' }}>{fcfa(total)}</span>
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>Merci de votre achat ! 🙏</div>
        </div>
        <div className="modal-actions no-print">
          <button className="btn-cancel" onClick={onClose}>Fermer</button>
          <button className="prd-btn prd-btn-edit" style={{ flex: 1 }} onClick={() => window.print()}>🖨️ Imprimer</button>
          <button className="btn-confirm" style={{ flex: 1 }} onClick={onWhatsapp}>📲 WhatsApp</button>
        </div>
      </div>
    </div>
  )
}
