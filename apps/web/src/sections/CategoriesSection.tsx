import { useEffect, useState } from 'react'
import { Categories, Products, type Category, type Product } from '../lib/api'
import { confirmAsync } from '../lib/toast'

const EMOJIS = ['🏷️','👕','👖','👗','👔','👟','👠','🎩','👜','💍','⌚','💄','💅','🧴','🍎','🍌','🍇','🥦','🍞','🥩','🍔','🍕','🍟','🍩','🥤','🍷','📱','💻','🖥️','🎧','🎮','📷','📺','🔋','🛋️','🛏️','🪑','⚽','🏀','🎾','🧸','🎲','🔧','🔨','🧰','🛒','🥫','🧹','🧼','💊']

export default function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

  const load = () => { Categories.list().then(setCategories); Products.list().then(setProducts) }
  useEffect(load, [])

  const count = (id: number) => products.filter((p) => p.category_id === id).length
  const toggleNego = async (c: Category) => { await Categories.update(c.id, { negociable: !c.negociable }); load() }
  const remove = async (c: Category) => {
    if (!await confirmAsync(`Supprimer « ${c.name} » ?`)) return
    try { await Categories.remove(c.id); load() } catch (e: any) { alert(e?.response?.data?.error || 'Suppression impossible') }
  }
  const filtered = categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <div className="page-header"><h2>🏷️ Catégories</h2><button className="btn-primary" onClick={() => setShowModal(true)}>+ Ajouter</button></div>
      <input className="search-bar" placeholder="🔍 Rechercher une catégorie..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {filtered.length === 0 && <div className="empty-state"><div className="empty-icon">🏷️</div><div className="empty-text">Aucune catégorie</div></div>}

      <div className="categories-grid">
        {filtered.map((c) => (
          <div key={c.id} className="cat-card">
            <button className="cat-delete" onClick={() => remove(c)}>🗑️</button>
            <span className="cat-emoji">{c.emoji}</span>
            <span className="cat-name">{c.name}</span>
            <span className="cat-badge">{count(c.id)} produit(s)</span>
            <button className="cat-badge" style={{ cursor: 'pointer', border: 'none', background: c.negociable ? '#ECFDF5' : 'var(--bg)', color: c.negociable ? 'var(--green)' : 'var(--muted)' }} onClick={() => toggleNego(c)} title="Autoriser le marchandage pour cette catégorie">
              {c.negociable ? '💬 Négociable' : 'Prix fixe'}
            </button>
          </div>
        ))}
      </div>

      {showModal && <CategoryModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />}
    </>
  )
}

function CategoryModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(''); const [emoji, setEmoji] = useState('🏷️'); const [nego, setNego] = useState(false); const [saving, setSaving] = useState(false)
  const save = async () => { if (!name.trim()) return alert('Le nom est requis'); setSaving(true); try { await Categories.create({ name: name.trim(), emoji, negociable: nego }); onSaved() } finally { setSaving(false) } }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">🏷️ Nouvelle catégorie</div>
        <div className="form-group"><label>Nom</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la catégorie" /></div>
        <div className="form-group"><label>Icône (sélectionnée : {emoji})</label></div>
        <div className="emoji-grid">
          {EMOJIS.map((e) => <button key={e} className={`emoji-btn ${emoji === e ? 'sel' : ''}`} onClick={() => setEmoji(e)}>{e}</button>)}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, margin: '4px 0 12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={nego} onChange={(e) => setNego(e.target.checked)} style={{ width: 18, height: 18 }} />
          💬 Prix négociable (marchandage autorisé)
        </label>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Annuler</button>
          <button className="btn-confirm" onClick={save} disabled={saving}>Ajouter</button>
        </div>
      </div>
    </div>
  )
}
