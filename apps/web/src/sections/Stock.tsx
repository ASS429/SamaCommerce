import { useEffect, useState, lazy, Suspense } from 'react'
import { Categories, Products, fcfa, DISPLAY_UNIT, type Category, type Product } from '../lib/api'
// Design 3.7 — html5-qrcode chargé en lazy (uniquement à l'ouverture du scanner).
const BarcodeScanner = lazy(() => import('../components/BarcodeScanner'))
import { confirmAsync } from '../lib/toast'
import { haptic } from '../lib/haptics'
import { SkeletonList } from '../components/Skeleton'
import { productIcon, productTint } from '../lib/productIcon'

export default function Stock() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [filter, setFilter] = useState<number | 'tous'>('tous')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<string>(() => localStorage.getItem('sc_stock_sort') || 'recent')

  const load = () => { Products.list().then(setProducts).finally(() => setLoading(false)); Categories.list().then(setCategories) }
  useEffect(load, [])
  useEffect(() => { localStorage.setItem('sc_stock_sort', sort) }, [sort])

  const catName = (id: number | null) => categories.find((c) => c.id === id)?.name
  const catEmoji = (id: number | null) => categories.find((c) => c.id === id)?.emoji
  const filtered = products
    .filter((p) => filter === 'tous' || p.category_id === filter)
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode || '').includes(search))
    .sort((a, b) => {
      if (sort === 'nom') return a.name.localeCompare(b.name)
      if (sort === 'stock-asc') return a.stock - b.stock
      if (sort === 'stock-desc') return b.stock - a.stock
      if (sort === 'prix-desc') return b.price - a.price
      return b.id - a.id // récent
    })

  const remove = async (p: Product) => { if (await confirmAsync(`Supprimer « ${p.name} » ?`, 'Supprimer')) { haptic.warn(); await Products.remove(p.id); load() } }
  const adjustStock = async (p: Product, delta: number) => {
    haptic.tap()
    const next = Math.max(0, p.stock + delta)
    setProducts((ps) => ps.map((x) => x.id === p.id ? { ...x, stock: next } : x))
    await Products.update(p.id, { stock: next })
  }

  const stockClass = (s: number) => s <= 0 ? 'stock-critical' : s <= 5 ? 'stock-low' : 'stock-ok'
  const pillClass = (s: number) => s <= 0 ? 'pill-critical' : s <= 5 ? 'pill-low' : 'pill-ok'

  return (
    <>
      <div className="page-header">
        <h2>📦 Mon Stock</h2>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>+ Ajouter</button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input className="search-bar" style={{ flex: 1 }} placeholder="🔍 Rechercher (nom ou code-barres)..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn-primary" style={{ padding: '0 14px' }} onClick={() => setScanning(true)}>📷</button>
      </div>

      <div className="chips">
        <button className={`chip ${filter === 'tous' ? 'active' : ''}`} onClick={() => setFilter('tous')}>Tous</button>
        {categories.map((c) => (
          <button key={c.id} className={`chip ${filter === c.id ? 'active' : ''}`} onClick={() => setFilter(c.id)}>{c.emoji} {c.name}</button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Trier :</label>
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 11, background: 'var(--bg)', color: 'var(--ink)' }} aria-label="Trier les produits">
          <option value="recent">Plus récents</option>
          <option value="nom">Nom (A→Z)</option>
          <option value="stock-asc">Stock (croissant)</option>
          <option value="stock-desc">Stock (décroissant)</option>
          <option value="prix-desc">Prix (décroissant)</option>
        </select>
      </div>

      {loading && <SkeletonList count={5} />}
      {!loading && filtered.length === 0 && <div className="empty-state"><div className="empty-icon">📦</div><div className="empty-text">Aucun produit</div><div className="empty-sub">Ajoutez votre premier produit</div></div>}

      {!loading && filtered.map((p) => {
        const [dl, dfac] = DISPLAY_UNIT[p.unite_base || 'piece'] || DISPLAY_UNIT.piece
        const ds = p.stock / dfac
        const dsStr = Number.isInteger(ds) ? String(ds) : ds.toFixed(2)
        const pesable = (p.unite_base || 'piece') !== 'piece'
        const stockTxt = pesable ? `${dsStr} ${dl}` : dsStr
        return (
        <div key={p.id} className={`produit-card ${stockClass(ds)}`}>
          <div className="produit-card-header">
            <span className="produit-cat-badge">{catName(p.category_id) || 'Sans catégorie'}</span>
            <span className={`produit-stock-pill ${pillClass(ds)}`}>{stockTxt} en stock</span>
          </div>
          <div className="produit-card-body produit-card-body--icon">
            {/* Même pictogramme qu'au point de vente : le produit se reconnaît
                à l'identique dans tout l'outil. */}
            <span className="produit-icon" style={{ background: productTint(p.name) }} aria-hidden="true">
              {productIcon(p.name, catEmoji(p.category_id))}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
            <div className="produit-name">{p.name}{(p.units?.length ?? 0) > 0 && <span className="produit-cat-badge" style={{ marginLeft: 6 }}>+ gros</span>}</div>
            {p.scent && <div className="produit-desc">{p.scent}</div>}
            <div className="produit-prices">
              <span className="produit-price-main">{fcfa(p.price)}{pesable && <span style={{ fontSize: 12, fontWeight: 500 }}> /{dl}</span>}</span>
              <span className="produit-price-achat">achat {fcfa(p.price_achat)}{pesable ? ` /${dl}` : ''}</span>
              {p.prix_min != null && <span className="produit-price-achat" style={{ color: 'var(--warning)' }}>plancher {fcfa(p.prix_min)}</span>}
            </div>
            </div>
          </div>
          <div className="produit-card-actions">
            <div className="stock-controls">
              <button className="stock-btn minus" aria-label="Diminuer" onClick={() => adjustStock(p, -dfac)}>−</button>
              <span className="stock-count">{stockTxt}</span>
              <button className="stock-btn plus" aria-label="Augmenter" onClick={() => adjustStock(p, +dfac)}>+</button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="prd-btn prd-btn-edit" onClick={() => { setEditing(p); setShowModal(true) }}>✏️ Modifier</button>
              <button className="prd-btn prd-btn-del" onClick={() => remove(p)}>🗑️</button>
            </div>
          </div>
        </div>
        )
      })}

      {showModal && <ProductModal product={editing} categories={categories} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />}
      {scanning && <Suspense fallback={null}><BarcodeScanner onScan={(code) => { setSearch(code); setScanning(false) }} onClose={() => setScanning(false)} /></Suspense>}
    </>
  )
}

