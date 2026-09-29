import { fcfa } from '../outils/api'

/* Design 3.4 — Clôture de caisse : séquence « fin de journée ». Le fond passe en
 * crépuscule, les totaux se révèlent ligne par ligne comme un générique, puis le
 * rapport se scelle d'un tampon animé. Interruptible (bouton + Échap). */

type Totaux = { especes: number; wave: number; orange: number; credits: number; net: number; nb_ventes: number }

export default function SceneCloture({ jour, surFermeture }: { jour: Totaux; surFermeture: () => void }) {
  const lignes: [string, number][] = [
    ['💵 Espèces', jour.especes],
    ['📱 Wave', jour.wave],
    ['📞 Orange', jour.orange],
    ['📝 Crédits', jour.credits],
  ]
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="cloture-calque" role="dialog" aria-modal="true" aria-label="Clôture de caisse" onClick={surFermeture}>
      <div className="cloture-carte" onClick={(e) => e.stopPropagation()}>
        <div className="cloture-titre">Clôture du jour</div>
        <div className="cloture-date">{date}</div>

        {lignes.map(([libelle, valeur], i) => (
          <div key={libelle} className="cloture-ligne" style={{ animationDelay: `${0.15 + i * 0.35}s` }}>
            <span className="cloture-libelle">{libelle}</span>
            <span className="cloture-valeur">{fcfa(valeur)}</span>
          </div>
        ))}
        <div className="cloture-ligne cloture-total" style={{ animationDelay: `${0.15 + lignes.length * 0.35}s` }}>
          <span className="cloture-libelle">NET ENCAISSÉ · {jour.nb_ventes} ventes</span>
          <span className="cloture-valeur">{fcfa(jour.net)}</span>
        </div>

        <div className="cloture-tampon" style={{ animationDelay: `${0.4 + lignes.length * 0.35}s` }}>
          Journée<br />clôturée ✓
        </div>

        <div className="cloture-actions">
          <button className="bouton-valider" style={{ width: '100%' }} onClick={surFermeture}>Terminé</button>
        </div>
      </div>
    </div>
  )
}
