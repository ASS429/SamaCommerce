import { useEffect, useState } from 'react'
import { Ia, type ReapproItem } from '../lib/api'
import { SkeletonList } from '../components/Skeleton'
import type { View } from './Home'

export default function IaReappro({ onNavigate }: { onNavigate?: (v: View) => void }) {
  const [items, setItems] = useState<ReapproItem[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(true) // Design 3.4 — balayage radar à l'ouverture

  useEffect(() => { Ia.reappro().then(setItems).catch(() => {}).finally(() => setLoading(false)) }, [])
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = setTimeout(() => setScanning(false), reduced ? 0 : 1500)
    return () => clearTimeout(t)
  }, [])

  // Les urgences (rupture proche) remontent physiquement en tête de liste.
  const sorted = [...items].sort((a, b) => {
    const da = a.days_until_stockout ?? 9999, db = b.days_until_stockout ?? 9999
    return da - db
  })

  const urgence = (d: number | null) =>
    d === null ? { c: 'var(--muted)', t: 'OK', border: 'var(--line)' }
      : d <= 5 ? { c: 'var(--danger)', t: `${d} j`, border: 'var(--danger)' }
        : d <= 14 ? { c: 'var(--warning)', t: `${d} j`, border: 'var(--warning)' }
          : { c: 'var(--green)', t: `${d} j`, border: 'var(--green)' }

  const aCommander = items.filter((i) => i.reorder_display > 0)
  const method = items[0]?.method

  return (
    <>
      <div className="page-header"><h2>🤖 Réapprovisionnement</h2>
        {method && <span className="badge-soft" style={{ background: method === 'model' ? '#EDE9FE' : 'var(--bg)', color: method === 'model' ? 'var(--brand)' : 'var(--muted)' }}><span className={method === 'model' ? 'ia-brain-glow' : ''}>{method === 'model' ? '🧠' : '📐'}</span> {method === 'model' ? 'Modèle IA' : 'Estimation'}</span>}
      </div>

      {(scanning || loading) && (
        <div className="ia-radar" aria-hidden="true">
          <span className="ia-radar-sweep" /><span className="ia-radar-sweep" /><span className="ia-radar-sweep" />
          <div className="ia-radar-label"><span className="ia-brain-glow">📡</span> Analyse des ventes…</div>
        </div>
      )}

      <div className="guide">
        <div style={{ fontSize: 22 }}>💡</div>
        <div>
          <div className="guide-title">Prévision de la demande</div>
          <div style={{ fontSize: 12.5, color: 'var(--label)', lineHeight: 1.45 }}>
            À partir de tes ventes récentes, l'IA estime la <b>demande quotidienne</b>, les <b>jours avant rupture</b> et la <b>quantité à recommander</b> (couverture ~14 jours). {aCommander.length > 0 ? `${aCommander.length} produit(s) à réapprovisionner.` : 'Aucun réappro urgent 🎉'}
          </div>
        </div>
      </div>

      {loading && !scanning && <SkeletonList count={5} />}
      {!loading && !scanning && items.length === 0 && <div className="empty-state"><div className="empty-icon">📦</div><div className="empty-sub">Pas encore de données de vente à analyser</div></div>}

      {!loading && !scanning && sorted.map((it) => {
        const u = urgence(it.days_until_stockout)
        const urgent = it.days_until_stockout !== null && it.days_until_stockout <= 5
        return (
          <div key={it.product_id} className={`card${urgent ? ' ia-urgent-rise' : ''}`} style={{ borderLeft: `4px solid ${u.border}`, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="produit-name">{it.name}</div>
              <span className="produit-stock-pill" style={{ background: 'var(--bg)', color: u.c, fontWeight: 700 }}>⏳ {u.t}</span>
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8, fontSize: 12.5, color: 'var(--muted)' }}>
              <span>Stock : <b style={{ color: 'var(--ink)' }}>{it.stock_display} {it.display_label}</b></span>
              <span>Demande/j : <b style={{ color: 'var(--ink)' }}>{it.avg_daily_display} {it.display_label}</b></span>
            </div>
            {it.reorder_display > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line-soft)' }}>
                <div style={{ fontSize: 13 }}>📦 Recommandé : <b className="sora" style={{ color: 'var(--brand)' }}>{it.reorder_display} {it.display_label}</b></div>
                <button className="prd-btn prd-btn-edit" onClick={() => onNavigate?.('commandes')}>Commander</button>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
