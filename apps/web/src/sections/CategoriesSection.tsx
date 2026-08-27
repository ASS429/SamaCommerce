import { useState } from 'react'
import { Categories, type Category } from '../lib/api'
import { confirmAsync, toast } from '../lib/toast'
import { SkeletonGrid } from '../components/Skeleton'
import { productIcon } from '../lib/productIcon'
import { toneOf } from '../lib/tone'
import LoadError from '../components/LoadError'
import { describeError } from '../lib/loadError'
import { useProduits, useCategories, useRafraichirCatalogue, CLES, LISTE_VIDE } from '../lib/queries'
import { useQueryClient } from '@tanstack/react-query'

/* Palette d'icônes ORGANISÉE par famille de commerce : on cherche des yeux, pas
   au clavier. L'ordre suit ce qu'on trouve dans une boutique de quartier
   sénégalaise — alimentaire d'abord, puis entretien, puis le reste. */
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: '🍚 Alimentaire', emojis: ['🍚', '🍞', '🍝', '🌾', '🫘', '🧂', '🍬', '🧴', '🍅', '🧅', '🧄', '🌶️', '🥜', '🍯', '🧈', '🧀', '🥚', '🥫'] },
  { label: '🥤 Boissons', emojis: ['💧', '🥤', '🧃', '🥛', '☕', '🍵', '🍶', '🧊'] },
  { label: '🐟 Frais', emojis: ['🐟', '🥩', '🍗', '🥬', '🥕', '🥔', '🍌', '🍊', '🥭', '🍉', '🍎', '🍋'] },
  { label: '🍪 Snacks', emojis: ['🍪', '🍫', '🍦', '🍟', '🍩', '🥐', '🍭'] },
  { label: '🧼 Hygiène & entretien', emojis: ['🧼', '🧻', '🦷', '🍼', '💨', '🧹', '🧽', '💊'] },
  { label: '🏠 Maison & divers', emojis: ['🔥', '🕯️', '🔋', '💡', '📱', '🚬', '📒', '🔧', '🧱', '🛒', '🏷️'] },
  { label: '👕 Mode', emojis: ['👕', '👖', '👗', '👔', '👟', '👠', '👜', '💍', '⌚', '💄', '🎩'] },
]

