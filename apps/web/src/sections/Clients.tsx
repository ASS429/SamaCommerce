import { useEffect, useState } from 'react'
import { Clients as ClientsApi, fcfa, type Client } from '../lib/api'
import { confirmAsync } from '../lib/toast'
import { SkeletonList } from '../components/Skeleton'
import SwipeRow from '../components/SwipeRow'

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => ClientsApi.list().then(setClients).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const remove = async (c: Client) => { if (await confirmAsync(`Supprimer « ${c.name} » ?`)) { await ClientsApi.remove(c.id); load() } }
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <div className="page-header"><h2>👤 Clients</h2><button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>+ Ajouter</button></div>
      <input className="search-bar" placeholder="🔍 Rechercher un client..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {loading && <SkeletonList count={4} />}
      {!loading && filtered.length === 0 && <div className="empty-state"><div className="empty-icon">👤</div><div className="empty-text">Aucun client</div><div className="empty-sub">Ajoutez votre premier client</div></div>}

      {!loading && filtered.map((c) => (
        <SwipeRow key={c.id} onDelete={() => remove(c)}>
        <div className="card" style={{ padding: 14, marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="produit-name">{c.name}</div>
              {c.phone && <div className="produit-desc">📞 {c.phone}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="prd-btn prd-btn-edit" onClick={() => { setEditing(c); setShowModal(true) }}>✏️</button>
              <button className="prd-btn prd-btn-del" onClick={() => remove(c)}>🗑️</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <span className="cat-badge" style={{ background: '#EFF6FF', color: 'var(--blue)' }}>{c.nb_achats || 0} achat(s)</span>
            <span className="cat-badge" style={{ background: '#ECFDF5', color: 'var(--green)' }}>{fcfa(c.total_achats || 0)}</span>
            {(c.credits_montant || 0) > 0 && <span className="cat-badge" style={{ background: '#FEE2E2', color: 'var(--red)' }}>Dette {fcfa(c.credits_montant || 0)}</span>}
          </div>
        </div>
        </SwipeRow>
      ))}

      {showModal && <ClientModal client={editing} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />}
    </>
  )
}

function ClientModal({ client, onClose, onSaved }: { client: Client | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(client?.name ?? '')
  const [phone, setPhone] = useState(client?.phone ?? '')
  const [email, setEmail] = useState(client?.email ?? '')
  const [address, setAddress] = useState(client?.address ?? '')
  const [notes, setNotes] = useState(client?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) return alert('Le nom est requis')
    setSaving(true)
    const payload = { name: name.trim(), phone: phone || null, email: email || null, address: address || null, notes: notes || null }
    try { if (client) await ClientsApi.update(client.id, payload); else await ClientsApi.create(payload); onSaved() }
    catch (e: any) { alert(e?.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{client ? '✏️ Modifier le client' : '👤 Nouveau client'}</div>
        <div className="form-group"><label>Nom</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du client" /></div>
        <div className="form-group"><label>Téléphone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div className="form-group"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="form-group"><label>Adresse</label><input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <div className="form-group"><label>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="modal-actions"><button className="btn-cancel" onClick={onClose}>Annuler</button><button className="btn-confirm" onClick={save} disabled={saving}>{client ? 'Mettre à jour' : 'Ajouter'}</button></div>
      </div>
    </div>
  )
}
