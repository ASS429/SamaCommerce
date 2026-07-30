import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export default function BarcodeScanner({ onScan, onClose }: { onScan: (code: string) => void; onClose: () => void }) {
  const ref = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    const scanner = new Html5Qrcode('barcode-reader')
    ref.current = scanner
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      (decoded) => { onScan(decoded); stop() },
      () => {},
    ).catch((e) => { alert('Impossible d\'accéder à la caméra : ' + e); onClose() })

    return () => { stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stop = () => {
    const s = ref.current
    if (s && s.isScanning) s.stop().then(() => s.clear()).catch(() => {})
  }

  /* Viseur : quatre coins et un balayage vert sur fond noir. Sans repère
     visuel, on ne sait pas où présenter l'étiquette et l'on croit la caméra
     cassée. Les coins montrent la zone utile, le trait montre que ça lit. */
  return (
    <div className="modal-overlay" onClick={() => { stop(); onClose() }}>
      <div className="modal-box scan-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">📷 Scanner un code-barres</div>
        <div className="scan-stage">
          <div id="barcode-reader" />
          <div className="scan-frame" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="scan-laser" aria-hidden="true" />
        </div>
        <p className="scan-hint">Visez le code-barres — le produit est reconnu tout seul.</p>
        <button className="scan-close" onClick={() => { stop(); onClose() }}>Fermer</button>
      </div>
    </div>
  )
}
