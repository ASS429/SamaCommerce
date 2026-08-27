/* Bloc « le chargement a échoué », affiché À LA PLACE de l'état vide.
 *
 * La distinction est tout l'enjeu : « Aucun produit » et « je n'ai pas pu lire
 * vos produits » se ressemblaient à l'écran alors qu'ils demandent deux
 * réactions opposées — ajouter un article, ou réessayer. */

import type { LoadErrorInfo } from '../lib/loadError'

export default function LoadError({ error, onRetry, compact = false }: {
  error: LoadErrorInfo
  onRetry?: () => void
  /** Bandeau d'une ligne, quand des données ont malgré tout pu s'afficher. */
  compact?: boolean
}) {
  if (compact) {
    return (
      <div className={`load-error load-error--compact tone-${error.kind}`} role="alert">
        <span className="load-error-icon" aria-hidden="true">{error.icon}</span>
        <span className="load-error-title">{error.title}</span>
        {onRetry && <button className="load-error-retry" onClick={onRetry}>🔄 Réessayer</button>}
      </div>
    )
  }

  return (
    <div className={`load-error tone-${error.kind}`} role="alert">
      <div className="load-error-icon" aria-hidden="true">{error.icon}</div>
      <div className="load-error-title">{error.title}</div>
      <div className="load-error-hint">{error.hint}</div>
      {onRetry && <button className="load-error-retry" onClick={onRetry}>🔄 Réessayer</button>}
    </div>
  )
}
