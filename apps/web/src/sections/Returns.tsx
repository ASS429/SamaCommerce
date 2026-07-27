import { useEffect, useState } from 'react'
import { Returns as Api, Sales, fcfa, type Sale } from '../lib/api'

export default function Returns() {
  const [list, setList] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [showModal, setShowModal] = useState(false)

  const load = () => {
    Api.list().then(setList); Api.stats().then(setStats)
    Sales.list().then((s) => setSales(s.filter((x) => x.quantity > 0 && x.payment_method !== 'retour')))
  }
  useEffect(() => { load() }, [])

  return (
    <>
      <div className="page-header"><h2>↩️ Retours</h2><button className="btn-primary" onClick={() => setShowModal(true)}>+ Nouveau retour</button></div>

      {stats && (
        <div className="stat-2x2">
          <div className="st st-p"><div className="sv">{stats.nb_retours}</div><div className="sl">Retours total</div></div>
          <div className="st st-y"><div className="sv">{fcfa(stats.total_rembourse)}</div><div className="sl">Remboursé</div></div>
          <div className="st st-b"><div className="sv">{stats.retours_jour}</div><div className="sl">Aujourd'hui</div></div>
          <div className="st st-g"><div className="sv">{fcfa(stats.rembourse_jour)}</div><div className="sl">Remb. jour</div></div>
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="card-title">📜 Historique des retours</div>
        <table className="hist-table">
          <thead><tr><th>Date</th><th>Produit</th><th>Qté</th><th>Motif</th><th>Remboursé</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 16 }}>Aucun retour</td></tr>}
            {list.map((r) => (
              <tr key={r.id}>
                <td>{(r.created_at || '').slice(0, 10)}</td>
                <td>{r.product_name}</td>
                <td>{r.quantity}</td>
                <td>{r.reason || '—'}</td>
                <td style={{ fontWeight: 700, color: 'var(--red)' }}>{fcfa(Number(r.refund_amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
    try { const d = await Api.create(Number(saleId), Number(qty) || 1, reason || undefined, method); alert(d.message); onSaved() }
    catch (e: any) { alert(e?.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">↩️ Nouveau retour</div>
        <div className="form-group"><label>Vente concernée</label>
          <select value={saleId} onChange={(e) => setSaleId(e.target.value)}>
            <option value="">Choisir une vente</option>
            {sales.map((s) => <option key={s.id} value={s.id}>#{s.id} · {s.product_name} × {s.quantity} · {fcfa(Number(s.total))} · {(s.created_at || '').slice(0, 10)}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Quantité retournée</label><input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div className="form-group"><label>Motif</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Défectueux, erreur..." /></div>
        <div className="form-group"><label>Remboursement</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="avoir">Avoir</option><option value="especes">Espèces</option><option value="wave">Wave</option><option value="orange">Orange</option>
          </select>
        </div>
        <div className="modal-actions"><button className="btn-cancel" onClick={onClose}>Annuler</button><button className="btn-confirm" onClick={save} disabled={saving}>Valider le retour</button></div>
      </div>
    </div>
  )
}
