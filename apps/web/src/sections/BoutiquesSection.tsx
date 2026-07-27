import { useEffect, useState } from 'react'
import { Boutiques as Api, getUser, type Boutique } from '../lib/api'
import { confirmAsync } from '../lib/toast'

export default function BoutiquesSection() {
  const [list, setList] = useState<Boutique[]>([])
  const [showModal, setShowModal] = useState(false)
  const current = getUser()?.current_boutique_id

  const load = () => Api.list().then(setList)
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
      <div className="page-header"><h2>🏬 Mes Boutiques</h2><button className="btn-primary" onClick={() => setShowModal(true)}>+ Boutique</button></div>

      {list.map((b) => (
        <div key={b.id} className="card" style={{ padding: 14, borderLeft: b.id === current ? '4px solid var(--primary)' : '4px solid transparent' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 30 }}>{b.emoji}</span>
              <div>
                <div className="produit-name">{b.name} {b.is_primary && <span className="cat-badge" style={{ background: '#EDE9FE', color: 'var(--primary)' }}>Principale</span>}</div>
                <div className="produit-desc">{b.nb_produits || 0} produit(s) · {b.nb_ventes || 0} vente(s) · {b.nb_membres || 0} membre(s)</div>
              </div>
            </div>
            {!b.is_primary && <button className="prd-btn prd-btn-del" onClick={() => remove(b)}>🗑️</button>}
          </div>
          {b.id === current
            ? <div className="cat-badge" style={{ background: '#ECFDF5', color: 'var(--green)', marginTop: 10, display: 'inline-block' }}>✓ Boutique active</div>
            : <button className="pay-btn pay-p" style={{ marginTop: 10, padding: 10 }} onClick={() => switchTo(b)}>Activer cette boutique</button>}
        </div>
      ))}

      {showModal && <BoutiqueModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />}
    </>
  )
}

function BoutiqueModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(''); const [emoji, setEmoji] = useState('🏪'); const [phone, setPhone] = useState(''); const [saving, setSaving] = useState(false)
  const EMOJIS = ['🏪', '🏬', '🛒', '🥬', '👕', '💊', '📱', '🍞']
  const save = async () => {
    if (!name.trim()) return alert('Le nom est requis')
    setSaving(true)
    try { await Api.create({ name: name.trim(), emoji, phone: phone || null }); onSaved() }
    catch (e: any) { alert(e?.response?.data?.message || e?.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">🏬 Nouvelle boutique</div>
        <div className="form-group"><label>Nom</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="form-group"><label>Téléphone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div className="form-group"><label>Icône</label></div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {EMOJIS.map((e) => <button key={e} className={`emoji-btn ${emoji === e ? 'sel' : ''}`} style={{ width: 44 }} onClick={() => setEmoji(e)}>{e}</button>)}
        </div>
        <div className="modal-actions"><button className="btn-cancel" onClick={onClose}>Annuler</button><button className="btn-confirm" onClick={save} disabled={saving}>Créer</button></div>
      </div>
    </div>
  )
}
