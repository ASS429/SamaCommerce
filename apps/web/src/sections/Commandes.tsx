import { useEffect, useState } from 'react'
import { Commandes as Api, Fournisseurs, Products, boutiqueIdentity, fcfa, type Fournisseur, type Product } from '../lib/api'
import { confirmAsync, toast } from '../lib/toast'
import { SkeletonList } from '../components/Skeleton'
import Avatar from '../components/Avatar'
import { productIcon, productTint } from '../lib/productIcon'
import { openWhatsapp, orderMessage } from '../lib/whatsapp'
import LoadError from '../components/LoadError'
import { useLoadError } from '../lib/loadError'

const STATUT: Record<string, { icon: string; label: string; cls: string }> = {
  en_attente: { icon: '⏳', label: 'En attente', cls: 'pill-low' },
  recue: { icon: '✅', label: 'Reçue', cls: 'pill-ok' },
}

export default function Commandes() {
  const [list, setList] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const { error, watch, reset } = useLoadError()
  const [detail, setDetail] = useState<any | null>(null)

  const load = () => { reset(); watch(Api.list().then(setList)).finally(() => setLoading(false)) }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const recevoir = async (c: any) => {
    if (!await confirmAsync('Marquer cette commande comme reçue ? Le stock sera mis à jour.')) return
    const d = await Api.recevoir(c.id); toast(d.message, 'success'); load()
  }
  const remove = async (c: any) => { if (await confirmAsync('Supprimer cette commande ?')) { await Api.remove(c.id); load() } }

  /* Envoi du bon de commande au fournisseur : on recharge le détail pour avoir
     les lignes (la liste n'en donne que le nombre). */
  const envoyer = async (c: any) => {
    try {
      const full = await Api.show(c.id)
      const lignes = (full.items || []).map((it: any) => ({
        label: it.product?.name || `Produit #${it.product_id}`,
        quantite: it.quantity,
        total: Number(it.quantity) * Number(it.prix_unitaire),
      }))
      openWhatsapp(c.fournisseur_phone, orderMessage(boutiqueIdentity(), {
        fournisseur: c.fournisseur_name, reference: c.id, lignes,
        total: Number(c.total), dateSouhaitee: c.expected_date, notes: c.notes,
      }))
    } catch { toast('Impossible de charger la commande', 'error') }
  }

  const voir = async (c: any) => {
    try { setDetail(await Api.show(c.id)) } catch { toast('Impossible de charger la commande', 'error') }
  }

  return (
    <>
      <div className="page-header"><h2>📋 Commandes</h2><button className="btn-primary" onClick={() => setShowModal(true)}>+ Nouvelle</button></div>

      {loading && <SkeletonList count={3} />}
      {!loading && error && <LoadError error={error} onRetry={load} />}
      {!loading && !error && list.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-text">Aucune commande</div>
          <div className="empty-sub">Commandez du réappro à un fournisseur</div>
        </div>
      )}

      {!loading && list.map((c) => {
        const st = STATUT[c.status] || { icon: '•', label: c.status, cls: 'pill-low' }
        return (
          <div key={c.id} className="card fiche">
            <div className="fiche-head">
              <Avatar icon="🚚" name={c.fournisseur_name || 'Commande'} size={48} />
              <div className="fiche-id">
                <div className="fiche-name">{c.fournisseur_name || 'Sans fournisseur'}</div>
                <div className="fiche-sub">📦 {c.items_count} article(s) · 📅 {(c.created_at || '').slice(0, 10)}</div>
                {c.expected_date && <div className="fiche-sub">🗓️ Attendue le {c.expected_date.slice(0, 10)}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="produit-price-main" style={{ color: 'var(--primary)' }}>{fcfa(Number(c.total))}</div>
                <span className={`produit-stock-pill ${st.cls}`}>{st.icon} {st.label}</span>
              </div>
            </div>

            {c.notes && <div className="fiche-note">📝 {c.notes}</div>}

            <div className="fiche-actions">
              <button className="fa-btn fa-go" onClick={() => voir(c)}>👁️ Détail</button>
              {c.fournisseur_phone && <button className="fa-btn fa-wa" onClick={() => envoyer(c)}>💬 Envoyer</button>}
              {c.status !== 'recue' && <button className="fa-btn fa-ok" onClick={() => recevoir(c)}>📥 Reçue (+ stock)</button>}
              <button className="fa-btn fa-del" onClick={() => remove(c)}>🗑️</button>
            </div>
          </div>
        )
      })}

      {detail && <DetailModal commande={detail} onClose={() => setDetail(null)} />}
      {showModal && <CommandeModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />}
    </>
  )
}

