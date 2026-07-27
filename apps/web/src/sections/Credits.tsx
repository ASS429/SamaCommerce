import { useEffect, useMemo, useState } from 'react'
import { Products, Sales, Ia, fcfa, type Product, type Sale, type CreditScore } from '../lib/api'
import { promptAsync } from '../lib/toast'
import { SkeletonLine } from '../components/Skeleton'
import ScoreRing from '../components/ScoreRing'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const RISK = { green: { c: 'var(--green)', bg: '#ECFDF5', t: 'Risque faible' }, amber: { c: 'var(--warning)', bg: '#FFF7ED', t: 'Risque moyen' }, red: { c: 'var(--danger)', bg: '#FEF2F2', t: 'Risque élevé' } }

export default function Credits() {
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [client, setClient] = useState(''); const [phone, setPhone] = useState('')
  const [productId, setProductId] = useState(''); const [qty, setQty] = useState('1'); const [due, setDue] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [score, setScore] = useState<CreditScore | null>(null)

  const load = () => { Sales.list().then((s) => setSales(s.filter((x) => x.payment_method === 'credit'))).finally(() => setLoading(false)); Products.list().then(setProducts) }
  useEffect(load, [])

  const resume = useMemo(() => ({
    enCours: sales.filter((s) => !s.paid).reduce((a, s) => a + Number(s.total), 0),
    rembourses: sales.filter((s) => s.paid).reduce((a, s) => a + Number(s.total), 0),
    nb: sales.filter((s) => !s.paid).length,
  }), [sales])

  const montant = useMemo(() => {
    const p = products.find((x) => String(x.id) === productId)
    return p ? Math.round(Number(p.price)) * (Number(qty) || 1) : 0
  }, [products, productId, qty])

  // Module B (IA) — scoring du risque de crédit, déclenché quand client + produit sont saisis
  useEffect(() => {
    if (!client.trim() || !productId || montant <= 0) { setScore(null); return }
    const t = setTimeout(() => {
      Ia.creditScore({ amount: montant, due_date: due || null, client_name: client.trim() }).then(setScore).catch(() => setScore(null))
    }, 450)
    return () => clearTimeout(t)
  }, [client, productId, montant, due])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!productId) return alert('Choisir un produit'); setSaving(true)
    try { await Sales.create({ product_id: Number(productId), quantity: Number(qty) || 1, payment_method: 'credit', client_name: client || null, client_phone: phone || null, due_date: due || null } as any); setClient(''); setPhone(''); setProductId(''); setQty('1'); setDue(''); load() }
    catch (err: any) { alert(err?.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }
  const rembourser = async (s: Sale) => { const m = await promptAsync('Mode de remboursement (especes / wave / orange) :', 'especes', 'especes'); if (!m) return; await Sales.update(s.id, { paid: true, repayment_method: m } as any); load() }

  const exportPdf = () => {
    const doc = new jsPDF(); doc.setFontSize(16); doc.text('SamaCommerce — Crédits', 14, 18); doc.setFontSize(10)
    doc.text(`En cours: ${fcfa(resume.enCours)}   Rembourse: ${fcfa(resume.rembourses)}   Impayes: ${resume.nb}`, 14, 28)
    autoTable(doc, { startY: 36, head: [['Date', 'Client', 'Produit', 'Montant', 'Echeance', 'Statut']], body: sales.map((s) => [(s.created_at || '').slice(0, 10), s.client_name || '—', s.product_name || '—', fcfa(Number(s.total)), s.due_date || '—', s.paid ? 'Rembourse' : 'Impaye']) })
    doc.save('credits-samacommerce.pdf')
  }

  return (
    <>
      <div className="page-header"><h2>📝 Crédits</h2><button className="btn-pdf" onClick={exportPdf} disabled={sales.length === 0}>📄 PDF</button></div>

      <div className="cred-tiles">
        <div className="ct"><div className="cv" style={{ color: 'var(--red)' }}>{fcfa(resume.enCours)}</div><div className="cl">En cours</div></div>
        <div className="ct"><div className="cv" style={{ color: 'var(--green)' }}>{fcfa(resume.rembourses)}</div><div className="cl">Remboursé</div></div>
        <div className="ct"><div className="cv" style={{ color: 'var(--orange)' }}>{resume.nb}</div><div className="cl">Impayés</div></div>
      </div>

      <form className="card" onSubmit={submit}>
        <div className="card-title">➕ Nouvelle vente à crédit</div>
        <div className="form-group"><label>Client</label><input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Nom du client" /></div>
        <div className="form-group"><label>Téléphone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" /></div>
        <div className="form-group"><label>Produit</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Choisir un produit</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {fcfa(p.price)} (stock {p.stock})</option>)}
          </select>
        </div>
        <div className="form-group"><label>Quantité</label><input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div className="form-group"><label>Échéance</label><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>

        {score && (
          <div className="score-card" style={{ background: RISK[score.risk].bg, border: `1px solid ${RISK[score.risk].c}33` }}>
            <ScoreRing score={score.score} color={RISK[score.risk].c} label={RISK[score.risk].t} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: RISK[score.risk].c, marginBottom: 4 }}>🤖 {RISK[score.risk].t}</div>
              {score.reasons.map((r, i) => <div key={i} style={{ fontSize: 11.5, color: 'var(--muted)' }}>• {r}</div>)}
              <div style={{ fontSize: 10.5, color: 'var(--muted2)', marginTop: 4 }}>Montant estimé : {fcfa(montant)} · {score.method === 'model' ? 'modèle IA' : 'estimation'}</div>
            </div>
          </div>
        )}

        <button className="btn-confirm" style={{ width: '100%' }} disabled={saving}>💾 Enregistrer à crédit</button>
      </form>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="card-title">📜 Historique des crédits</div>
        <table className="hist-table">
          <thead><tr><th>Date</th><th>Client</th><th>Produit</th><th>Montant</th><th>Échéance</th><th>Statut</th><th>Action</th></tr></thead>
          <tbody>
            {loading && [0, 1, 2].map((i) => <tr key={i}><td colSpan={7} style={{ padding: 8 }}><SkeletonLine h={18} /></td></tr>)}
            {!loading && sales.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 16 }}>Aucun crédit</td></tr>}
            {!loading && sales.map((s) => (
              <tr key={s.id}>
                <td>{(s.created_at || '').slice(0, 10)}</td>
                <td>{s.client_name || '—'}</td>
                <td>{s.product_name || '—'}</td>
                <td>{fcfa(Number(s.total))}</td>
                <td>{s.due_date || '—'}</td>
                <td>{s.paid ? <span style={{ color: 'var(--green)', fontWeight: 700 }}>Remboursé</span> : <span style={{ color: 'var(--red)', fontWeight: 700 }}>Impayé</span>}</td>
                <td>{!s.paid && <button className="prd-btn prd-btn-edit" onClick={() => rembourser(s)}>💰</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
