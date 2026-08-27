/* Filet de sécurité de dernier recours.
 *
 * Sans lui, une exception pendant le rendu React laisse un ÉCRAN BLANC : pour
 * un commerçant, l'application « ne marche plus », sans un mot d'explication —
 * exactement le mal qu'on a corrigé sur les chargements de section, mais en
 * pire. Ici on affiche un écran compréhensible sans savoir lire (gros
 * pictogramme, un bouton) et on signale l'erreur au serveur.
 */

import { Component, type ReactNode } from 'react'
import { reportError } from '../lib/errorReporter'

type Props = { children: ReactNode }
type State = { crashed: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError(): State {
    return { crashed: true }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    reportError({
      message: error.message,
      // La pile des composants dit QUEL écran a cassé — c'est ce qui manque
      // le plus quand on lit un rapport d'erreur React.
      stack: `${error.stack || ''}\n--- composants ---${info.componentStack || ''}`,
      url: location.pathname,
      kind: 'react',
    })
  }

  render() {
    if (!this.state.crashed) return this.props.children

    return (
      <div className="crash-screen" role="alert">
        <div className="crash-icon" aria-hidden="true">😵</div>
        <div className="crash-title">L'application s'est arrêtée</div>
        <div className="crash-hint">
          Vos ventes enregistrées sont intactes. Rouvrez l'application pour continuer.
        </div>
        <button className="load-error-retry" onClick={() => window.location.reload()}>
          🔄 Rouvrir
        </button>
      </div>
    )
  }
}
