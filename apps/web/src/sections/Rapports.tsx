import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend } from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Sales, Stats, fcfa, type Sale } from '../lib/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend)

type Periode = 'jour' | 'semaine' | 'mois' | 'tout'

export default function Rapports() {
  const [sales, setSales] = useState<Sale[]>([])
  const [parJour, setParJour] = useState<any[]>([])
  const [paiements, setPaiements] = useState<any[]>([])
  const [top, setTop] = useState<any[]>([])
  const [marge, setMarge] = useState<any[]>([])
  const [rotation, setRotation] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [marchandage, setMarchandage] = useState<any>(null)
  const [periode, setPeriode] = useState<Periode>('tout')
  const [hist, setHist] = useState<Sale[]>([])
  const [histPage, setHistPage] = useState(0)
  const [histLast, setHistLast] = useState(1)
  const [histLoading, setHistLoading] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (histLoading) return
    const next = histPage + 1
    if (histPage > 0 && next > histLast) return
    setHistLoading(true)
    try { const p = await Sales.page(next, 15); setHist((h) => [...h, ...p.data]); setHistPage(p.current_page); setHistLast(p.last_page) }
    finally { setHistLoading(false) }
  }, [histLoading, histPage, histLast])

  useEffect(() => { loadMore() /* page 1 au montage */ }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = sentinel.current; if (!el) return
    const obs = new IntersectionObserver((e) => { if (e[0].isIntersecting) loadMore() }, { rootMargin: '120px' })
    obs.observe(el); return () => obs.disconnect()
  }, [loadMore])

  useEffect(() => {
    Sales.list().then(setSales); Stats.ventesParJour().then(setParJour); Stats.paiements().then(setPaiements); Stats.topProduits().then(setTop)
    Stats.margeCategorie().then(setMarge).catch(() => {}); Stats.rotationStock().then(setRotation).catch(() => {}); Stats.meilleursClients().then(setClients).catch(() => {})
    Stats.marchandage().then(setMarchandage).catch(() => {})
  }, [])

  const startOf = (p: Periode) => { const d = new Date(); if (p === 'jour') d.setHours(0,0,0,0); else if (p === 'semaine') d.setDate(d.getDate()-7); else if (p === 'mois') d.setMonth(d.getMonth()-1); else return new Date(0); return d }
  const sumPeriod = (p: Periode) => sales.filter((s) => new Date(s.created_at) >= startOf(p) && s.paid).reduce((a, s) => a + Number(s.total), 0)

  const metrics = useMemo(() => {
    const inP = sales.filter((s) => new Date(s.created_at) >= startOf(periode))
    const encaisse = inP.filter((s) => s.paid).reduce((a, s) => a + Number(s.total), 0)
    const attente = inP.filter((s) => !s.paid).reduce((a, s) => a + Number(s.total), 0)
    const credits = sales.filter((s) => s.payment_method === 'credit')
    const remb = credits.filter((s) => s.paid).reduce((a, s) => a + Number(s.total), 0)
    const impaye = credits.filter((s) => !s.paid).reduce((a, s) => a + Number(s.total), 0)
    return { encaisse, attente, credits: impaye, taux: remb + impaye > 0 ? (remb / (remb + impaye)) * 100 : 0 }
  }, [sales, periode])

  const exportPdf = () => {
    const doc = new jsPDF(); doc.setFontSize(16); doc.text('SamaCommerce — Chiffres', 14, 18); doc.setFontSize(10)
    doc.text(`CA encaisse: ${fcfa(metrics.encaisse)}   En attente: ${fcfa(metrics.attente)}`, 14, 28)
    autoTable(doc, { startY: 36, head: [['Produit', 'Qte', 'Montant']], body: top.map((t) => [t.produit, t.total_quantite, fcfa(Number(t.total_montant))]) })
    doc.save('chiffres-samacommerce.pdf')
  }

  return (
    <>
      <div className="page-header"><h2>📈 Chiffres</h2><button className="btn-pdf" onClick={exportPdf}>📄 PDF</button></div>

      <div className="stat-2x2">
        <div className="st st-g"><div className="sv">{fcfa(sumPeriod('jour'))}</div><div className="sl">Aujourd'hui</div></div>
        <div className="st st-b"><div className="sv">{fcfa(sumPeriod('semaine'))}</div><div className="sl">Cette semaine</div></div>
        <div className="st st-y"><div className="sv">{fcfa(sumPeriod('mois'))}</div><div className="sl">Ce mois</div></div>
        <div className="st st-p"><div className="sv">{fcfa(sumPeriod('tout'))}</div><div className="sl">Tout</div></div>
      </div>

      <div className="period-row" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Période :</label>
        <select value={periode} onChange={(e) => setPeriode(e.target.value as Periode)} style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #E5E7EB', borderRadius: 11 }}>
          <option value="jour">Aujourd'hui</option><option value="semaine">Cette semaine</option><option value="mois">Ce mois</option><option value="tout">Tout</option>
        </select>
      </div>

      <div className="metric-2x2">
        <div className="mc"><div className="ml">💰 CA encaissé</div><div className="mv" style={{ color: 'var(--green)' }}>{fcfa(metrics.encaisse)}</div></div>
        <div className="mc"><div className="ml">⏳ En attente</div><div className="mv" style={{ color: 'var(--orange)' }}>{fcfa(metrics.attente)}</div></div>
        <div className="mc"><div className="ml">💳 Crédits en cours</div><div className="mv" style={{ color: 'var(--red)' }}>{fcfa(metrics.credits)}</div></div>
        <div className="mc"><div className="ml">📊 Recouvrement</div><div className="mv" style={{ color: 'var(--blue)' }}>{metrics.taux.toFixed(0)} %</div></div>
      </div>

      <div className="card"><div className="card-title">📊 Ventes par jour</div>
        <Line data={{ labels: parJour.map((r) => r.date), datasets: [{ label: 'Montant', data: parJour.map((r) => Number(r.total_montant)), borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,.15)', tension: 0.3, fill: true }] }} options={{ plugins: { legend: { display: false } } }} />
      </div>
      <div className="card"><div className="card-title">🔥 Top produits</div>
        <Bar data={{ labels: top.map((t) => t.produit), datasets: [{ label: 'Qté', data: top.map((t) => Number(t.total_quantite)), backgroundColor: '#3B82F6' }] }} options={{ plugins: { legend: { display: false } } }} />
      </div>
      <div className="card"><div className="card-title">💳 Paiements</div>
        <Doughnut data={{ labels: paiements.map((p) => p.payment_method), datasets: [{ data: paiements.map((p) => Number(p.total_montant)), backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#A855F7'] }] }} />
      </div>

      {marchandage && marchandage.nb > 0 && (
        <div className="card"><div className="card-title">💬 Marchandage & marge réelle</div>
          <div className="metric-2x2">
            <div className="mc"><div className="ml">💰 Marge réelle</div><div className="mv" style={{ color: 'var(--green)' }}>{fcfa(marchandage.marge)}</div></div>
            <div className="mc"><div className="ml">📊 Taux de marge</div><div className="mv" style={{ color: 'var(--blue)' }}>{marchandage.taux_marge} %</div></div>
            <div className="mc"><div className="ml">🏷️ Remises consenties</div><div className="mv" style={{ color: 'var(--accent)' }}>{fcfa(marchandage.remise_totale)}</div></div>
            <div className="mc"><div className="ml">🧾 Ventes</div><div className="mv">{marchandage.nb}</div></div>
          </div>
          {marchandage.par_vendeur?.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="hist-table" style={{ marginTop: 6 }}>
                <thead><tr><th>Vendeur</th><th>Ventes</th><th>CA</th><th>Marge</th><th>Remise</th></tr></thead>
                <tbody>
                  {marchandage.par_vendeur.map((v: any, i: number) => (
                    <tr key={i}><td>{v.vendeur}</td><td>{v.nb}</td><td>{fcfa(Number(v.ca))}</td><td style={{ color: 'var(--green)', fontWeight: 700 }}>{fcfa(Number(v.marge))}</td><td style={{ color: 'var(--accent)' }}>{fcfa(Number(v.remise))}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card"><div className="card-title">💎 Marge par catégorie</div>
        {marge.length === 0 ? <div className="empty-sub">Pas encore de données</div>
          : <Bar data={{ labels: marge.map((m) => m.categorie), datasets: [{ label: 'Marge', data: marge.map((m) => Number(m.marge)), backgroundColor: '#10B981' }, { label: 'CA', data: marge.map((m) => Number(m.ca)), backgroundColor: '#A78BFA' }] }} options={{ plugins: { legend: { display: true } } }} />}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}><div className="card-title">🔄 Rotation des stocks</div>
        <table className="hist-table">
          <thead><tr><th>Produit</th><th>Vendus</th><th>Stock</th><th>Rotation</th></tr></thead>
          <tbody>
            {rotation.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 14 }}>Aucune donnée</td></tr>}
            {rotation.map((r, i) => {
              const v = Number(r.vendus), st = Number(r.stock)
              const ratio = st > 0 ? v / st : v
              const tag = ratio >= 1 ? { t: 'Rapide', c: 'var(--green)' } : ratio >= 0.3 ? { t: 'Moyenne', c: 'var(--orange)' } : { t: 'Lente', c: 'var(--red)' }
              return <tr key={i}><td>{r.produit}</td><td>{v}</td><td>{st}</td><td style={{ color: tag.c, fontWeight: 700 }}>{tag.t}</td></tr>
            })}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}><div className="card-title">🧾 Historique des ventes ({hist.length}{histLast > 1 ? ` / ${histLast * 15}~` : ''})</div>
        <table className="hist-table">
          <thead><tr><th>Date</th><th>Produit</th><th>Qté</th><th>Montant</th><th>Paiement</th></tr></thead>
          <tbody>
            {hist.map((s) => (
              <tr key={s.id}>
                <td>{(s.created_at || '').slice(0, 10)}</td>
                <td>{s.product_name || '—'}</td>
                <td>{s.quantity}</td>
                <td>{fcfa(Number(s.total))}</td>
                <td>{s.paid ? s.payment_method : <span style={{ color: 'var(--red)' }}>crédit</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div ref={sentinel} style={{ textAlign: 'center', padding: 10, color: 'var(--muted)', fontSize: 12.5 }}>
          {histLoading ? '⟳ Chargement…' : histPage < histLast ? <button className="badge-soft" onClick={loadMore}>Charger plus</button> : 'Fin de l’historique'}
        </div>
      </div>

      <div className="card"><div className="card-title">🏆 Meilleurs clients</div>
        {clients.length === 0 ? <div className="empty-sub">Aucun client avec achats</div>
          : clients.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }}>
              <span className="sora" style={{ fontWeight: 800, color: 'var(--brand)', width: 22 }}>{i + 1}</span>
              <div style={{ flex: 1 }}><div className="sora" style={{ fontWeight: 700, fontSize: 14 }}>{c.client}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{c.nb_achats} achat(s)</div></div>
              <span className="sora" style={{ fontWeight: 800, color: 'var(--green)' }}>{fcfa(Number(c.total))}</span>
            </div>
          ))}
      </div>
    </>
  )
}
