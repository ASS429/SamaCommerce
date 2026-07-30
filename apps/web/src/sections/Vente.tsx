import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { Categories, Clients, Products, Sales, Ia, boutiqueIdentity, fcfa, getUser, displayInfo, type Category, type CreditScore, type Product } from '../lib/api'
import { autoPrintEnabled } from '../lib/modules'
import ScoreRing from '../components/ScoreRing'
// Le scanner (html5-qrcode, ~370 Ko) n'est chargé qu'à l'ouverture de la caméra.
const BarcodeScanner = lazy(() => import('../components/BarcodeScanner'))

/** Client rattaché à la vente : fiche existante, nouveau nom, ou personne. */
type SaleClient = { id: number | null; name: string; phone: string | null }
import { promptAsync, toast } from '../lib/toast'
import { haptic } from '../lib/haptics'
import { SkeletonGrid } from '../components/Skeleton'
import ReceiptModal from '../components/ReceiptModal'
import { confetti } from '../lib/celebrate'
import { enqueueSale, uuid, type PendingSale } from '../lib/offlineQueue'
import { productIcon, productTint } from '../lib/productIcon'
import { flyToCart } from '../lib/flyToCart'
import Avatar from '../components/Avatar'
import { openWhatsapp, receiptMessage } from '../lib/whatsapp'
import {
  type CartLine, lFactor, lCount, lTotal, lRefTotal, lCogs, lLabel, lPerDisplay, qtyStr, cartTotal,
} from '../lib/cart'

