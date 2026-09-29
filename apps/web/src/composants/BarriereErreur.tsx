/* Filet de sécurité de dernier recours.
 *
 * Sans lui, une exception pendant le rendu React laisse un ÉCRAN BLANC : pour
 * un commerçant, l'application « ne marche plus », sans un mot d'explication —
 * exactement le mal qu'on a corrigé sur les chargements de section, mais en
 * pire. Ici on affiche un écran compréhensible sans savoir lire (gros
 * pictogramme, un bouton) et on signale l'erreur au serveur.
 *
 * `getDerivedStateFromError`, `componentDidCatch` et `render` gardent leur nom :
 * c'est React qui les appelle, par ce nom exact.
 */

import { Component, type ReactNode } from 'react'
import { signalerErreur } from '../outils/rapporteurErreurs'

type Proprietes = { children: ReactNode }
type Etat = { plantage: boolean }

export default class BarriereErreur extends Component<Proprietes, Etat> {
  state: Etat = { plantage: false }

  static getDerivedStateFromError(): Etat {
    return { plantage: true }
  }

  componentDidCatch(erreur: Error, infos: { componentStack?: string | null }) {
    signalerErreur({
      message: erreur.message,
      // La pile des composants dit QUEL écran a cassé — c'est ce qui manque
      // le plus quand on lit un rapport d'erreur React.
      pile: `${erreur.stack || ''}\n--- composants ---${infos.componentStack || ''}`,
      url: location.pathname,
      type: 'react',
    })
  }

  render() {
    if (!this.state.plantage) return this.props.children

    return (
      <div className="ecran-plantage" role="alert">
        <div className="plantage-icone" aria-hidden="true">😵</div>
        <div className="plantage-titre">L'application s'est arrêtée</div>
        <div className="plantage-aide">
          Vos ventes enregistrées sont intactes. Rouvrez l'application pour continuer.
        </div>
        <button className="erreur-chargement-reessayer" onClick={() => window.location.reload()}>
          🔄 Rouvrir
        </button>
      </div>
    )
  }
}
