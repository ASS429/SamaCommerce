import { fcfa } from '../lib/api'

/* Design 3.4 — Clôture de caisse : séquence « fin de journée ». Le fond passe en
 * crépuscule, les totaux se révèlent ligne par ligne comme un générique, puis le
 * rapport se scelle d'un tampon animé. Skippable (bouton + Échap). */

type Totals = { especes: number; wave: number; orange: number; credits: number; net: number; nb_ventes: number }

export default function ClotureScene({ today, onClose }: { today: Totals; onClose: () => void }) {
  const lines: [string, number][] = [
    ['💵 Espèces', today.especes],
    ['📱 Wave', today.wave],
    ['📞 Orange', today.orange],
    ['📝 Crédits', today.credits],
  ]
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="cloture-overlay" role="dialog" aria-modal="true" aria-label="Clôture de caisse" onClick={onClose}>
      <div className="cloture-card" onClick={(e) => e.stopPropagation()}>
        <div className="cloture-title">Clôture du jour</div>
        <div className="cloture-date">{date}</div>

        {lines.map(([label, val], i) => (
          <div key={label} className="cloture-line" style={{ animationDelay: `${0.15 + i * 0.35}s` }}>
            <span className="cll">{label}</span>
            <span className="clv">{fcfa(val)}</span>
          </div>
        ))}
        <div className="cloture-line cloture-total" style={{ animationDelay: `${0.15 + lines.length * 0.35}s` }}>
          <span className="cll">NET ENCAISSÉ · {today.nb_ventes} ventes</span>
          <span className="clv">{fcfa(today.net)}</span>
        </div>

        <div className="cloture-stamp" style={{ animationDelay: `${0.4 + lines.length * 0.35}s` }}>
          Journée<br />clôturée ✓
        </div>

        <div className="cloture-actions">
          <button className="btn-confirm" style={{ width: '100%' }} onClick={onClose}>Terminé</button>
        </div>
      </div>
    </div>
  )
}
