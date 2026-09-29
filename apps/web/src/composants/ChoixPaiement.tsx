import { fcfa } from '../outils/api'
import { MOYENS_PAIEMENT, type MoyenPaiement } from '../outils/paiements'

/* Sélecteur de moyen de paiement, avec les logos réels des opérateurs.
 * Utilisé pour l'encaissement ET le remboursement d'un crédit — auparavant
 * ce dernier demandait de TAPER « especes / wave / orange » au clavier, une
 * saisie fastidieuse et source de fautes au comptoir. */

export default function ChoixPaiement({ titre, montant, surChoix, surFermeture }: {
  titre: string
  montant?: number
  surChoix: (m: MoyenPaiement) => void
  surFermeture: () => void
}) {
  return (
    <div className="fenetre-calque" onClick={surFermeture}>
      <div className="fenetre-boite" onClick={(e) => e.stopPropagation()}>
        <div className="fenetre-titre">{titre}</div>

        {montant != null && (
          <div className="paiement-montant">
            <span className="paiement-montant-libelle">Montant</span>
            <span className="paiement-montant-valeur">{fcfa(montant)}</span>
          </div>
        )}

        {/* Même damier que l'encaissement : un seul geste à apprendre, qu'on
            encaisse une vente ou qu'on enregistre un remboursement. */}
        <div className="modes-paiement-grille">
          {MOYENS_PAIEMENT.map((m) => (
            <button key={m.id} className={`mode-paiement${m.teinte === 'especes' ? ' mode-paiement-especes' : ''}`} onClick={() => surChoix(m.id)}>
              {m.logo
                ? <img src={m.logo} alt="" width={30} height={30} loading="lazy" />
                : <span className="mode-paiement-icone" aria-hidden="true">{m.emoji}</span>}
              <span className="mode-paiement-corps"><span className="mode-paiement-titre">{m.libelle}</span><span className="mode-paiement-sous-titre">{m.sousTitre}</span></span>
            </button>
          ))}
        </div>

        <button className="bouton-annuler" style={{ width: '100%', marginTop: 10 }} onClick={surFermeture}>Annuler</button>
      </div>
    </div>
  )
}
