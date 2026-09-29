/* Bloc « le chargement a échoué », affiché À LA PLACE de l'état vide.
 *
 * La distinction est tout l'enjeu : « Aucun produit » et « je n'ai pas pu lire
 * vos produits » se ressemblaient à l'écran alors qu'ils demandent deux
 * réactions opposées — ajouter un article, ou réessayer. */

import type { InfosErreurChargement } from '../outils/erreursChargement'

export default function ErreurChargement({ erreur, surReessai, compacte = false }: {
  erreur: InfosErreurChargement
  surReessai?: () => void
  /** Bandeau d'une ligne, quand des données ont malgré tout pu s'afficher. */
  compacte?: boolean
}) {
  if (compacte) {
    return (
      <div className={`erreur-chargement erreur-chargement--compacte teinte-${erreur.type}`} role="alert">
        <span className="erreur-chargement-icone" aria-hidden="true">{erreur.icone}</span>
        <span className="erreur-chargement-titre">{erreur.titre}</span>
        {surReessai && <button className="erreur-chargement-reessayer" onClick={surReessai}>🔄 Réessayer</button>}
      </div>
    )
  }

  return (
    <div className={`erreur-chargement teinte-${erreur.type}`} role="alert">
      <div className="erreur-chargement-icone" aria-hidden="true">{erreur.icone}</div>
      <div className="erreur-chargement-titre">{erreur.titre}</div>
      <div className="erreur-chargement-aide">{erreur.conseil}</div>
      {surReessai && <button className="erreur-chargement-reessayer" onClick={surReessai}>🔄 Réessayer</button>}
    </div>
  )
}
