import { useEffect, useState } from 'react'
import { Caisse as Api, fcfa } from '../lib/api'
import { confirmAsync } from '../lib/toast'
import ClotureScene from '../components/ClotureScene'
import { boutiqueIdentity } from '../lib/api'
import { exportPdf, money } from '../lib/pdf'
import { exportXlsx } from '../lib/xlsx'
import { SkeletonList } from '../components/Skeleton'

export default function Caisse() {
  const [today, setToday] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [weekly, setWeekly] = useState<any[]>([])
  const [closing, setClosing] = useState(false)
  const [scene, setScene] = useState<any>(null) // Design 3.4 — séquence de clôture

  const load = () => { Api.today().then(setToday); Api.history().then(setHistory); Api.weekly().then(setWeekly) }
  useEffect(() => { load() }, [])

  /** Somme d'une colonne de l'historique (ligne de totaux des exports). */
  const sumHist = (key: string) => history.reduce((a, h) => a + Number(h[key] || 0), 0)

  const close = async () => {
    if (!await confirmAsync('Clôturer la caisse pour aujourd\'hui ?')) return
    setClosing(true)
    try {
      const snapshot = { ...today }
      await Api.close()
      setScene(snapshot) // déclenche la séquence cinématique de fin de journée
      load()
    } finally { setClosing(false) }
  }

  /* Le PDF de caisse est LE document de fin de journée : on le montre au
     patron, on le classe, parfois on le porte à la banque. */
  const exportCaissePdf = () => exportPdf('caisse-samacommerce', {
    title: 'Caisse',
    subtitle: `Journée du ${new Date().toLocaleDateString('fr-FR')}`,
    boutique: boutiqueIdentity(),
    summary: [
      { label: 'Espèces', value: money(today.especes), tone: 'green' },
      { label: 'Wave', value: money(today.wave) },
      { label: 'Orange Money', value: money(today.orange), tone: 'orange' },
      { label: 'Net du jour', value: money(today.net), tone: 'brand' },
    ],
    columns: ['Date', 'Espèces', 'Wave', 'Orange', 'Net'],
    rows: history.map((h) => [(h.date || '').slice(0, 10), money(Number(h.total_especes)), money(Number(h.total_wave)), money(Number(h.total_orange)), money(Number(h.total_net))]),
    foot: ['TOTAL', money(sumHist('total_especes')), money(sumHist('total_wave')), money(sumHist('total_orange')), money(sumHist('total_net'))],
    rightAlign: [1, 2, 3, 4],
    note: 'Historique des clôtures de caisse enregistrées.',
  })

  const exportCaisseExcel = () => exportXlsx('caisse-samacommerce', {
    sheet: 'Caisse',
    title: '💰 Clôtures de caisse',
    subtitle: `${boutiqueIdentity().nom} — édité le ${new Date().toLocaleDateString('fr-FR')}`,
    columns: [
      { header: 'Date', width: 14 },
      { header: 'Espèces', width: 14, type: 'money' }, { header: 'Wave', width: 14, type: 'money' },
      { header: 'Orange', width: 14, type: 'money' }, { header: 'Net', width: 14, type: 'money' },
    ],
    rows: history.map((h) => [(h.date || '').slice(0, 10), Number(h.total_especes), Number(h.total_wave), Number(h.total_orange), Number(h.total_net)]),
    totals: ['TOTAL', sumHist('total_especes'), sumHist('total_wave'), sumHist('total_orange'), sumHist('total_net')],
  })

  // Écran de chargement : des cadres qui « respirent » plutôt qu'un mot seul.
  if (!today) {
    return (
      <>
        <div className="page-header"><h2>💰 Caisse du jour</h2></div>
        <div className="stat-2x2">
          {[0, 1, 2, 3].map((i) => <div className="st" key={i}><div className="skeleton" style={{ height: 22, width: '70%' }} /><div className="skeleton" style={{ height: 11, width: '50%', marginTop: 6 }} /></div>)}
        </div>
        <SkeletonList count={3} />
      </>
    )
  }
  const maxW = Math.max(1, ...weekly.map((d) => Number(d.total_encaisse)))

  return (
    <>
      {scene && <ClotureScene today={scene} onClose={() => setScene(null)} />}
      <div className="page-header">
        <h2>💰 Caisse du jour</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-pdf" style={{ background: '#ECFDF5', color: 'var(--green)' }} onClick={exportCaisseExcel} disabled={history.length === 0}>📊 Excel</button>
          <button className="btn-pdf" onClick={exportCaissePdf}>📄 PDF</button>
        </div>
      </div>

      <div className="stat-2x2">
        <div className="st st-g"><div className="sv">{fcfa(today.especes)}</div><div className="sl">💵 Espèces</div></div>
        <div className="st st-b"><div className="sv">{fcfa(today.wave)}</div><div className="sl">📱 Wave</div></div>
        <div className="st st-y"><div className="sv">{fcfa(today.orange)}</div><div className="sl">📞 Orange</div></div>
        <div className="st st-p"><div className="sv">{fcfa(today.credits)}</div><div className="sl">📝 Crédits</div></div>
      </div>

      <div className="total-bar"><span className="tbl">NET ENCAISSÉ ({today.nb_ventes} ventes)</span><span className="tba">{fcfa(today.net)}</span></div>
      <button className="btn-encaisser" onClick={close} disabled={closing}>🔒 Clôturer la journée</button>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">📅 7 derniers jours</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, padding: '8px 0' }}>
          {weekly.map((d, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: '100%', background: 'var(--primary)', borderRadius: 6, height: `${(Number(d.total_encaisse) / maxW) * 90}px`, minHeight: 2 }} />
              <span style={{ fontSize: 9, color: 'var(--muted)' }}>{(d.date || '').slice(8, 10)}/{(d.date || '').slice(5, 7)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="card-title">🗂️ Clôtures récentes</div>
        <table className="hist-table">
          <thead><tr><th>Date</th><th>Espèces</th><th>Wave</th><th>Orange</th><th>Net</th></tr></thead>
          <tbody>
            {history.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 16 }}>Aucune clôture</td></tr>}
            {history.map((h) => (
              <tr key={h.id}>
                <td>{(h.date || '').slice(0, 10)}</td>
                <td>{fcfa(Number(h.total_especes))}</td>
                <td>{fcfa(Number(h.total_wave))}</td>
                <td>{fcfa(Number(h.total_orange))}</td>
                <td style={{ fontWeight: 700, color: 'var(--green)' }}>{fcfa(Number(h.total_net))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
