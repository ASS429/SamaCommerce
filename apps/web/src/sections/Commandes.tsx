import { useEffect, useState } from 'react'
import { Commandes as Api, Fournisseurs, Products, fcfa, type Fournisseur, type Product } from '../lib/api'
import { confirmAsync } from '../lib/toast'

export default function Commandes() {
  const [list, setList] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)

  const load = () => Api.list().then(setList)
  useEffect(() => { load() }, [])

  const recevoir = async (c: any) => {
    if (!await confirmAsync('Marquer cette commande comme reçue ? Le stock sera mis à jour.')) return
    const d = await Api.recevoir(c.id); alert(d.message); load()
  }
  const remove = async (c: any) => { if (await confirmAsync('Supprimer cette commande ?')) { await Api.remove(c.id); load() } }

  return (
    <>
      <div className="page-header"><h2>📋 Commandes</h2><button className="btn-primary" onClick={() => setShowModal(true)}>+ Nouvelle</button></div>

      {list.length === 0 && <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-text">Aucune commande</div><div className="empty-sub">Commandez du réappro à un fournisseur</div></div>}

      {list.map((c) => (
        <div key={c.id} className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="produit-name">{c.fournisseur_name || 'Sans fournisseur'}</div>
              <div className="produit-desc">{c.items_count} article(s) · {(c.created_at || '').slice(0, 10)}</div>
              {c.notes && <div className="produit-desc">📝 {c.notes}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="produit-price-main" style={{ color: 'var(--primary)' }}>{fcfa(Number(c.total))}</div>
              <span className={`produit-stock-pill ${c.status === 'recue' ? 'pill-ok' : 'pill-low'}`}>{c.status === 'recue' ? '✓ Reçue' : '⏳ En attente'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {c.status !== 'recue' && <button className="pay-btn pay-g" style={{ padding: 10, margin: 0 }} onClick={() => recevoir(c)}>📦 Marquer reçue (+ stock)</button>}
            <button className="prd-btn prd-btn-del" onClick={() => remove(c)}>🗑️</button>
          </div>
        </div>
      ))}

      {showModal && <CommandeModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />}
    </>
  )
}

type Line = { product_id: number; quantity: number; prix_unitaire: number; name: string }

function CommandeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [fid, setFid] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { Fournisseurs.list().then(setFournisseurs); Products.list().then(setProducts) }, [])

  const addLine = (p: Product) => {
    if (lines.find((l) => l.product_id === p.id)) return
    setLines([...lines, { product_id: p.id, quantity: 1, prix_unitaire: Number(p.price_achat), name: p.name }])
  }
  const total = lines.reduce((s, l) => s + l.quantity * l.prix_unitaire, 0)

  const save = async () => {
    if (lines.length === 0) return alert('Ajoutez au moins un article')
    setSaving(true)
    try {
      await Api.create({ fournisseur_id: fid ? Number(fid) : null, notes: notes || null, items: lines.map(({ product_id, quantity, prix_unitaire }) => ({ product_id, quantity, prix_unitaire })) })
      onSaved()
    } catch (e: any) { alert(e?.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">📋 Nouvelle commande</div>
        <div className="form-group"><label>Fournisseur</label>
          <select value={fid} onChange={(e) => setFid(e.target.value)}>
            <option value="">Aucun</option>
            {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Ajouter un produit</label>
          <select value="" onChange={(e) => { const p = products.find((x) => x.id === Number(e.target.value)); if (p) addLine(p) }}>
            <option value="">Choisir un produit…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} (stock {p.stock})</option>)}
          </select>
        </div>
        {lines.map((l, i) => (
          <div key={l.product_id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{l.name}</span>
            <input type="number" min={1} value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} style={{ width: 56, padding: 6, border: '1.5px solid #E5E7EB', borderRadius: 8 }} />
            <input type="number" value={l.prix_unitaire} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, prix_unitaire: Number(e.target.value) } : x))} style={{ width: 72, padding: 6, border: '1.5px solid #E5E7EB', borderRadius: 8 }} />
            <button className="prd-btn prd-btn-del" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <div className="form-group" style={{ marginTop: 8 }}><label>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="total-bar"><span className="tbl">TOTAL</span><span className="tba">{fcfa(total)}</span></div>
        <div className="modal-actions"><button className="btn-cancel" onClick={onClose}>Annuler</button><button className="btn-confirm" onClick={save} disabled={saving}>Créer</button></div>
      </div>
    </div>
  )
}