function DetailModal({ commande, onClose }: { commande: any; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">📋 Commande n°{commande.id}</div>
        <div className="fiche-sub" style={{ marginBottom: 10 }}>🚚 {commande.fournisseur?.name || 'Sans fournisseur'} · 📅 {(commande.created_at || '').slice(0, 10)}</div>
        {(commande.items || []).map((it: any) => (
          <div key={it.id} className="cmd-line">
            <span className="produit-icon" style={{ width: 34, height: 34, fontSize: 18, borderRadius: 11, background: productTint(it.product?.name) }} aria-hidden="true">
              {productIcon(it.product?.name)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sora" style={{ fontWeight: 700, fontSize: 13.5 }}>{it.product?.name || `Produit #${it.product_id}`}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>× {it.quantity} · {fcfa(Number(it.prix_unitaire))} l'unité</div>
            </div>
            <div className="sora" style={{ fontWeight: 800 }}>{fcfa(Number(it.quantity) * Number(it.prix_unitaire))}</div>
          </div>
        ))}
        <div className="total-bar"><span className="tbl">TOTAL</span><span className="tba">{fcfa(Number(commande.total))}</span></div>
        <button className="btn-cancel" style={{ width: '100%', marginTop: 10 }} onClick={onClose}>Fermer</button>
      </div>
    </div>
  )
}

type Line = { product_id: number; quantity: number; prix_unitaire: number; name: string }

function CommandeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [fid, setFid] = useState('')
  const [notes, setNotes] = useState('')
  const [expected, setExpected] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { Fournisseurs.list().then(setFournisseurs); Products.list().then(setProducts) }, [])

  const addLine = (p: Product) => {
    if (lines.find((l) => l.product_id === p.id)) return
    setLines([...lines, { product_id: p.id, quantity: 1, prix_unitaire: Number(p.price_achat), name: p.name }])
  }
  const total = lines.reduce((s, l) => s + l.quantity * l.prix_unitaire, 0)

  const save = async () => {
    if (lines.length === 0) return alert('Ajoutez au moins un article')
    setSaving(true)
    try {
      await Api.create({
        fournisseur_id: fid ? Number(fid) : null, notes: notes || null, expected_date: expected || null,
        items: lines.map(({ product_id, quantity, prix_unitaire }) => ({ product_id, quantity, prix_unitaire })),
      })
      onSaved()
    } catch (e: any) { alert(e?.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  /* Produits en rupture proposés en premier : c'est ce qu'on commande. */
  const sorted = [...products].sort((a, b) => a.stock - b.stock)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">📋 Nouvelle commande</div>
        <div className="form-group"><label>🚚 Fournisseur</label>
          <select value={fid} onChange={(e) => setFid(e.target.value)}>
            <option value="">Aucun</option>
            {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="form-group"><label>📦 Ajouter un produit (les plus bas en stock d'abord)</label>
          <select value="" onChange={(e) => { const p = products.find((x) => x.id === Number(e.target.value)); if (p) addLine(p) }}>
            <option value="">Choisir un produit…</option>
            {sorted.map((p) => <option key={p.id} value={p.id}>{productIcon(p.name)} {p.name} — stock {p.stock}</option>)}
          </select>
        </div>

        {lines.map((l, i) => (
          <div key={l.product_id} className="cmd-line">
            <span className="produit-icon" style={{ width: 32, height: 32, fontSize: 17, borderRadius: 10, background: productTint(l.name) }} aria-hidden="true">{productIcon(l.name)}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, minWidth: 0 }}>{l.name}</span>
            <input type="number" min={1} value={l.quantity} aria-label="Quantité"
              onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))}
              style={{ width: 56, padding: 6, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', color: 'var(--ink)' }} />
            <input type="number" value={l.prix_unitaire} aria-label="Prix unitaire"
              onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, prix_unitaire: Number(e.target.value) } : x))}
              style={{ width: 72, padding: 6, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', color: 'var(--ink)' }} />
            <button className="prd-btn prd-btn-del" aria-label="Retirer" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}

        <div className="form-group" style={{ marginTop: 8 }}><label>🗓️ Livraison souhaitée</label><input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></div>
        <div className="form-group"><label>📝 Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="total-bar"><span className="tbl">TOTAL</span><span className="tba">{fcfa(total)}</span></div>
        <div className="modal-actions"><button className="btn-cancel" onClick={onClose}>Annuler</button><button className="btn-confirm" onClick={save} disabled={saving}>Créer</button></div>
      </div>
    </div>
  )
}