export default function CategoriesSection() {
  const queryClient = useQueryClient()
  const cats = useCategories()
  const produits = useProduits()   // sert uniquement au comptage par categorie
  const categories = cats.data ?? LISTE_VIDE
  const products = produits.data ?? LISTE_VIDE
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const loading = cats.isPending
  // Seule l'erreur sur les CATEGORIES compte : sans le comptage des produits
  // l'ecran reste utilisable, il affiche juste « 0 produit ».
  const error = describeError(cats.error)

  const load = useRafraichirCatalogue()

  const count = (id: number) => products.filter((p) => p.category_id === id).length
  const toggleNego = async (c: Category) => {
    // Bascule immediate dans le cache partage : le POS lit la meme liste et
    // doit voir tout de suite si l'article devient negociable.
    queryClient.setQueryData<Category[]>(CLES.categories, (list) =>
      (list ?? []).map((x) => x.id === c.id ? { ...x, negociable: !c.negociable } : x))
    try { await Categories.update(c.id, { negociable: !c.negociable }) } catch { toast('Modification non enregistrée', 'error'); load() }
  }
  const remove = async (c: Category) => {
    if (!await confirmAsync(`Supprimer « ${c.name} » ?`)) return
    try { await Categories.remove(c.id); load() } catch (e: any) { alert(e?.response?.data?.error || 'Suppression impossible') }
  }
  const filtered = categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <div className="page-header"><h2>🏷️ Catégories</h2><button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>+ Ajouter</button></div>
      <input className="search-bar" placeholder="🔍 Rechercher une catégorie..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {loading && <SkeletonGrid count={6} />}
      {!loading && error && <LoadError error={error} onRetry={load} />}
      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🏷️</div>
          <div className="empty-text">{categories.length === 0 ? 'Aucune catégorie' : 'Aucun résultat'}</div>
          <div className="empty-sub">{categories.length === 0 ? 'Rangez vos produits par famille : riz, boissons, savons…' : 'Essayez un autre nom'}</div>
        </div>
      )}

      {/* Chaque rayon porte SA couleur, déduite de son nom (lib/tone). Le
          commerçant retrouve « Boissons » au bleu sans lire l'étiquette, et
          la teinte ne change pas quand il en ajoute une autre. */}
      {!loading && (
        <div className="categories-grid">
          {filtered.map((c) => (
            <div key={c.id} className={`cat-card cat-card--tone tile-${toneOf(c.name)}`}>
              <div className="cat-tools">
                <button className="cat-tool" aria-label={`Modifier ${c.name}`} onClick={() => { setEditing(c); setShowModal(true) }}>✏️</button>
                <button className="cat-tool cat-delete" aria-label={`Supprimer ${c.name}`} onClick={() => remove(c)}>🗑️</button>
              </div>
              <span className="cat-emoji">{c.emoji}</span>
              <span className="cat-name">{c.name}</span>
              <span className="cat-badge">📦 {count(c.id)} produit(s)</span>
              <button className="cat-badge" style={{ cursor: 'pointer', border: 'none' }}
                onClick={() => toggleNego(c)} aria-pressed={!!c.negociable}
                title="Autoriser le marchandage pour cette catégorie">
                {c.negociable ? '💬 Négociable' : '🔒 Prix fixe'}
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && <CategoryModal item={editing} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />}
    </>
  )
}

function CategoryModal({ item, onClose, onSaved }: { item: Category | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name ?? '')
  const [emoji, setEmoji] = useState(item?.emoji || '🏷️')
  const [touched, setTouched] = useState(!!item) // l'utilisateur a-t-il choisi l'icône lui-même ?
  const [nego, setNego] = useState(!!item?.negociable)
  const [saving, setSaving] = useState(false)

  /* Suggestion automatique : « Boissons » propose 🥤 avant même que le
     commerçant ouvre la grille. Le même moteur que les produits, donc la
     catégorie et ses articles portent des images cohérentes. */
  const onName = (v: string) => {
    setName(v)
    if (!touched) {
      const suggested = productIcon(v)
      setEmoji(suggested === '📦' ? '🏷️' : suggested)
    }
  }

  const save = async () => {
    if (!name.trim()) return alert('Le nom est requis')
    setSaving(true)
    const payload = { name: name.trim(), emoji, negociable: nego }
    try { if (item) await Categories.update(item.id, payload); else await Categories.create(payload); onSaved() }
    catch (e: any) { alert(e?.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{item ? '✏️ Modifier la catégorie' : '🏷️ Nouvelle catégorie'}</div>

        <div className="cat-preview"><span>{emoji}</span><b>{name || 'Nom de la catégorie'}</b></div>

        <div className="form-group"><label>Nom</label><input value={name} onChange={(e) => onName(e.target.value)} placeholder="Ex. Boissons, Savons, Céréales" autoFocus /></div>

        <div className="form-group"><label>Icône — touchez une image</label></div>
        <div className="emoji-groups">
          {EMOJI_GROUPS.map((g) => (
            <div key={g.label}>
              <div className="emoji-group-label">{g.label}</div>
              <div className="emoji-grid">
                {g.emojis.map((e) => (
                  <button key={e} type="button" className={`emoji-btn ${emoji === e ? 'sel' : ''}`}
                    onClick={() => { setEmoji(e); setTouched(true) }} aria-label={`Icône ${e}`} aria-pressed={emoji === e}>{e}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, margin: '10px 0 12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={nego} onChange={(e) => setNego(e.target.checked)} style={{ width: 18, height: 18 }} />
          💬 Prix négociable (marchandage autorisé)
        </label>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Annuler</button>
          <button className="btn-confirm" onClick={save} disabled={saving}>{item ? 'Mettre à jour' : 'Ajouter'}</button>
        </div>
      </div>
    </div>
  )
}
