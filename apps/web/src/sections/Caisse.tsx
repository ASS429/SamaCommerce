import { useEffect, useState } from 'react'
import { Caisse as Api, fcfa } from '../lib/api'
import { confirmAsync } from '../lib/toast'
import ClotureScene from '../components/ClotureScene'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function Caisse() {
  const [today, setToday] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [weekly, setWeekly] = useState<any[]>([])
  const [closing, setClosing] = useState(false)
  const [scene, setScene] = useState<any>(null) // Design 3.4 — séquence de clôture

  const load = () => { Api.today().then(setToday); Api.history().then(setHistory); Api.weekly().then(setWeekly) }
  useEffect(() => { load() }, [])

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

  const exportPdf = () => {
    const doc = new jsPDF(); doc.setFontSize(16); doc.text('SamaCommerce — Caisse', 14, 18); doc.setFontSize(10)
    doc.text(`Jour: especes ${fcfa(today.especes)}  wave ${fcfa(today.wave)}  orange ${fcfa(today.orange)}  net ${fcfa(today.net)}`, 14, 28)
    autoTable(doc, { startY: 36, head: [['Date', 'Especes', 'Wave', 'Orange', 'Net']], body: history.map((h) => [(h.date || '').slice(0, 10), fcfa(Number(h.total_especes)), fcfa(Number(h.total_wave)), fcfa(Number(h.total_orange)), fcfa(Number(h.total_net))]) })
    doc.save('caisse-samacommerce.pdf')
  }

  if (!today) return <div className="empty-state"><div className="empty-sub">Chargement…</div></div>
  const maxW = Math.max(1, ...weekly.map((d) => Number(d.total_encaisse)))

  return (
    <>
      {scene && <ClotureScene today={scene} onClose={() => setScene(null)} />}
      <div className="page-header"><h2>💰 Caisse du jour</h2><button className="btn-pdf" onClick={exportPdf}>📄 PDF</button></div>

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
