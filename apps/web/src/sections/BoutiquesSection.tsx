import { useEffect, useState } from 'react'
import { Boutiques as Api, getUser, type Boutique } from '../lib/api'
import { confirmAsync } from '../lib/toast'
import { SkeletonList } from '../components/Skeleton'
import Avatar from '../components/Avatar'
import PhotoPicker from '../components/PhotoPicker'
import { telLink } from '../lib/whatsapp'

/* Enseignes proposées : on couvre les commerces les plus fréquents au Sénégal
   (boutique de quartier, alimentation générale, pharmacie, quincaillerie…).
   Le commerçant choisit une IMAGE, pas un mot. */
const EMOJIS = ['🏪', '🏬', '🛒', '🥬', '🍞', '🥩', '🐟', '🍲', '👕', '👟', '💊', '📱', '💇', '🔧', '🧱', '⛽', '📚', '🧴']

export default function BoutiquesSection() {
  const [list, setList] = useState<Boutique[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Boutique | null>(null)
  const [loading, setLoading] = useState(true)
  const current = getUser()?.current_boutique_id

  const load = () => Api.list().then(setList).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const switchTo = async (b: Boutique) => {
    await Api.switch(b.id)
    // Met à jour l'utilisateur stocké puis recharge pour appliquer le contexte
    const u = getUser()
    if (u) localStorage.setItem('samacommerce_user', JSON.stringify({ ...u, current_boutique_id: b.id }))
    window.location.reload()
  }
  const remove = async (b: Boutique) => {
    if (b.is_primary) return alert('Impossible de supprimer la boutique principale')
    if (await confirmAsync(`Supprimer « ${b.name} » ?`)) { await Api.remove(b.id); load() }
  }

  return (
    <>
      <div className="page-header"><h2>🏬 Mes Boutiques</h2><button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>+ Boutique</button></div>

      {loading && <SkeletonList count={2} />}
      {!loading && list.length === 0 && (
        <div className="empty-state"><div className="empty-icon">🏬</div><div className="empty-text">Aucune boutique</div><div className="empty-sub">Créez votre première boutique</div></div>
      )}

      {!loading && list.map((b) => {
        const active = b.id === current
        const tel = telLink(b.phone)
        return (
          <div key={b.id} className={`card fiche ${active ? 'fiche-active' : ''}`}>
            <div className="fiche-head">
              <Avatar photo={b.photo} icon={b.photo ? undefined : (b.emoji || '🏪')} name={b.name} size={54} />
              <div className="fiche-id">
                <div className="fiche-name">
                  {b.name} {b.is_primary && <span className="cat-badge" style={{ background: '#EDE9FE', color: 'var(--primary)' }}>⭐ Principale</span>}
                </div>
                {b.phone && <div className="fiche-sub">📞 {b.phone}</div>}
                {b.address && <div className="fiche-sub">📍 {b.address}</div>}
              </div>
              <div className="fiche-tools">
                <button className="prd-btn prd-btn-edit" aria-label="Modifier" onClick={() => { setEditing(b); setShowModal(true) }}>✏️</button>
                {!b.is_primary && <button className="prd-btn prd-btn-del" aria-label="Supprimer" onClick={() => remove(b)}>🗑️</button>}
              </div>
            </div>

            <div className="fiche-stats">
              <span className="fst fst-b"><b>{b.nb_produits || 0}</b><span>📦 produits</span></span>
              <span className="fst fst-g"><b>{b.nb_ventes || 0}</b><span>🛒 ventes</span></span>
              <span className="fst fst-p"><b>{b.nb_membres || 0}</b><span>👥 membres</span></span>
            </div>

            <div className="fiche-actions">
              {tel && <a className="fa-btn fa-call" href={tel}>📞 Appeler</a>}
              {active
                ? <span className="fa-btn fa-on">✅ Boutique active</span>
                : <button className="fa-btn fa-go" onClick={() => switchTo(b)}>🔄 Activer cette boutique</button>}
            </div>
          </div>
        )
      })}

      {showModal && <BoutiqueModal item={editing} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />}
    </>
  )
}

function BoutiqueModal({ item, onClose, onSaved }: { item: Boutique | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name ?? '')
  const [emoji, setEmoji] = useState(item?.emoji || '🏪')
  const [phone, setPhone] = useState(item?.phone ?? '')
  const [address, setAddress] = useState(item?.address ?? '')
  const [photo, setPhoto] = useState<string | null>(item?.photo ?? null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) return alert('Le nom est requis')
    setSaving(true)
    const payload = { name: name.trim(), emoji, phone: phone || null, address: address || null, photo }
    try { if (item) await Api.update(item.id, payload); else await Api.create(payload); onSaved() }
    catch (e: any) { alert(e?.response?.data?.message || e?.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{item ? '✏️ Modifier la boutique' : '🏬 Nouvelle boutique'}</div>
        <PhotoPicker value={photo} onChange={setPhoto} name={name} icon={emoji} label="📷 Photo de la devanture (facultatif)" />
        <div className="form-group"><label>Nom</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Boutique Ndiaye" /></div>
        <div className="form-group"><label>📞 Téléphone</label><input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="77 123 45 67" /></div>
        <div className="form-group"><label>📍 Adresse</label><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Quartier, rue…" /></div>
        <div className="form-group"><label>Enseigne (sélectionnée : {emoji})</label></div>
        <div className="emoji-grid">
          {EMOJIS.map((e) => <button key={e} type="button" className={`emoji-btn ${emoji === e ? 'sel' : ''}`} onClick={() => setEmoji(e)}>{e}</button>)}
        </div>
        <div className="modal-actions"><button className="btn-cancel" onClick={onClose}>Annuler</button><button className="btn-confirm" onClick={save} disabled={saving}>{item ? 'Mettre à jour' : 'Créer'}</button></div>
      </div>
    </div>
  )
}
