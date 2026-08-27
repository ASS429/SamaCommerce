import { useEffect, useMemo, useState } from 'react'
import { Sales, boutiqueIdentity, fcfa, type Sale } from '../lib/api'
import { exportXlsx } from '../lib/xlsx'
import { exportPdf, money } from '../lib/pdf'
import { SkeletonList } from '../components/Skeleton'
import { productIcon, productTint } from '../lib/productIcon'
import Avatar from '../components/Avatar'
import LoadError from '../components/LoadError'
import { useLoadError } from '../lib/loadError'
import { useProduits, LISTE_VIDE } from '../lib/queries'

export default function Inventaire() {
  // Catalogue partage : deja en memoire si l'on vient de Stock ou de Vendre.
  const products = useProduits().data ?? LISTE_VIDE
  const [sales, setSales] = useState<Sale[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const { error, watch, reset } = useLoadError()

  const load = () => {
    reset()
    Promise.all([
      watch(Sales.list().then(setSales)),
    ]).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const vendues = useMemo(() => {
    const m: Record<number, number> = {}
    for (const s of sales) m[s.product_id] = (m[s.product_id] || 0) + s.quantity
    return m
  }, [sales])

  const rows = useMemo(() => products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())).map((p) => {
    const v = vendues[p.id] || 0
    const benefice = (Number(p.price) - Number(p.price_achat)) * v
    const marge = Number(p.price) > 0 ? ((Number(p.price) - Number(p.price_achat)) / Number(p.price)) * 100 : 0
    return { p, v, benefice, marge }
  }), [products, vendues, search])

  const totals = useMemo(() => ({
    valeur: products.reduce((a, p) => a + Number(p.price_achat) * p.stock, 0),
    benefice: rows.reduce((a, r) => a + r.benefice, 0),
    produits: products.length,
    vendus: Object.values(vendues).reduce((a, b) => a + b, 0),
  }), [products, rows, vendues])

  /* Le produit qui rapporte le plus PAR VENTE. C'est l'information qu'un
     commerçant cherche dans un inventaire : sur quoi pousser. Elle était
     noyée dans une colonne « marge » de plus. */
  const meilleure = useMemo(() => {
    const eligibles = rows.filter((r) => Number(r.p.price) > 0 && Number(r.p.price_achat) > 0)
    if (eligibles.length === 0) return null
    return eligibles.reduce((best, r) => (r.marge > best.marge ? r : best))
  }, [rows])

  const sousTitre = `${boutiqueIdentity().nom} — ${rows.length} référence(s) — édité le ${new Date().toLocaleDateString('fr-FR')}`

  const exportExcel = () => exportXlsx('inventaire-samacommerce', {
    sheet: 'Inventaire',
    title: '📋 Inventaire & marges',
    subtitle: sousTitre,
    columns: [
      { header: 'Produit', width: 32 },
      { header: "Prix d'achat", width: 14, type: 'money' },
      { header: 'Prix de vente', width: 14, type: 'money' },
      { header: 'Stock', width: 10, type: 'number' },
      { header: 'Vendus', width: 10, type: 'number' },
      { header: 'Valeur stock', width: 15, type: 'money' },
      { header: 'Bénéfice', width: 14, type: 'money' },
      { header: 'Marge', width: 10, type: 'percent' },
    ],
    rows: rows.map(({ p, v, benefice, marge }) => [
      p.name, Number(p.price_achat), Number(p.price), p.stock, v,
      Number(p.price_achat) * p.stock, Math.round(benefice), Number(marge.toFixed(1)),
    ]),
    totals: ['TOTAL', null, null, null, totals.vendus, totals.valeur, Math.round(totals.benefice), null],
  })

  const exportInventairePdf = () => exportPdf('inventaire-samacommerce', {
    title: 'Inventaire',
    subtitle: sousTitre,
    boutique: boutiqueIdentity(),
    summary: [
      { label: 'Valeur du stock', value: money(totals.valeur) },
      { label: 'Bénéfice réalisé', value: money(totals.benefice), tone: 'green' },
      { label: 'Articles vendus', value: String(totals.vendus), tone: 'orange' },
    ],
    columns: ['Produit', 'Achat', 'Vente', 'Stock', 'Vendus', 'Bénéfice', 'Marge'],
    rows: rows.map(({ p, v, benefice, marge }) => [
      p.name, money(Number(p.price_achat)), money(Number(p.price)), String(p.stock), String(v), money(benefice), `${marge.toFixed(0)} %`,
    ]),
    foot: ['TOTAL', '', '', '', String(totals.vendus), money(totals.benefice), ''],
    rightAlign: [1, 2, 3, 4, 5, 6],
  })

  return (
    <>
      <div className="page-header">
        <h2>📋 Inventaire</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-pdf" style={{ background: '#ECFDF5', color: 'var(--green)' }} onClick={exportExcel} disabled={rows.length === 0}>📊 Excel</button>
          <button className="btn-pdf" onClick={exportInventairePdf} disabled={rows.length === 0}>📄 PDF</button>
        </div>
      </div>

      <div className="stat-2x2">
        <div className="st st-b"><div className="sv">{loading ? '—' : fcfa(totals.valeur)}</div><div className="sl">📦 Valeur du stock</div></div>
        <div className="st st-g"><div className="sv">{loading ? '—' : fcfa(totals.benefice)}</div><div className="sl">💰 Bénéfice réalisé</div></div>
        <div className="st st-p"><div className="sv">{loading ? '—' : totals.produits}</div><div className="sl">🏷️ Produits</div></div>
        <div className="st st-y"><div className="sv">{loading ? '—' : totals.vendus}</div><div className="sl">🛒 Articles vendus</div></div>
      </div>

      {!loading && meilleure && (
        <div className="tone-row">
          <span className="invite-ico" aria-hidden="true">🏆</span>
          <span style={{ minWidth: 0 }}>
            <span className="invite-t" style={{ display: 'block' }}>Meilleure marge : {meilleure.p.name}</span>
            <span className="invite-s" style={{ display: 'block' }}>
              {fcfa(Number(meilleure.p.price_achat))} → {fcfa(Number(meilleure.p.price))} l'unité
            </span>
          </span>
          <span className="code-box" style={{ marginLeft: 'auto', minWidth: 58, fontSize: 16 }}>+{meilleure.marge.toFixed(0)} %</span>
        </div>
      )}

      <input className="search-bar" placeholder="🔍 Rechercher un produit..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {loading && <SkeletonList count={5} />}
      {!loading && error && <LoadError error={error} onRetry={load} />}
      {!loading && !error && rows.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-text">{products.length === 0 ? 'Rien à inventorier' : 'Aucun résultat'}</div>
          <div className="empty-sub">{products.length === 0 ? 'Ajoutez des produits au stock pour voir vos marges' : 'Essayez un autre nom'}</div>
        </div>
      )}

      {/* Sur téléphone la lecture se fait en cartes : un tableau à 7 colonnes
          impose un défilement horizontal illisible. Le pictogramme du produit
          rend chaque ligne identifiable sans lire son nom. */}
      {!loading && rows.map(({ p, v, benefice, marge }) => (
        <div key={p.id} className="card inv-row">
          <Avatar photo={p.photo} icon={productIcon(p.name)} name={p.name} size={42} radius={13} tint={productTint(p.name)} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="fiche-name">{p.name}</div>
            <div className="fiche-sub">🏷️ {fcfa(Number(p.price_achat))} → {fcfa(Number(p.price))} · 🛒 {v} vendu(s)</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="sora" style={{ fontWeight: 800, color: benefice >= 0 ? 'var(--green)' : 'var(--red)' }}>{fcfa(benefice)}</div>
            <span className={`produit-stock-pill ${p.stock <= 0 ? 'pill-critical' : p.stock <= 5 ? 'pill-low' : 'pill-ok'}`}>
              📦 {p.stock} · {marge.toFixed(0)} %
            </span>
          </div>
        </div>
      ))}
    </>
  )
}
