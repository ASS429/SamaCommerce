import { useEffect, useState } from 'react'
import { Boutiques as Api, getUser, type Boutique } from '../lib/api'
import { confirmAsync } from '../lib/toast'
import { SkeletonList } from '../components/Skeleton'
import Avatar from '../components/Avatar'
import PhotoPicker from '../components/PhotoPicker'
import { telLink } from '../lib/whatsapp'
import LoadError from '../components/LoadError'
import { useLoadError } from '../lib/loadError'

/* Enseignes proposées : on couvre les commerces les plus fréquents au Sénégal
   (boutique de quartier, alimentation générale, pharmacie, quincaillerie…).
   Le commerçant choisit une IMAGE, pas un mot. */
const EMOJIS = ['🏪', '🏬', '🛒', '🥬', '🍞', '🥩', '🐟', '🍲', '👕', '👟', '💊', '📱', '💇', '🔧', '🧱', '⛽', '📚', '🧴']

export default function BoutiquesSection() {
  const [list, setList] = useState<Boutique[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Boutique | null>(null)
  const [loading, setLoading] = useState(true)
  const { error, watch, reset } = useLoadError()
  const current = getUser()?.current_boutique_id

  const load = () => { reset(); watch(Api.list().then(setList)).finally(() => setLoading(false)) }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
      {!loading && error && <LoadError error={error} onRetry={load} />}
      {!loading && !error && list.length === 0 && (
        <div className="empty-state"><div className="empty-icon">🏬</div><div className="empty-text">Aucune boutique</div><div className="empty-sub">Créez votre première boutique</div></div>
      )}

      {/* La boutique ACTIVE est un panneau violet, les autres restent des
          fiches blanches : on voit sur quel point de vente on travaille avant
          d'avoir lu un mot. Se tromper de boutique fausse toute la journée. */}
      {!loading && list.map((b) => {
        const active = b.id === current
        const tel = telLink(b.phone)
        if (active) {
          return (
            <div key={b.id} className="hero-panel">
              <div className="hero-top">
                <Avatar photo={b.photo} icon={b.photo ? undefined : (b.emoji || '🏪')} name={b.name} size={50} radius={15} tint="rgba(255,255,255,.2)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="hero-label">✅ Boutique active{b.is_primary ? ' · principale' : ''}</div>
                  <div className="hero-value" style={{ fontSize: 21 }}>{b.name}</div>
                  {b.address && <div className="hero-sub">📍 {b.address}</div>}
                </div>
                <div className="hero-top-actions">
                  <button className="hero-btn" aria-label={`Modifier ${b.name}`} onClick={() => { setEditing(b); setShowModal(true) }}>✏️</button>
                </div>
              </div>
              <div className="hero-stats">
                <div className="hero-stat"><b>{b.nb_produits || 0}</b><span>📦 produits</span></div>
                <div className="hero-stat"><b>{b.nb_ventes || 0}</b><span>🛒 ventes</span></div>
                <div className="hero-stat"><b>{b.nb_membres || 0}</b><span>👥 membres</span></div>
              </div>
              {tel && <a className="hero-cta" href={tel} style={{ textAlign: 'center', textDecoration: 'none' }}>📞 {b.phone}</a>}
            </div>
          )
        }
        return (
          <div key={b.id} className="card fiche">
            <div className="fiche-head">
              <Avatar photo={b.photo} icon={b.photo ? undefined : (b.emoji || '🏪')} name={b.name} size={54} />
              <div className="fiche-id">
                <div className="fiche-name">
                  {b.name} {b.is_primary && <span className="cat-badge">⭐ Principale</span>}
                </div>
                {b.phone && <div className="fiche-sub">📞 {b.phone}</div>}
                {b.address && <div className="fiche-sub">📍 {b.address}</div>}
              </div>
              <div className="fiche-tools">
                <button className="prd-btn prd-btn-edit" aria-label={`Modifier ${b.name}`} onClick={() => { setEditing(b); setShowModal(true) }}>✏️</button>
                {!b.is_primary && <button className="prd-btn prd-btn-del" aria-label={`Supprimer ${b.name}`} onClick={() => remove(b)}>🗑️</button>}
              </div>
            </div>

            <div className="fiche-stats">
              <span className="fst fst-b"><b>{b.nb_produits || 0}</b><span>📦 produits</span></span>
              <span className="fst fst-g"><b>{b.nb_ventes || 0}</b><span>🛒 ventes</span></span>
              <span className="fst fst-p"><b>{b.nb_membres || 0}</b><span>👥 membres</span></span>
            </div>

            <div className="fiche-actions">
              {tel && <a className="fa-btn fa-call" href={tel}>📞 Appeler</a>}
              <button className="fa-btn fa-go" onClick={() => switchTo(b)}>🔄 Activer cette boutique</button>
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
