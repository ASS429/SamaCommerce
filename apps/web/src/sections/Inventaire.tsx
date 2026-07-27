import { useEffect, useMemo, useState } from 'react'
import { Products, Sales, fcfa, type Product, type Sale } from '../lib/api'
import { exportCsv } from '../lib/export'

export default function Inventaire() {
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => { Products.list().then(setProducts); Sales.list().then(setSales) }, [])

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

  return (
    <>
      <div className="page-header">
        <h2>📋 Inventaire</h2>
        <button className="btn-pdf" style={{ background: '#ECFDF5', color: 'var(--green)' }}
          onClick={() => exportCsv('inventaire-samacommerce', ['Produit', 'Achat', 'Vente', 'Stock', 'Vendues', 'Benefice', 'Marge %'],
            rows.map((r) => [r.p.name, Number(r.p.price_achat), Number(r.p.price), r.p.stock, r.v, Math.round(r.benefice), Math.round(r.marge)]))}>
          📊 Export Excel
        </button>
      </div>
      <div className="stat-2x2">
        <div className="st st-b"><div className="sv">{fcfa(totals.valeur)}</div><div className="sl">Valeur du stock</div></div>
        <div className="st st-g"><div className="sv">{fcfa(totals.benefice)}</div><div className="sl">Bénéfice réalisé</div></div>
        <div className="st st-p"><div className="sv">{totals.produits}</div><div className="sl">Produits</div></div>
        <div className="st st-y"><div className="sv">{totals.vendus}</div><div className="sl">Articles vendus</div></div>
      </div>

      <input className="search-bar" placeholder="🔍 Rechercher un produit..." value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="hist-table">
          <thead><tr><th>Produit</th><th>Achat</th><th>Vente</th><th>Stock</th><th>Vendues</th><th>Bénéfice</th><th>Marge</th></tr></thead>
          <tbody>
            {rows.map(({ p, v, benefice, marge }) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td>{fcfa(Number(p.price_achat))}</td>
                <td>{fcfa(Number(p.price))}</td>
                <td style={{ fontWeight: 700, color: p.stock <= 5 ? 'var(--red)' : 'inherit' }}>{p.stock}</td>
                <td>{v}</td>
                <td style={{ color: 'var(--green)', fontWeight: 700 }}>{fcfa(benefice)}</td>
                <td>{marge.toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
