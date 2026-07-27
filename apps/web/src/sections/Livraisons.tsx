import { useEffect, useState } from 'react'
import { Livraisons as Api, Commandes, fcfa } from '../lib/api'
import { confirmAsync } from '../lib/toast'

const STATUS: Record<string, { label: string; cls: string }> = {
  en_attente: { label: '⏳ En attente', cls: 'pill-low' },
  en_cours: { label: '🛵 En cours', cls: 'pill-low' },
  livree: { label: '✓ Livrée', cls: 'pill-ok' },
}

export default function Livraisons() {
  const [list, setList] = useState<any[]>([])
  const [commandes, setCommandes] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)

  const load = () => { Api.list().then(setList); Commandes.list().then(setCommandes) }
  useEffect(() => { load() }, [])

  const advance = async (l: any) => {
    const next = l.status === 'en_attente' ? 'en_cours' : 'livree'
    await Api.setStatus(l.id, next); load()
  }
  const remove = async (l: any) => { if (await confirmAsync('Supprimer cette livraison ?')) { await Api.remove(l.id); load() } }

  return (
    <>
      <div className="page-header"><h2>🚚 Livraisons</h2><button className="btn-primary" onClick={() => setShowModal(true)}>+ Suivre</button></div>

      {list.length === 0 && <div className="empty-state"><div className="empty-icon">🚚</div><div className="empty-text">Aucune livraison</div><div className="empty-sub">Suivez la livraison d'une commande</div></div>}

      {list.map((l) => (
        <div key={l.id} className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="produit-name">{l.fournisseur_name || 'Livraison'} {l.commande_total ? `· ${fcfa(Number(l.commande_total))}` : ''}</div>
              {l.tracking_note && <div className="produit-desc">📍 {l.tracking_note}</div>}
              {l.delivered_at && <div className="produit-desc">Livrée le {(l.delivered_at || '').slice(0, 10)}</div>}
            </div>
            <span className={`produit-stock-pill ${(STATUS[l.status] || STATUS.en_attente).cls}`}>{(STATUS[l.status] || { label: l.status }).label}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {l.status !== 'livree' && <button className="pay-btn pay-g" style={{ padding: 10, margin: 0 }} onClick={() => advance(l)}>{l.status === 'en_attente' ? '▶️ Démarrer' : '✓ Marquer livrée'}</button>}
            <button className="prd-btn prd-btn-del" onClick={() => remove(l)}>🗑️</button>
          </div>
        </div>
      ))}

      {showModal && <LivraisonModal commandes={commandes} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />}
    </>
  )
}

function LivraisonModal({ commandes, onClose, onSaved }: { commandes: any[]; onClose: () => void; onSaved: () => void }) {
  const [cid, setCid] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try { await Api.create(cid ? Number(cid) : null, note || undefined); onSaved() }
    catch (e: any) { alert(e?.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">🚚 Suivre une livraison</div>
        <div className="form-group"><label>Commande liée</label>
          <select value={cid} onChange={(e) => setCid(e.target.value)}>
            <option value="">Aucune</option>
            {commandes.map((c) => <option key={c.id} value={c.id}>#{c.id} · {c.fournisseur_name || 'Sans fournisseur'} · {fcfa(Number(c.total))}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Note de suivi</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Transporteur, n° de suivi..." /></div>
        <div className="modal-actions"><button className="btn-cancel" onClick={onClose}>Annuler</button><button className="btn-confirm" onClick={save} disabled={saving}>Créer</button></div>
      </div>
    </div>
  )
}
