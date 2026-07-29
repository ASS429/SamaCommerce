import { useEffect, useMemo, useState } from 'react'
import { Products, Sales, Ia, boutiqueIdentity, fcfa, type Product, type Sale, type CreditScore } from '../lib/api'
import { SkeletonList } from '../components/Skeleton'
import ScoreRing from '../components/ScoreRing'
import PaymentPicker from '../components/PaymentPicker'
import { exportPdf, money } from '../lib/pdf'
import { exportXlsx } from '../lib/xlsx'
import { productIcon, productTint } from '../lib/productIcon'
import { creditReminderMessage, openWhatsapp, telLink } from '../lib/whatsapp'

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
  // Remboursement : on choisit le moyen de paiement dans une liste illustrée
  // (auparavant il fallait taper « especes / wave / orange » au clavier).
  const [repaying, setRepaying] = useState<Sale | null>(null)
  const confirmRepay = async (m: string) => {
    const s = repaying
    setRepaying(null)
    if (!s) return
    await Sales.update(s.id, { paid: true, repayment_method: m } as any)
    load()
  }

  const exportCreditsPdf = () => exportPdf('credits-samacommerce', {
    title: 'Crédits',
    subtitle: `${sales.length} crédit(s) enregistré(s)`,
    boutique: boutiqueIdentity(),
    summary: [
      { label: 'En cours', value: money(resume.enCours), tone: 'red' },
      { label: 'Remboursé', value: money(resume.rembourses), tone: 'green' },
      { label: 'Impayés', value: String(resume.nb), tone: 'orange' },
    ],
    columns: ['Date', 'Client', 'Produit', 'Montant', 'Échéance', 'Statut'],
    rows: sales.map((s) => [
      (s.created_at || '').slice(0, 10), s.client_name || '—', s.product_name || '—',
      money(Number(s.total)), s.due_date || '—', s.paid ? 'Remboursé' : 'Impayé',
    ]),
    foot: ['TOTAL', '', '', money(sales.reduce((a, s) => a + Number(s.total), 0)), '', ''],
    rightAlign: [3],
    note: 'Un crédit impayé après son échéance doit être relancé : bouton « Rappel » dans l\'application.',
  })

  const exportCreditsExcel = () => exportXlsx('credits-samacommerce', {
    sheet: 'Crédits',
    title: '📝 Crédits clients',
    subtitle: `${boutiqueIdentity().nom} — édité le ${new Date().toLocaleDateString('fr-FR')}`,
    columns: [
      { header: 'Date', width: 12 }, { header: 'Client', width: 22 }, { header: 'Téléphone', width: 16 },
      { header: 'Produit', width: 26 }, { header: 'Montant', width: 14, type: 'money' },
      { header: 'Échéance', width: 12 }, { header: 'Statut', width: 14 },
    ],
    rows: sales.map((s) => [
      (s.created_at || '').slice(0, 10), s.client_name || '', s.client_phone || '',
      s.product_name || '', Number(s.total), s.due_date || '', s.paid ? 'Remboursé' : 'Impayé',
    ]),
    totals: ['TOTAL', '', '', '', sales.reduce((a, s) => a + Number(s.total), 0), '', ''],
  })

  /** Relance WhatsApp d'un crédit précis (montant, produit et échéance inclus). */
  const rappel = (s: Sale) => openWhatsapp(s.client_phone, creditReminderMessage(boutiqueIdentity(), {
    client: s.client_name || 'cher client',
    montant: Number(s.total),
    echeance: s.due_date,
    produit: s.product_name,
  }))

  return (
    <>
      {repaying && (
        <PaymentPicker
          title="💰 Remboursement reçu"
          amount={Number(repaying.total)}
          onPick={confirmRepay}
          onClose={() => setRepaying(null)}
        />
      )}
      <div className="page-header">
        <h2>📝 Crédits</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-pdf" style={{ background: '#ECFDF5', color: 'var(--green)' }} onClick={exportCreditsExcel} disabled={sales.length === 0}>📊 Excel</button>
          <button className="btn-pdf" onClick={exportCreditsPdf} disabled={sales.length === 0}>📄 PDF</button>
        </div>
      </div>

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
            {products.map((p) => <option key={p.id} value={p.id}>{productIcon(p.name)} {p.name} — {fcfa(p.price)} (stock {p.stock})</option>)}
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

      <div className="section-label">📜 Historique des crédits</div>

      {loading && <SkeletonList count={4} />}
      {!loading && sales.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <div className="empty-text">Aucun crédit</div>
          <div className="empty-sub">Les ventes à crédit apparaîtront ici, avec leur échéance</div>
        </div>
      )}

      {/* Une ligne de tableau à 7 colonnes est illisible sur téléphone. Ici,
          une fiche par crédit : image du produit, montant, et l'état porté par
          la couleur — vert remboursé, rouge en retard, ambre en cours. */}
      {!loading && sales.map((s) => {
        const enRetard = !s.paid && !!s.due_date && new Date(s.due_date) < new Date(new Date().toDateString())
        const tel = telLink(s.client_phone)
        return (
          <div key={s.id} className={`card fiche ${enRetard ? 'fiche-late' : ''}`}>
            <div className="fiche-head">
              <span className="produit-icon" style={{ width: 44, height: 44, fontSize: 22, borderRadius: 14, background: productTint(s.product_name) }} aria-hidden="true">
                {productIcon(s.product_name)}
              </span>
              <div className="fiche-id">
                <div className="fiche-name">{s.client_name || 'Client'}</div>
                <div className="fiche-sub">📦 {s.product_name || '—'} · 📅 {(s.created_at || '').slice(0, 10)}</div>
                {s.due_date && <div className="fiche-sub">{enRetard ? '⏰' : '🗓️'} Échéance {s.due_date}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="produit-price-main" style={{ color: s.paid ? 'var(--green)' : 'var(--red)' }}>{fcfa(Number(s.total))}</div>
                <span className={`produit-stock-pill ${s.paid ? 'pill-ok' : enRetard ? 'pill-critical' : 'pill-low'}`}>
                  {s.paid ? '✅ Remboursé' : enRetard ? '⏰ En retard' : '⏳ En cours'}
                </span>
              </div>
            </div>

            {!s.paid && (
              <div className="fiche-actions">
                <button className="fa-btn fa-ok" onClick={() => setRepaying(s)}>💰 Il a payé</button>
                {s.client_phone && <button className="fa-btn fa-wa" onClick={() => rappel(s)}>🔔 Rappel WhatsApp</button>}
                {tel && <a className="fa-btn fa-call" href={tel}>📞 Appeler</a>}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
