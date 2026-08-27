import { useEffect, useState } from 'react'
import { Fournisseurs as Api, Commandes, fcfa, type Fournisseur } from '../lib/api'
import { confirmAsync, toast } from '../lib/toast'
import { SkeletonList } from '../components/Skeleton'
import Avatar from '../components/Avatar'
import PhotoPicker from '../components/PhotoPicker'
import { telLink } from '../lib/whatsapp'
import LoadError from '../components/LoadError'
import { useLoadError } from '../lib/loadError'

export default function Fournisseurs() {
  const [list, setList] = useState<Fournisseur[]>([])
  const [commandes, setCommandes] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Fournisseur | null>(null)
  const [loading, setLoading] = useState(true)
  const { error, watch, reset } = useLoadError()
  const [preview, setPreview] = useState<{ f: Fournisseur; message: string; url: string } | null>(null)

  const load = () => {
    reset()
    watch(Api.list().then(setList)).finally(() => setLoading(false))
    Commandes.list().then(setCommandes).catch(() => {}) // secondaire : ne bloque pas la liste
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (f: Fournisseur) => { if (await confirmAsync(`Supprimer « ${f.name} » ?`)) { await Api.remove(f.id); load() } }

  /* La relance part APRÈS relecture : le commerçant voit le message tel qu'il
     sera envoyé (et peut annuler s'il s'est trompé de fournisseur). */
  const relance = async (f: Fournisseur) => {
    try {
      const d = await Api.reappro(f.id)
      setPreview({ f, message: d.message, url: d.whatsapp_url })
    } catch { toast('Impossible de préparer la relance', 'error') }
  }

  const stats = (f: Fournisseur) => {
    const mine = commandes.filter((c) => c.fournisseur_id === f.id)
    return { nb: mine.length, total: mine.reduce((s, c) => s + Number(c.total || 0), 0) }
  }

  const filtered = list.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()) || (f.phone || '').includes(search))

  return (
    <>
      <div className="page-header"><h2>🚚 Fournisseurs</h2><button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>+ Ajouter</button></div>
      <input className="search-bar" placeholder="🔍 Rechercher un fournisseur..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {loading && <SkeletonList count={3} />}
      {!loading && error && <LoadError error={error} onRetry={load} />}
      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🚚</div>
          <div className="empty-text">{list.length === 0 ? 'Aucun fournisseur' : 'Aucun résultat'}</div>
          <div className="empty-sub">{list.length === 0 ? 'Ajoutez celui qui vous livre le plus souvent' : 'Essayez un autre nom'}</div>
        </div>
      )}

      {!loading && filtered.map((f) => {
        const s = stats(f)
        const tel = telLink(f.phone)
        return (
          <div key={f.id} className="card fiche">
            <div className="fiche-head">
              <Avatar photo={f.photo} icon={f.photo ? undefined : '🚚'} name={f.name} size={52} />
              <div className="fiche-id">
                <div className="fiche-name">{f.name}</div>
                {f.phone && <div className="fiche-sub">📞 {f.phone}</div>}
                {f.address && <div className="fiche-sub">📍 {f.address}</div>}
              </div>
              <div className="fiche-tools">
                <button className="prd-btn prd-btn-edit" aria-label="Modifier" onClick={() => { setEditing(f); setShowModal(true) }}>✏️</button>
                <button className="prd-btn prd-btn-del" aria-label="Supprimer" onClick={() => remove(f)}>🗑️</button>
              </div>
            </div>

            <div className="fiche-stats">
              <span className="fst fst-b"><b>{s.nb}</b><span>📋 commandes</span></span>
              <span className="fst fst-p"><b>{fcfa(s.total)}</b><span>💰 total achats</span></span>
            </div>

            {f.phone && (
              <div className="fiche-actions">
                {tel && <a className="fa-btn fa-call" href={tel}>📞 Appeler</a>}
                <button className="fa-btn fa-wa" onClick={() => relance(f)}>📲 Relance réappro</button>
              </div>
            )}
            {f.notes && <div className="fiche-note">📝 {f.notes}</div>}
          </div>
        )
      })}

      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">📲 Relance à {preview.f.name}</div>
            <div className="wa-preview">{preview.message}</div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setPreview(null)}>Annuler</button>
              <button className="btn-confirm" onClick={() => { window.open(preview.url, '_blank', 'noopener'); setPreview(null) }}>💬 Envoyer</button>
            </div>
          </div>
        </div>
      )}

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
  const [photo, setPhoto] = useState<string | null>(item?.photo ?? null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) return alert('Le nom est requis')
    setSaving(true)
    const payload = { name: name.trim(), phone: phone || null, email: email || null, address: address || null, notes: notes || null, photo }
    try { if (item) await Api.update(item.id, payload); else await Api.create(payload); onSaved() }
    catch (e: any) { alert(e?.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{item ? '✏️ Modifier le fournisseur' : '🚚 Nouveau fournisseur'}</div>
        <PhotoPicker value={photo} onChange={setPhoto} name={name} icon="🚚" label="📷 Photo / logo (facultatif)" />
        <div className="form-group"><label>Nom</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du fournisseur" /></div>
        <div className="form-group"><label>📞 Téléphone (WhatsApp)</label><input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="77 123 45 67" /></div>
        <div className="form-group"><label>✉️ Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="form-group"><label>📍 Adresse</label><input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <div className="form-group"><label>📝 Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Jours de livraison, conditions de paiement…" /></div>
        <div className="modal-actions"><button className="btn-cancel" onClick={onClose}>Annuler</button><button className="btn-confirm" onClick={save} disabled={saving}>{item ? 'Mettre à jour' : 'Ajouter'}</button></div>
      </div>
    </div>
  )
}
