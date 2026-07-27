import { useEffect, useState } from 'react'
import { Fournisseurs as Api, type Fournisseur } from '../lib/api'
import { confirmAsync } from '../lib/toast'

export default function Fournisseurs() {
  const [list, setList] = useState<Fournisseur[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Fournisseur | null>(null)

  const load = () => Api.list().then(setList)
  useEffect(() => { load() }, [])

  const remove = async (f: Fournisseur) => { if (await confirmAsync(`Supprimer « ${f.name} » ?`)) { await Api.remove(f.id); load() } }
  const reappro = async (f: Fournisseur) => {
    const d = await Api.reappro(f.id)
    if (await confirmAsync(`Envoyer la relance WhatsApp à ${f.name} ?\n\n${d.message}`)) window.open(d.whatsapp_url, '_blank')
  }
  const filtered = list.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <div className="page-header"><h2>🚚 Fournisseurs</h2><button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>+ Ajouter</button></div>
      <input className="search-bar" placeholder="🔍 Rechercher un fournisseur..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {filtered.length === 0 && <div className="empty-state"><div className="empty-icon">🚚</div><div className="empty-text">Aucun fournisseur</div></div>}

      {filtered.map((f) => (
        <div key={f.id} className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="produit-name">{f.name}</div>
              {f.phone && <div className="produit-desc">📞 {f.phone}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="prd-btn prd-btn-edit" onClick={() => { setEditing(f); setShowModal(true) }}>✏️</button>
              <button className="prd-btn prd-btn-del" onClick={() => remove(f)}>🗑️</button>
            </div>
          </div>
          {f.phone && <button className="pay-btn pay-g" style={{ marginTop: 10, padding: 10 }} onClick={() => reappro(f)}>📲 Relance réappro WhatsApp</button>}
        </div>
      ))}

      {showModal && <FournisseurModal item={editing} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />}
    </>
  )
}

function FournisseurModal({ item, onClose, onSaved }: { item: Fournisseur | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name ?? '')
  const [phone, setPhone] = useState(item?.phone ?? '')
  const [email, setEmail] = useState(item?.email ?? '')
  const [address, setAddress] = useState(item?.address ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) return alert('Le nom est requis')
    setSaving(true)
    const payload = { name: name.trim(), phone: phone || null, email: email || null, address: address || null, notes: notes || null }
    try { if (item) await Api.update(item.id, payload); else await Api.create(payload); onSaved() }
    catch (e: any) { alert(e?.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{item ? '✏️ Modifier le fournisseur' : '🚚 Nouveau fournisseur'}</div>
        <div className="form-group"><label>Nom</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="form-group"><label>Téléphone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div className="form-group"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="form-group"><label>Adresse</label><input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <div className="form-group"><label>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="modal-actions"><button className="btn-cancel" onClick={onClose}>Annuler</button><button className="btn-confirm" onClick={save} disabled={saving}>{item ? 'Mettre à jour' : 'Ajouter'}</button></div>
      </div>
    </div>
  )
}
