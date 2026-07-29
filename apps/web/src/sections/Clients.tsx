import { useEffect, useState } from 'react'
import { Clients as ClientsApi, boutiqueIdentity, fcfa, type Client } from '../lib/api'
import { confirmAsync } from '../lib/toast'
import { SkeletonList } from '../components/Skeleton'
import SwipeRow from '../components/SwipeRow'
import Avatar from '../components/Avatar'
import PhotoPicker from '../components/PhotoPicker'
import { creditReminderMessage, openWhatsapp, telLink } from '../lib/whatsapp'

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => ClientsApi.list().then(setClients).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const remove = async (c: Client) => { if (await confirmAsync(`Supprimer « ${c.name} » ?`)) { await ClientsApi.remove(c.id); load() } }
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search))

  /** Rappel de dette : le message part prérempli, le commerçant n'a qu'à envoyer. */
  const rappel = (c: Client) => openWhatsapp(c.phone, creditReminderMessage(boutiqueIdentity(), {
    client: c.name, montant: Number(c.credits_montant || 0),
  }))

  return (
    <>
      <div className="page-header"><h2>👤 Clients</h2><button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>+ Ajouter</button></div>
      <input className="search-bar" placeholder="🔍 Rechercher un client..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {loading && <SkeletonList count={4} />}
      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">👤</div>
          <div className="empty-text">{clients.length === 0 ? 'Aucun client' : 'Aucun résultat'}</div>
          <div className="empty-sub">{clients.length === 0 ? 'Ajoutez votre premier client' : 'Essayez un autre nom'}</div>
        </div>
      )}

      {!loading && filtered.map((c) => {
        const dette = Number(c.credits_montant || 0)
        const tel = telLink(c.phone)
        return (
          <SwipeRow key={c.id} onDelete={() => remove(c)}>
            <div className="card fiche" style={{ marginBottom: 0 }}>
              <div className="fiche-head">
                {/* Photo ou initiales : on identifie le client d'un coup d'œil. */}
                <Avatar photo={c.photo} name={c.name} size={52} />
                <div className="fiche-id">
                  <div className="fiche-name">{c.name}</div>
                  {c.phone && <div className="fiche-sub">📞 {c.phone}</div>}
                  {!c.phone && c.address && <div className="fiche-sub">📍 {c.address}</div>}
                </div>
                <div className="fiche-tools">
                  <button className="prd-btn prd-btn-edit" aria-label="Modifier" onClick={() => { setEditing(c); setShowModal(true) }}>✏️</button>
                  <button className="prd-btn prd-btn-del" aria-label="Supprimer" onClick={() => remove(c)}>🗑️</button>
                </div>
              </div>

              <div className="fiche-stats">
                <span className="fst fst-b"><b>{c.nb_achats || 0}</b><span>🛒 achats</span></span>
                <span className="fst fst-g"><b>{fcfa(c.total_achats || 0)}</b><span>💰 dépensé</span></span>
                {dette > 0 && <span className="fst fst-r"><b>{fcfa(dette)}</b><span>📝 dette</span></span>}
              </div>

              {c.phone && (
                <div className="fiche-actions">
                  {tel && <a className="fa-btn fa-call" href={tel}>📞 Appeler</a>}
                  <button className="fa-btn fa-wa" onClick={() => openWhatsapp(c.phone, `👋 Bonjour ${c.name},\n\n🏪 *${boutiqueIdentity().nom}*`)}>💬 WhatsApp</button>
                  {dette > 0 && <button className="fa-btn fa-warn" onClick={() => rappel(c)}>🔔 Rappel dette</button>}
                </div>
              )}
            </div>
          </SwipeRow>
        )
      })}

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
  const [photo, setPhoto] = useState<string | null>(client?.photo ?? null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) return alert('Le nom est requis')
    setSaving(true)
    const payload = { name: name.trim(), phone: phone || null, email: email || null, address: address || null, notes: notes || null, photo }
    try { if (client) await ClientsApi.update(client.id, payload); else await ClientsApi.create(payload); onSaved() }
    catch (e: any) { alert(e?.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{client ? '✏️ Modifier le client' : '👤 Nouveau client'}</div>
        <PhotoPicker value={photo} onChange={setPhoto} name={name} icon="👤" label="📷 Photo du client (facultatif)" />
        <div className="form-group"><label>Nom</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du client" /></div>
        <div className="form-group"><label>📞 Téléphone</label><input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="77 123 45 67" /></div>
        <div className="form-group"><label>✉️ Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="form-group"><label>📍 Adresse</label><input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <div className="form-group"><label>📝 Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="modal-actions"><button className="btn-cancel" onClick={onClose}>Annuler</button><button className="btn-confirm" onClick={save} disabled={saving}>{client ? 'Mettre à jour' : 'Ajouter'}</button></div>
      </div>
    </div>
  )
}