function ProductModal({ product, categories, onClose, onSaved }: {
  product: Product | null; categories: Category[]; onClose: () => void; onSaved: () => void
}) {
  const initBase = product?.unite_base ?? 'piece'
  const initDf = (DISPLAY_UNIT[initBase] || DISPLAY_UNIT.piece)[1]
  const [name, setName] = useState(product?.name ?? '')
  const [categoryId, setCategoryId] = useState(product?.category_id?.toString() ?? '')
  const [uniteBase, setUniteBase] = useState<string>(initBase)
  const [priceAchat, setPriceAchat] = useState(product?.price_achat?.toString() ?? '')
  const [price, setPrice] = useState(product?.price?.toString() ?? '')
  const [stock, setStock] = useState(product ? String(product.stock / initDf) : '')
  const [prixMin, setPrixMin] = useState(product?.prix_min?.toString() ?? '')
  const [negociable, setNegociable] = useState<string>(product?.negociable === true ? 'oui' : product?.negociable === false ? 'non' : 'herit')
  const [units, setUnits] = useState<{ libelle: string; qte: string; prix: string }[]>(
    product?.units?.map((u) => ({ libelle: u.libelle, qte: String(u.facteur / initDf), prix: String(u.prix) })) ?? [],
  )
  const [scent, setScent] = useState(product?.scent ?? '')
  const [barcode, setBarcode] = useState(product?.barcode ?? '')
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)

  const [dlabel, dfactor] = DISPLAY_UNIT[uniteBase] || DISPLAY_UNIT.piece

  const save = async () => {
    if (!name.trim()) return alert('Le nom est requis')
    setSaving(true)
    const payload = {
      name: name.trim(), category_id: categoryId ? Number(categoryId) : null, barcode: barcode || null,
      price_achat: Number(priceAchat) || 0, price: Number(price) || 0,
      stock: Math.round((Number(stock) || 0) * dfactor),
      unite_base: uniteBase, prix_min: prixMin ? Number(prixMin) : null,
      negociable: negociable === 'oui' ? true : negociable === 'non' ? false : null,
      units: units.filter((u) => u.libelle.trim() && Number(u.qte) > 0).map((u) => ({ libelle: u.libelle.trim(), facteur: Math.round(Number(u.qte) * dfactor), prix: Number(u.prix) || 0 })),
      scent: scent || null,
    }
    try { if (product) await Products.update(product.id, payload as any); else await Products.create(payload as any); onSaved() }
    catch (e: any) { alert(e?.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  const addUnit = () => setUnits((u) => [...u, { libelle: '', qte: '', prix: '' }])
  const setUnit = (i: number, k: string, v: string) => setUnits((u) => u.map((x, j) => j === i ? { ...x, [k]: v } : x))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{product ? '✏️ Modifier le produit' : '📦 Nouveau produit'}</div>
        <div className="form-group"><label>Nom</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du produit" /></div>
        <div className="form-group"><label>Catégorie</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Choisir une catégorie</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}{c.negociable ? ' · négociable' : ''}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Mode de vente</label>
          <select value={uniteBase} onChange={(e) => setUniteBase(e.target.value)}>
            <option value="piece">À la pièce</option>
            <option value="g">Au poids (kg, g…)</option>
            <option value="ml">Au volume (litre, ml…)</option>
          </select>
        </div>
        <div className="form-group"><label>Prix d'achat (FCFA / {dlabel})</label><input type="number" inputMode="numeric" value={priceAchat} onChange={(e) => setPriceAchat(e.target.value)} /></div>
        <div className="form-group"><label>Prix de vente (FCFA / {dlabel})</label><input type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <div className="form-group"><label>Stock (en {dlabel})</label><input type="number" inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} /></div>

        <div className="form-group"><label>Négociation (marchandage)</label>
          <select value={negociable} onChange={(e) => setNegociable(e.target.value)}>
            <option value="herit">Hériter de la catégorie</option>
            <option value="oui">Oui — prix négociable</option>
            <option value="non">Non — prix fixe</option>
          </select>
        </div>
        <div className="form-group"><label>Prix plancher / {dlabel} (employés, optionnel)</label><input type="number" inputMode="numeric" value={prixMin} onChange={(e) => setPrixMin(e.target.value)} placeholder="Vide = pas de plancher" /></div>

        <div className="form-group">
          <label>Conditionnements de gros (optionnel)</label>
          {units.map((u, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input style={{ flex: 2 }} value={u.libelle} onChange={(e) => setUnit(i, 'libelle', e.target.value)} placeholder={`Sac, carton…`} />
              <input style={{ flex: 1 }} type="number" inputMode="decimal" value={u.qte} onChange={(e) => setUnit(i, 'qte', e.target.value)} placeholder={dlabel} title={`Contient combien de ${dlabel}`} />
              <input style={{ flex: 1 }} type="number" inputMode="numeric" value={u.prix} onChange={(e) => setUnit(i, 'prix', e.target.value)} placeholder="Prix" />
              <button type="button" className="prd-btn prd-btn-del" onClick={() => setUnits((arr) => arr.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button type="button" className="badge-soft" onClick={addUnit}>＋ Ajouter un conditionnement</button>
        </div>

        <div className="form-group"><label>Code-barres (optionnel)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ flex: 1 }} value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scanner ou saisir" />
            <button type="button" className="btn-primary" style={{ padding: '0 14px' }} onClick={() => setScanning(true)}>📷</button>
          </div>
        </div>
        <div className="form-group"><label>Description (optionnel)</label><textarea value={scent} onChange={(e) => setScent(e.target.value)} /></div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Annuler</button>
          <button className="btn-confirm" onClick={save} disabled={saving}>{product ? 'Mettre à jour' : 'Ajouter'}</button>
        </div>
      </div>
      {scanning && <Suspense fallback={null}><BarcodeScanner onScan={(code) => { setBarcode(code); setScanning(false) }} onClose={() => setScanning(false)} /></Suspense>}
    </div>
  )
}