export default function Vente() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCat, setActiveCat] = useState<number | 'tous'>('tous')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [showPay, setShowPay] = useState(false)
  const [showCredit, setShowCredit] = useState(false)
  const [lastSale, setLastSale] = useState<CartLine[] | null>(null)
  const [lastMethod, setLastMethod] = useState<string | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<SaleClient | null>(null)
  const [showClient, setShowClient] = useState(false)
  const [clients, setClients] = useState<{ id: number; name: string; phone: string | null }[]>([])
  const [scanning, setScanning] = useState(false)

  const load = () => { Products.list().then(setProducts).finally(() => setLoading(false)); Categories.list().then(setCategories) }
  useEffect(load, [])
  // Fichier clients allégé : sert à rattacher la vente à un habitué.
  useEffect(() => { Clients.forSale().then(setClients).catch(() => {}) }, [])

  /* Scan au comptoir : le code-barres identifie le produit à coup sûr, même
     quand deux articles se ressemblent. S'il est inconnu, on retombe sur la
     recherche textuelle plutôt que de ne rien faire. */
  const onScan = (code: string) => {
    setScanning(false)
    const found = products.find((p) => (p.barcode || '') === code)
    if (found) { addToCart(found); toast(`${found.name} ajouté 🛒`, 'success') }
    else { setSearch(code); toast('Code inconnu — produit non trouvé', 'error') }
  }

  const isEmp = !!getUser()?.is_employee
  const negoOf = (p: Product) => p.negociable ?? categories.find((c) => c.id === p.category_id)?.negociable ?? false
  /** Emoji de la catégorie : sert de repli quand le nom n'est pas reconnu. */
  const catEmoji = (p: Product) => categories.find((c) => c.id === p.category_id)?.emoji

  const visible = (activeCat === 'tous' ? products : products.filter((p) => p.category_id === activeCat))
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode || '').includes(search))
  const total = useMemo(() => cartTotal(cart), [cart])

  const addToCart = (p: Product, e?: React.MouseEvent) => {
    if (p.stock <= 0) return alert('Stock épuisé')
    haptic.tap()
    flyToCart((e?.currentTarget as HTMLElement) ?? null, '.card-title') // 3.4 — ajout balistique
    setCart((c) => {
      const f = c.find((l) => l.product.id === p.id && l.unit === null)
      if (f) return c.map((l) => l === f ? { ...l, qtyBase: l.qtyBase + displayInfo(p)[1] } : l)
      return [...c, { product: p, unit: null, qtyBase: displayInfo(p)[1], prixReel: Math.round(Number(p.price)) }]
    })
  }
  const patchLine = (idx: number, patch: Partial<CartLine>) => setCart((c) => c.map((l, i) => i === idx ? { ...l, ...patch } : l))
  const removeLine = (idx: number) => setCart((c) => c.filter((_, i) => i !== idx))

  /** Champs client envoyés avec chaque ligne de vente. */
  const clientPayload = (credit?: any) => ({
    client_id: credit?.client_id ?? client?.id ?? null,
    client_name: credit?.client_name ?? client?.name ?? null,
    client_phone: credit?.client_phone ?? client?.phone ?? null,
  })

  // T11 — enregistre le panier dans la file hors-ligne (IndexedDB).
  const queueOffline = async (method: string, credit?: any) => {
    for (const line of cart) {
      const sale: PendingSale = {
        client_uuid: uuid(),
        product_id: line.product.id,
        unit_id: line.unit?.id ?? null,
        quantite_base: line.qtyBase,
        prix_reel: line.prixReel,
        payment_method: method,
        ...clientPayload(credit),
        created_at: new Date().toISOString(),
        label: `${line.product.name} ${qtyStr(line)} — ${fcfa(lTotal(line))}`,
        ...(credit ?? {}),
      }
      await enqueueSale(sale)
    }
    haptic.success()
    setLastSale(cart); setLastMethod(method); setCart([]); setShowPay(false); setShowCredit(false)
    toast('📴 Vente enregistrée hors-ligne — sera synchronisée au retour du réseau', 'info')
  }

  const finaliser = async (method: string, credit?: any) => {
    // Hors-ligne d'emblée → file d'attente locale (aucune vente perdue).
    if (!navigator.onLine) return queueOffline(method, credit)
    try {
      for (const line of cart) {
        await Sales.create({ product_id: line.product.id, unit_id: line.unit?.id ?? null, quantite_base: line.qtyBase, prix_reel: line.prixReel, payment_method: method, ...clientPayload(credit), due_date: credit?.due_date ?? null } as any)
      }
      haptic.success()
      confetti() // Design 3.4 — célébration d'encaissement
      setLastSale(cart); setLastMethod(method); setCart([]); setShowPay(false); setShowCredit(false); load()
      /* Impression automatique (option) : le reçu s'ouvre et part à
         l'imprimante sans un geste de plus — utile aux boutiques équipées,
         invisible pour les autres. */
      if (autoPrintEnabled()) {
        setShowReceipt(true)
        setTimeout(() => window.print(), 350)
      }
    } catch (e: any) {
      // Erreur RÉSEAU (pas de réponse serveur) → on bascule en file hors-ligne.
      if (!e?.response) return queueOffline(method, credit)
      setShowPay(false); setShowCredit(false)
      toast(e?.response?.data?.error || 'Erreur lors de la vente', 'error')
    }
  }

  /* Reçu WhatsApp : gabarit commun (lib/whatsapp.ts) — en-tête boutique avec
     son numéro, lignes pictogrammées, total en gras, moyen de paiement. Le
     numéro du client est normalisé au format international, sinon WhatsApp
     répond « numéro invalide » et le commerçant croit l'appli cassée. */
  const whatsappReceipt = async () => {
    if (!lastSale) return
    const phone = await promptAsync('Numéro WhatsApp du client (ex: 77 123 45 67) :', '')
    if (!phone) return
    openWhatsapp(phone, receiptMessage(boutiqueIdentity(), {
      lignes: lastSale.map((l) => ({ label: `${l.product.name} ${qtyStr(l)}`, total: lTotal(l) })),
      total: lastSale.reduce((s, l) => s + lTotal(l), 0),
      paiement: lastMethod,
    }))
  }

  return (
    <>
      <div className="page-header"><h2>💳 Vendre</h2></div>

      <div className="vente-layout">
        <div className="vente-col-main">
          <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Choisir produits
            <button className="badge-soft" style={{ background: 'var(--brand-tint)', color: 'var(--brand-dark)' }} onClick={() => setShowAdd(true)}>＋ Produit</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="search-bar" style={{ flex: 1 }} placeholder="🔍 Chercher un produit" value={search} onChange={(e) => setSearch(e.target.value)} />
            {/* Scanner : ajoute directement l'article au panier. */}
            <button className="btn-primary" style={{ padding: '0 14px' }} aria-label="Scanner un code-barres" onClick={() => setScanning(true)}>📷</button>
          </div>
          <div className="chips">
            <button className={`chip ${activeCat === 'tous' ? 'active' : ''}`} onClick={() => setActiveCat('tous')}>Tous</button>
            {categories.map((c) => <button key={c.id} className={`chip ${activeCat === c.id ? 'active' : ''}`} onClick={() => setActiveCat(c.id)}>{c.emoji} {c.name}</button>)}
          </div>
          {loading
            ? <SkeletonGrid count={6} />
            : visible.length === 0
              ? <div className="empty-state"><div className="empty-icon">🔍</div><div className="empty-sub">Aucun produit trouvé</div></div>
              : (
                <div className="vente-grid">
                  {visible.map((p) => {
                    const [dl, df] = displayInfo(p)
                    const pesable = (p.unite_base || 'piece') !== 'piece'
                    const ds = p.stock / df
                    return (
                    <button key={p.id} className="vente-card" disabled={p.stock <= 0} onClick={(e) => addToCart(p, e)}
                      title={`${p.name} — ${fcfa(p.price)}`}>
                      {/* Le pictogramme domine : on reconnaît la marchandise sans lire. */}
                      <Avatar photo={p.photo} icon={productIcon(p.name, catEmoji(p))} name={p.name}
                        size={62} radius={18} tint={productTint(p.name)} className="v-icon-av" />
                      <span className="v-body">
                        <span className="vn">{p.name}</span>
                        <span className="vp">{fcfa(p.price)}{pesable && <small> /{dl}</small>}</span>
                      </span>
                      {/* Pastille de stock : la COULEUR porte l'information, le
                          nombre la précise. Rouge = il n'y en a presque plus. */}
                      <span className={`v-stock ${ds <= 0 ? 'is-out' : ds <= 5 ? 'is-low' : 'is-ok'}`}>
                        {p.stock <= 0 ? '✕' : Number.isInteger(ds) ? ds : ds.toFixed(1)}
                      </span>
                      {negoOf(p) && <span className="v-tag" title="Prix négociable">💬</span>}
                    </button>
                    )
                  })}
                </div>
              )}
        </div>

        <div className="vente-col-side">
          {/* Client de la vente : facultatif au comptant, il donne l'historique
              d'achat et rend le score de crédit fiable. */}
          <button className={`client-chip ${client ? 'on' : ''}`} onClick={() => setShowClient(true)}>
            <span className="client-chip-icon">{client ? '👤' : '🙋'}</span>
            <span className="client-chip-body">
              <b>{client ? client.name : 'Client de passage'}</b>
              <small>{client ? (client.phone || 'Touchez pour changer') : 'Touchez pour choisir un client'}</small>
            </span>
            <span className="client-chip-go">›</span>
          </button>

          <div className="card" style={{ marginTop: 0 }}>
            <div className="card-title">🛒 Panier {cart.length > 0 && <span className="produit-cat-badge" style={{ marginLeft: 'auto' }}>{cart.length}</span>}</div>
            {cart.length === 0
              ? <div className="empty-state" style={{ padding: '16px' }}><div className="empty-icon">🛒</div><div className="empty-sub">Votre panier est vide</div></div>
              : cart.map((l, idx) => (
                <CartLineRow key={idx} line={l} negociable={negoOf(l.product)} isEmp={isEmp} onPatch={(patch) => patchLine(idx, patch)} onRemove={() => removeLine(idx)} />
              ))}
          </div>

          {lastSale && (
            <button className="btn-confirm" style={{ width: '100%', marginBottom: 10 }} onClick={() => setShowReceipt(true)}>🧾 Voir le reçu</button>
          )}

          <div className="vente-sticky">
            <div className="total-bar"><span className="tbl">TOTAL</span><span className="tba">{fcfa(total)}</span></div>
            <button className="btn-encaisser" disabled={cart.length === 0} style={{ opacity: cart.length === 0 ? 0.5 : 1 }} onClick={() => setShowPay(true)}>💰 ENCAISSER</button>
          </div>
        </div>
      </div>

      {showAdd && <QuickProductModal categories={categories} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load() }} />}
      {showReceipt && lastSale && <ReceiptModal items={lastSale.map((l) => ({ name: `${l.product.name} ${qtyStr(l)}`, qty: 1, price: lTotal(l) }))} onClose={() => setShowReceipt(false)} onWhatsapp={whatsappReceipt} />}
      {showPay && <PayModal total={total} onClose={() => setShowPay(false)} onPay={(m) => finaliser(m)} onCredit={() => { setShowPay(false); setShowCredit(true) }} />}
      {showCredit && (
        <CreditModal
          total={total}
          client={client}
          clients={clients}
          onPickClient={() => { setShowCredit(false); setShowClient(true) }}
          onClose={() => setShowCredit(false)}
          onConfirm={(i) => finaliser('credit', i)}
        />
      )}
      {showClient && (
        <ClientPicker
          clients={clients}
          current={client}
          onClose={() => setShowClient(false)}
          onPick={(c) => { setClient(c); setShowClient(false) }}
        />
      )}
      {scanning && <Suspense fallback={null}><BarcodeScanner onScan={onScan} onClose={() => setScanning(false)} /></Suspense>}
    </>
  )
}

