import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export default function ScannerCodeBarres({ surLecture, surFermeture }: { surLecture: (code: string) => void; surFermeture: () => void }) {
  const lecteur = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    const scanner = new Html5Qrcode('lecteur-code-barres')
    lecteur.current = scanner
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      (decode) => { surLecture(decode); arreter() },
      () => {},
    ).catch((e) => { alert('Impossible d\'accéder à la caméra : ' + e); surFermeture() })

    return () => { arreter() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const arreter = () => {
    const s = lecteur.current
    if (s && s.isScanning) s.stop().then(() => s.clear()).catch(() => {})
  }

  /* Viseur : quatre coins et un balayage vert sur fond noir. Sans repère
     visuel, on ne sait pas où présenter l'étiquette et l'on croit la caméra
     cassée. Les coins montrent la zone utile, le trait montre que ça lit. */
  return (
    <div className="fenetre-calque" onClick={() => { arreter(); surFermeture() }}>
      <div className="fenetre-boite scan-fenetre" onClick={(e) => e.stopPropagation()}>
        <div className="fenetre-titre">📷 Scanner un code-barres</div>
        <div className="scan-scene">
          <div id="lecteur-code-barres" />
          <div className="scan-cadre" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="scan-laser" aria-hidden="true" />
        </div>
        <p className="scan-aide">Visez le code-barres — le produit est reconnu tout seul.</p>
        <button className="scan-fermer" onClick={() => { arreter(); surFermeture() }}>Fermer</button>
      </div>
    </div>
  )
}
