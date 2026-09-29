/* Logo de la marque SamaCommerce.
 *
 * À utiliser partout où l'on représente l'APPLICATION (connexion, colonne
 * latérale, reçu, accueil). L'emoji 🏪 reste réservé à la BOUTIQUE DE
 * L'UTILISATEUR (sélecteur de boutique, fiche « Ma boutique »), dont il choisit
 * lui-même l'emoji.
 *
 * Deux fichiers seulement (64 px et 128 px, quelques Ko) : on sert le plus petit
 * suffisant, important pour les connexions lentes.
 */
export default function Logo({ taille = 40, className = '', style }: {
  taille?: number
  className?: string
  style?: React.CSSProperties
}) {
  const source = taille <= 64 ? '/logo-64.png' : '/logo-128.png'

  return (
    <img
      src={source}
      width={taille}
      height={taille}
      alt="SamaCommerce"
      className={className}
      loading="eager"
      decoding="async"
      style={{ display: 'block', objectFit: 'contain', ...style }}
    />
  )
}
