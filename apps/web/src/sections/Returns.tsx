import { useEffect, useState } from 'react'
import { Returns as Api, Sales, fcfa, type Sale } from '../lib/api'
import { toast } from '../lib/toast'
import { SkeletonList } from '../components/Skeleton'
import { productIcon, productTint } from '../lib/productIcon'

/* Motif du remboursement : quatre images plutôt qu'une liste déroulante. */
const REFUND: { value: string; icon: string; label: string }[] = [
  { value: 'avoir', icon: '🎟️', label: 'Avoir' },
  { value: 'especes', icon: '💵', label: 'Espèces' },
  { value: 'wave', icon: '📲', label: 'Wave' },
  { value: 'orange', icon: '📞', label: 'Orange' },
]

export default function Returns() {
  const [list, setList] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = () => {
    Api.list().then(setList).finally(() => setLoading(false))
    Api.stats().then(setStats).catch(() => {})
    Sales.list().then((s) => setSales(s.filter((x) => x.quantity > 0 && x.payment_method !== 'retour'))).catch(() => {})
  }
  useEffect(() => { load() }, [])

  return (
    <>
      <div className="page-header"><h2>↩️ Retours</h2><button className="btn-primary" onClick={() => setShowModal(true)}>+ Nouveau retour</button></div>

      {/* Les compteurs restent visibles pendant le chargement : un cadre vide
          donne l'impression que l'application a planté. */}
      <div className="stat-2x2">
        <div className="st st-p"><div className="sv">{stats ? stats.nb_retours : '—'}</div><div className="sl">↩️ Retours total</div></div>
        <div className="st st-y"><div className="sv">{stats ? fcfa(stats.total_rembourse) : '—'}</div><div className="sl">💰 Remboursé</div></div>
        <div className="st st-b"><div className="sv">{stats ? stats.retours_jour : '—'}</div><div className="sl">📅 Aujourd'hui</div></div>
        <div className="st st-g"><div className="sv">{stats ? fcfa(stats.rembourse_jour) : '—'}</div><div className="sl">💵 Remb. jour</div></div>
      </div>

      <div className="section-label">📜 Historique des retours</div>

      {loading && <SkeletonList count={3} />}
      {!loading && list.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">↩️</div>
          <div className="empty-text">Aucun retour</div>
          <div className="empty-sub">Tant mieux : vos clients gardent ce qu'ils achètent 🎉</div>
        </div>
      )}

      {!loading && list.map((r) => (
        <div key={r.id} className="card fiche">
          <div className="fiche-head">
            <span className="produit-icon" style={{ width: 44, height: 44, fontSize: 22, borderRadius: 14, background: productTint(r.product_name) }} aria-hidden="true">
              {productIcon(r.product_name)}
            </span>
            <div className="fiche-id">
              <div className="fiche-name">{r.product_name}</div>
              <div className="fiche-sub">📅 {(r.created_at || '').slice(0, 10)} · ↩️ × {r.quantity}</div>
              {r.reason && <div className="fiche-sub">📝 {r.reason}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="produit-price-main" style={{ color: 'var(--red)' }}>−{fcfa(Number(r.refund_amount))}</div>
              <span className="produit-stock-pill pill-low">
                {(REFUND.find((m) => m.value === r.refund_method)?.icon) || '💰'} {(REFUND.find((m) => m.value === r.refund_method)?.label) || r.refund_method || 'Avoir'}
              </span>
            </div>
          </div>
        </div>
      ))}

      {showModal && <ReturnModal sales={sales} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />}
    </>
  )
}

function ReturnModal({ sales, onClose, onSaved }: { sales: Sale[]; onClose: () => void; onSaved: () => void }) {
  const [saleId, setSaleId] = useState('')
  const [qty, setQty] = useState('1')
  const [reason, setReason] = useState('')
  const [method, setMethod] = useState('avoir')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!saleId) return alert('Choisir une vente')
    setSaving(true)
    try { const d = await Api.create(Number(saleId), Number(qty) || 1, reason || undefined, method); toast(d.message, 'success'); onSaved() }
    catch (e: any) { alert(e?.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  const sale = sales.find((s) => String(s.id) === saleId)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">↩️ Nouveau retour</div>
        <div className="form-group"><label>🛒 Vente concernée</label>
          <select value={saleId} onChange={(e) => setSaleId(e.target.value)}>
            <option value="">Choisir une vente</option>
            {sales.map((s) => <option key={s.id} value={s.id}>{productIcon(s.product_name)} {s.product_name} × {s.quantity} · {fcfa(Number(s.total))} · {(s.created_at || '').slice(0, 10)}</option>)}
          </select>
        </div>
        {sale && (
          <div className="cmd-line">
            <span className="produit-icon" style={{ width: 34, height: 34, fontSize: 18, borderRadius: 11, background: productTint(sale.product_name) }} aria-hidden="true">{productIcon(sale.product_name)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sora" style={{ fontWeight: 700, fontSize: 13.5 }}>{sale.product_name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>vendu {fcfa(Number(sale.total))}</div>
            </div>
          </div>
        )}
        <div className="form-group"><label>🔢 Quantité retournée</label><input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div className="form-group"><label>📝 Motif</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Défectueux, erreur..." /></div>
        <div className="form-group"><label>💰 Remboursement</label></div>
        <div className="pick-row">
          {REFUND.map((m) => (
            <button key={m.value} type="button" className={`pick-opt ${method === m.value ? 'sel' : ''}`} onClick={() => setMethod(m.value)} aria-pressed={method === m.value}>
              <span className="pick-icon">{m.icon}</span><span>{m.label}</span>
            </button>
          ))}
        </div>
        <div className="modal-actions"><button className="btn-cancel" onClick={onClose}>Annuler</button><button className="btn-confirm" onClick={save} disabled={saving}>Valider le retour</button></div>
      </div>
    </div>
  )
}