function CartLineRow({ line, negociable, isEmp, onPatch, onRemove }: {
  line: CartLine; negociable: boolean; isEmp: boolean; onPatch: (p: Partial<CartLine>) => void; onRemove: () => void
}) {
  const [mode, setMode] = useState<'unitaire' | 'total'>('unitaire')
  const p = line.product
  const [dl, df] = displayInfo(p)
  const factor = lFactor(line)
  const weighable = !line.unit && (p.unite_base || 'piece') !== 'piece'
  const total = lTotal(line)
  const marge = total - lCogs(line)
  const remise = lRefTotal(line) - total
  const sousPlancher = p.prix_min != null && lPerDisplay(line) < p.prix_min
  const aPerte = marge < 0

  const setUnit = (val: string) => {
    const u = val ? (p.units || []).find((x) => String(x.id) === val) || null : null
    onPatch({ unit: u, qtyBase: u ? u.facteur : df, prixReel: u ? u.prix : Math.round(Number(p.price)) })
  }
  const setCount = (n: number) => { if (n <= 0) return onRemove(); onPatch({ qtyBase: n * factor }) }
  const setWeight = (v: string) => onPatch({ qtyBase: Math.round(Math.max(0, Number(v) || 0) * df) })
  const setPrice = (v: string) => {
    const n = Math.max(0, Number(v) || 0)
    if (mode === 'unitaire') onPatch({ prixReel: Math.round(n) })
    else onPatch({ prixReel: line.qtyBase > 0 ? Math.round(n * factor / line.qtyBase) : line.prixReel })
  }

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Le pictogramme suit le produit jusque dans le panier. */}
        <Avatar photo={p.photo} icon={productIcon(p.name)} name={p.name} size={34} radius={11} tint={productTint(p.name)} />
        <div className="sora" style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{p.name}</div>
        <div className="sora" style={{ fontWeight: 800, color: 'var(--green-dark)' }}>{fcfa(total)}</div>
        <button className="prd-btn prd-btn-del" style={{ padding: '4px 8px' }} aria-label="Retirer" onClick={onRemove}>✕</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        {(p.units?.length ?? 0) > 0 && (
          <select value={line.unit ? String(line.unit.id) : ''} onChange={(e) => setUnit(e.target.value)} style={{ padding: '6px 8px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12.5 }}>
            <option value="">Détail ({dl})</option>
            {(p.units || []).map((u) => <option key={u.id} value={u.id}>{u.libelle}</option>)}
          </select>
        )}
        {weighable ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" inputMode="decimal" step="0.05" value={lCount(line)} onChange={(e) => setWeight(e.target.value)} style={{ width: 84, padding: '6px 8px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }} />
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{dl}</span>
          </div>
        ) : (
          <div className="stock-controls">
            <button className="stock-btn minus" aria-label="Diminuer" onClick={() => setCount(lCount(line) - 1)}>−</button>
            <span className="stock-count">{lCount(line)}</span>
            <button className="stock-btn plus" aria-label="Augmenter" onClick={() => setCount(lCount(line) + 1)}>+</button>
          </div>
        )}
      </div>

      {negociable && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <button className="badge-soft" style={{ fontSize: 11, padding: '5px 8px' }} onClick={() => setMode(mode === 'unitaire' ? 'total' : 'unitaire')}>{mode === 'unitaire' ? `Prix / ${lLabel(line)}` : 'Prix total'}</button>
          <input type="number" inputMode="numeric" value={mode === 'unitaire' ? line.prixReel : total} onChange={(e) => setPrice(e.target.value)} style={{ width: 92, padding: '6px 8px', borderRadius: 9, border: `1px solid ${sousPlancher || aPerte ? 'var(--danger)' : 'var(--line)'}`, background: 'var(--bg)', color: 'var(--ink)' }} />
          {remise > 0 && <span style={{ fontSize: 11.5, color: 'var(--accent)' }}>remise {fcfa(remise)}</span>}
        </div>
      )}

      {/* Design 3.3 — « la marge qui respire » : verte et calme si saine, ambre
          qui pulse quand elle fond, rouge qui tremble sous le plancher. */}
      {(() => {
        const ratio = total > 0 ? marge / total : 0
        const level = sousPlancher || aPerte ? 'danger' : ratio < 0.12 ? 'warn' : 'ok'
        return (
          <div className={`marge-gauge marge-${level}`}>
            <div className="marge-track"><div className="marge-fill" style={{ width: `${Math.max(4, Math.min(100, ratio * 100))}%` }} /></div>
            <div className="marge-meta">
              <span>marge {fcfa(marge)}</span>
              {sousPlancher
                ? <span className="marge-alert">⚠ sous plancher{isEmp ? ' — refus à l’encaisse' : ''}</span>
                : aPerte ? <span className="marge-alert">⚠ vente à perte</span> : null}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function PayModal({ total, onClose, onPay, onCredit }: { total: number; onClose: () => void; onPay: (m: string) => void; onCredit: () => void }) {
  // Le montant est affiché en grand : au comptoir, c'est l'information que le
  // commerçant annonce au client avant de choisir le moyen de paiement.
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Encaisser</div>

        <div className="pay-amount">
          <span className="pay-amount-label">Montant à encaisser</span>
          <span className="pay-amount-value">{fcfa(total)}</span>
        </div>

        {/* Damier 2×2 : les quatre moyens tiennent sous le montant, sans faire
            défiler. Un pouce les atteint tous sans déplacer la main. */}
        <div className="paymode-grid">
          <button className="paymode paymode-cash" onClick={() => onPay('especes')}>
            <span className="pm-ico" aria-hidden="true">💵</span>
            <span className="pm-body"><span className="pm-t">Espèces</span><span className="pm-s">Liquide</span></span>
          </button>

          <button className="paymode" onClick={() => onPay('wave')}>
            <img src="/pay/wave.png" alt="" width={30} height={30} loading="lazy" />
            <span className="pm-body"><span className="pm-t">Wave</span><span className="pm-s">Mobile</span></span>
          </button>

          <button className="paymode" onClick={() => onPay('orange')}>
            <img src="/pay/orange-money.png" alt="" width={30} height={30} loading="lazy" />
            <span className="pm-body"><span className="pm-t">Orange Money</span><span className="pm-s">Mobile</span></span>
          </button>

          <button className="paymode paymode-credit" onClick={onCredit}>
            <span className="pm-ico" aria-hidden="true">📝</span>
            <span className="pm-body"><span className="pm-t">Crédit</span><span className="pm-s">Plus tard</span></span>
          </button>
        </div>

        <button className="btn-cancel" style={{ width: '100%', marginTop: 10 }} onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}

/** Choix du client de la vente : habitué du fichier, nouveau nom, ou personne. */
function ClientPicker({ clients, current, onClose, onPick }: {
  clients: { id: number; name: string; phone: string | null }[]
  current: SaleClient | null
  onClose: () => void
  onPick: (c: SaleClient | null) => void
}) {
  const [q, setQ] = useState('')
  const [nouveau, setNouveau] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const found = clients.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || (c.phone || '').includes(q))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">👤 Client de la vente</div>

        {nouveau ? (
          <>
            <div className="form-group"><label>Nom du client</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Awa Ndiaye" autoFocus /></div>
            <div className="form-group"><label>📞 Téléphone</label><input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="77 123 45 67" /></div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
              Une fiche client sera créée automatiquement si la vente se fait à crédit.
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setNouveau(false)}>Retour</button>
              <button className="btn-confirm" disabled={!name.trim()} onClick={() => onPick({ id: null, name: name.trim(), phone: phone || null })}>Choisir</button>
            </div>
          </>
        ) : (
          <>
            <input className="search-bar" placeholder="🔍 Chercher un client..." value={q} onChange={(e) => setQ(e.target.value)} />

            <button className="sheet-item" onClick={() => onPick(null)}>
              <span className="sheet-icon" style={{ background: '#F3F4F6' }}>🙋</span>
              <div><h3>Client de passage</h3><p>Vente sans fiche client</p></div>
              {!current && <span className="sheet-chevron">✅</span>}
            </button>

            <button className="sheet-item" onClick={() => setNouveau(true)}>
              <span className="sheet-icon" style={{ background: '#EDE9FE' }}>➕</span>
              <div><h3>Nouveau client</h3><p>Saisir un nom et un téléphone</p></div>
              <span className="sheet-chevron">›</span>
            </button>

            <div className="section-label" style={{ marginTop: 12 }}>Mes clients ({found.length})</div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {found.length === 0 && <div className="empty-sub" style={{ padding: '10px 4px' }}>Aucun client enregistré</div>}
              {found.map((c) => (
                <button key={c.id} className="sheet-item" onClick={() => onPick({ id: c.id, name: c.name, phone: c.phone })}>
                  <Avatar name={c.name} size={40} radius={13} />
                  <div><h3>{c.name}</h3><p>{c.phone || 'sans téléphone'}</p></div>
                  {current?.id === c.id && <span className="sheet-chevron">✅</span>}
                </button>
              ))}
            </div>
            <button className="btn-cancel" style={{ width: '100%', marginTop: 10 }} onClick={onClose}>Fermer</button>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Vente à crédit.
 *
 * Un crédit est une dette : elle doit porter un NOM connu de la boutique,
 * sinon ni l'historique ni la relance ne fonctionnent. On exige donc un client
 * (choisi dans le fichier ou créé au vol) et on affiche le score de risque
 * calculé sur SES achats passés avant de valider.
 */
function CreditModal({ total, client, clients, onPickClient, onClose, onConfirm }: {
  total: number
  client: SaleClient | null
  clients: { id: number; name: string; phone: string | null }[]
  onPickClient: () => void
  onClose: () => void
  onConfirm: (i: { client_id: number | null; client_name: string; client_phone: string | null; due_date: string }) => void
}) {
  const [due, setDue] = useState('')
  const [score, setScore] = useState<CreditScore | null>(null)

  const RISK = {
    green: { c: 'var(--green)', bg: 'var(--success-bg)', t: 'Risque faible' },
    amber: { c: 'var(--warning)', bg: 'var(--warning-bg)', t: 'Risque moyen' },
    red: { c: 'var(--danger)', bg: 'var(--danger-bg)', t: 'Risque élevé' },
  } as const

  // Score dès qu'un client est choisi : on ne prête pas à l'aveugle.
  useEffect(() => {
    if (!client || total <= 0) { setScore(null); return }
    const t = setTimeout(() => {
      Ia.creditScore({ amount: total, due_date: due || null, client_id: client.id, client_name: client.name })
        .then(setScore).catch(() => setScore(null))
    }, 350)
    return () => clearTimeout(t)
  }, [client, total, due])

  const connu = client?.id != null && clients.some((c) => c.id === client.id)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">📝 Vente à crédit</div>

        <div className="pay-amount">
          <span className="pay-amount-label">Montant à crédit</span>
          <span className="pay-amount-value">{fcfa(total)}</span>
        </div>

        <button className={`client-chip ${client ? 'on' : ''}`} onClick={onPickClient} style={{ marginBottom: 12 }}>
          <span className="client-chip-icon">{client ? '👤' : '⚠️'}</span>
          <span className="client-chip-body">
            <b>{client ? client.name : 'Choisir le client'}</b>
            <small>{client ? (connu ? 'Client enregistré' : 'Nouveau client — fiche créée à la validation') : 'Obligatoire pour un crédit'}</small>
          </span>
          <span className="client-chip-go">›</span>
        </button>

        {score && (
          <div className="score-card" style={{ background: RISK[score.risk].bg, border: `1px solid ${RISK[score.risk].c}33` }}>
            <ScoreRing score={score.score} color={RISK[score.risk].c} label={RISK[score.risk].t} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: RISK[score.risk].c, marginBottom: 4 }}>🤖 {RISK[score.risk].t}</div>
              {score.reasons.map((r, i) => <div key={i} style={{ fontSize: 11.5, color: 'var(--muted)' }}>• {r}</div>)}
            </div>
          </div>
        )}

        <div className="form-group"><label>🗓️ À rembourser avant le</label><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Annuler</button>
          <button className="btn-confirm" disabled={!client}
            onClick={() => client && onConfirm({ client_id: client.id, client_name: client.name, client_phone: client.phone, due_date: due })}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

function QuickProductModal({ categories, onClose, onCreated }: { categories: Category[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState(''); const [price, setPrice] = useState(''); const [stock, setStock] = useState('')
  const [categoryId, setCategoryId] = useState(''); const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim() || !price) return alert('Nom et prix requis')
    setSaving(true)
    try {
      await Products.create({ name: name.trim(), price: Number(price), stock: Number(stock) || 0, category_id: categoryId ? Number(categoryId) : null } as any)
      onCreated()
    } catch (e: any) { alert(e?.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">➕ Nouveau produit</div>
        <div className="form-group"><label>Nom</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du produit" autoFocus /></div>
        <div className="form-group"><label>Prix de vente (FCFA)</label><input type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <div className="form-group"><label>Stock initial</label><input type="number" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" /></div>
        <div className="form-group"><label>Catégorie</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sans catégorie</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Annuler</button>
          <button className="btn-confirm" onClick={save} disabled={saving}>{saving ? '…' : 'Ajouter'}</button>
        </div>
      </div>
    </div>
  )
}
