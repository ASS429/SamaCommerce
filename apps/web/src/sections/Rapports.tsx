import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend } from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { Sales, Stats, boutiqueIdentity, fcfa, type Sale } from '../lib/api'
import { exportPdf, money } from '../lib/pdf'
import { exportXlsx } from '../lib/xlsx'
import { productIcon } from '../lib/productIcon'
import { payLabel } from '../lib/payments'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend)

/** Couleurs de l'anneau des paiements, reprises telles quelles par la légende. */
const PAY_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#A855F7', '#EC4899']

type Periode = 'jour' | 'semaine' | 'mois' | 'tout'

/** Libellés courts de l'interrupteur segmenté (quatre cases sur 320 px). */
const PERIODE_COURT: Record<Periode, string> = { jour: 'Jour', semaine: 'Semaine', mois: 'Mois', tout: 'Tout' }

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
  const [loading, setLoading] = useState(true)
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
    // `loading` sert à afficher des cadres qui « respirent » plutôt que des
    // 0 F trompeurs : voir un chiffre d'affaires à zéro fait paniquer.
    Promise.all([
      Sales.list().then(setSales).catch(() => {}),
      Stats.ventesParJour().then(setParJour).catch(() => {}),
      Stats.paiements().then(setPaiements).catch(() => {}),
      Stats.topProduits().then(setTop).catch(() => {}),
    ]).finally(() => setLoading(false))
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

  const PERIODE_LABEL: Record<Periode, string> = {
    jour: "Aujourd'hui", semaine: 'Cette semaine', mois: 'Ce mois', tout: 'Depuis le début',
  }

  const exportChiffresPdf = () => exportPdf('chiffres-samacommerce', {
    title: 'Chiffres',
    subtitle: `Période : ${PERIODE_LABEL[periode]}`,
    boutique: boutiqueIdentity(),
    summary: [
      { label: 'CA encaissé', value: money(metrics.encaisse), tone: 'green' },
      { label: 'En attente', value: money(metrics.attente), tone: 'orange' },
      { label: 'Crédits impayés', value: money(metrics.credits), tone: 'red' },
      { label: 'Taux de remboursement', value: `${metrics.taux.toFixed(0)} %` },
    ],
    columns: ['Produit', 'Quantité', 'Montant'],
    rows: top.map((t) => [t.produit, String(t.total_quantite), money(Number(t.total_montant))]),
    foot: ['TOTAL', String(top.reduce((a, t) => a + Number(t.total_quantite), 0)), money(top.reduce((a, t) => a + Number(t.total_montant), 0))],
    rightAlign: [1, 2],
    note: 'Classement des produits les plus vendus sur la période retenue.',
  })

  const exportChiffresExcel = () => exportXlsx('chiffres-samacommerce', {
    sheet: 'Chiffres',
    title: '📈 Chiffres de la boutique',
    subtitle: `${boutiqueIdentity().nom} — ${PERIODE_LABEL[periode]} — édité le ${new Date().toLocaleDateString('fr-FR')}`,
    columns: [
      { header: 'Produit', width: 32 },
      { header: 'Quantité vendue', width: 16, type: 'number' },
      { header: 'Montant', width: 16, type: 'money' },
    ],
    rows: top.map((t) => [t.produit, Number(t.total_quantite), Number(t.total_montant)]),
    totals: ['TOTAL', top.reduce((a, t) => a + Number(t.total_quantite), 0), top.reduce((a, t) => a + Number(t.total_montant), 0)],
  })

  return (
    <>
      <div className="page-header">
        <h2>📈 Chiffres</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-pdf" style={{ background: '#ECFDF5', color: 'var(--green)' }} onClick={exportChiffresExcel} disabled={top.length === 0}>📊 Excel</button>
          <button className="btn-pdf" onClick={exportChiffresPdf}>📄 PDF</button>
        </div>
      </div>

      {/* La période se choisit d'un doigt. La liste déroulante précédente
          cachait le choix courant derrière un menu système, et le tableau des
          quatre périodes répétait ce que la sélection affiche déjà. */}
      <div className="seg">
        {(['jour', 'semaine', 'mois', 'tout'] as Periode[]).map((p) => (
          <button key={p} className={`seg-btn ${periode === p ? 'on' : ''}`} onClick={() => setPeriode(p)} aria-pressed={periode === p}>
            {PERIODE_COURT[p]}
          </button>
        ))}
      </div>

      <div className="kpi-row">
        <div className="kpi" style={{ background: 'var(--hero-green)' }}>
          <div className="kpi-l">💰 Encaissé</div>
          <div className="kpi-v">{loading ? <span className="pulse">…</span> : fcfa(metrics.encaisse)}</div>
          <div className="kpi-d">{PERIODE_LABEL[periode]}</div>
        </div>
        {marchandage && marchandage.nb > 0 ? (
          <div className="kpi" style={{ background: 'var(--hero-violet)' }}>
            <div className="kpi-l">💎 Marge réelle</div>
            <div className="kpi-v">{fcfa(marchandage.marge)}</div>
            <div className="kpi-d">≈ {marchandage.taux_marge} % du prix</div>
          </div>
        ) : (
          <div className="kpi" style={{ background: 'var(--hero-violet)' }}>
            <div className="kpi-l">📊 Crédits remboursés</div>
            <div className="kpi-v">{loading ? <span className="pulse">…</span> : `${metrics.taux.toFixed(0)} %`}</div>
            <div className="kpi-d">{fcfa(metrics.credits)} restent dus</div>
          </div>
        )}
      </div>

      <div className="metric-2x2">
        <div className="mc"><div className="ml">⏳ En attente</div><div className="mv" style={{ color: 'var(--orange)' }}>{fcfa(metrics.attente)}</div></div>
        <div className="mc"><div className="ml">💳 Crédits en cours</div><div className="mv" style={{ color: 'var(--red)' }}>{fcfa(metrics.credits)}</div></div>
        <div className="mc"><div className="ml">📅 Aujourd'hui</div><div className="mv" style={{ color: 'var(--green)' }}>{fcfa(sumPeriod('jour'))}</div></div>
        <div className="mc"><div className="ml">💰 Depuis le début</div><div className="mv" style={{ color: 'var(--blue)' }}>{fcfa(sumPeriod('tout'))}</div></div>
      </div>

      <div className="card"><div className="card-title">📊 Ventes par jour</div>
        <Line data={{ labels: parJour.map((r) => r.date), datasets: [{ label: 'Montant', data: parJour.map((r) => Number(r.total_montant)), borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,.15)', tension: 0.3, fill: true }] }} options={{ plugins: { legend: { display: false } } }} />
      </div>
      {/* Un histogramme dont on ne peut pas lire les étiquettes d'axe sur un
          téléphone ne dit rien. Des barres horizontales portent le nom, le
          pictogramme et la quantité sur la même ligne. */}
      <div className="card"><div className="card-title">🔥 Top produits</div>
        {top.length === 0 ? <div className="empty-sub">Pas encore de ventes</div> : (
          <div className="bar-list">
            {top.slice(0, 6).map((t, i) => {
              const max = Math.max(1, ...top.map((x) => Number(x.total_quantite)))
              return (
                <div key={t.produit} className={`bar-row b${Math.min(i + 1, 3)}`}>
                  <div className="bar-head">
                    <span className="bh-ico" aria-hidden="true">{['🥇', '🥈', '🥉'][i] || productIcon(t.produit)}</span>
                    <span className="bh-name">{t.produit}</span>
                    <span className="bh-val">{t.total_quantite}</span>
                  </div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${(Number(t.total_quantite) / max) * 100}%` }} /></div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <div className="card"><div className="card-title">💳 Paiements</div>
        {paiements.length === 0 ? <div className="empty-sub">Pas encore de ventes</div> : (
          <>
            <div style={{ maxWidth: 260, margin: '0 auto' }}>
              <Doughnut data={{
                labels: paiements.map((p) => payLabel(p.payment_method)),
                datasets: [{ data: paiements.map((p) => Number(p.total_montant)), backgroundColor: PAY_COLORS, borderWidth: 0 }],
              }} options={{ plugins: { legend: { display: false } }, cutout: '62%' }} />
            </div>
            {/* Légende écrite : les parts d'un anneau se comparent mal à l'œil,
                et la couleur seule ne dit pas laquelle est laquelle. */}
            <div className="bar-list" style={{ marginTop: 14 }}>
              {(() => {
                const somme = paiements.reduce((a, p) => a + Number(p.total_montant), 0) || 1
                return paiements.map((p, i) => (
                  <div key={p.payment_method} className="bar-head">
                    <span className="bh-ico" aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 4, background: PAY_COLORS[i % PAY_COLORS.length] }} />
                    <span className="bh-name">{payLabel(p.payment_method)}</span>
                    <span className="bh-val">{Math.round((Number(p.total_montant) / somme) * 100)} %</span>
                  </div>
                ))
              })()}
            </div>
          </>
        )}
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
