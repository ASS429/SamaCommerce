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

  return (
    <div className="modal-overlay" onClick={() => { stop(); onClose() }}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
        <div className="modal-title">📷 Scanner un code-barres</div>
        <div id="barcode-reader" style={{ width: '100%', borderRadius: 12, overflow: 'hidden' }} />
        <button className="btn-cancel" style={{ width: '100%', marginTop: 14 }} onClick={() => { stop(); onClose() }}>Fermer</button>
      </div>
    </div>
  )
}
