import { fcfa, lireUtilisateur } from '../outils/api'
import Logo from './Logo'

export type LigneRecu = { nom: string; quantite: number; prix: number }

/** Reçu stylé, imprimable via window.print() (le CSS @media print isole .recu-impression). */
export default function FenetreRecu({ lignes, surFermeture, surWhatsapp }: {
  lignes: LigneRecu[]
  surFermeture: () => void
  surWhatsapp: () => void
}) {
  const boutique = lireUtilisateur()?.nom_commerce || 'Ma Boutique'
  const total = lignes.reduce((s, l) => s + l.prix * l.quantite, 0)
  const date = new Date().toLocaleString('fr-FR')

  return (
    <div className="fenetre-calque" onClick={surFermeture}>
      <div className="fenetre-boite" style={{ maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
        <div className="recu-impression">
          <div className="recu-entete">
            <Logo taille={44} style={{ margin: '0 auto 6px', borderRadius: 12 }} />
            <div className="recu-boutique">{boutique}</div>
            <div className="recu-infos">{date}</div>
          </div>
          <div className="recu-lignes">
            {lignes.map((l, i) => (
              <div key={i} className="recu-ligne">
                <span className="recu-ligne-nom">{l.nom} <span style={{ color: 'var(--attenue)' }}>×{l.quantite}</span></span>
                <span className="recu-ligne-montant">{fcfa(l.prix * l.quantite)}</span>
              </div>
            ))}
          </div>
          <div className="recu-total">
            <span className="recu-total-libelle">TOTAL</span>
            <span className="recu-total-valeur">{fcfa(total)}</span>
          </div>
          <div className="recu-merci">Merci de votre achat ! 🙏</div>
        </div>
        {/* WhatsApp d'abord : c'est par là que le reçu part réellement. Peu de
            boutiques ont une imprimante. */}
        <div className="fenetre-actions sans-impression">
          <button className="bouton-whatsapp" onClick={surWhatsapp}>💬 WhatsApp</button>
          <button className="bouton-annuler" style={{ flex: '0 0 auto', minWidth: 96 }} onClick={() => window.print()}>🖨️ Imprimer</button>
        </div>
        <button className="lien-connexion sans-impression" onClick={surFermeture}>Fermer</button>
      </div>
    </div>
  )
}
