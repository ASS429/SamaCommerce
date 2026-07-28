/* Logo de la marque SamaCommerce.
 *
 * À utiliser partout où l'on représente l'APPLICATION (connexion, barre latérale,
 * reçu, accueil). L'emoji 🏪 reste réservé à la BOUTIQUE DE L'UTILISATEUR
 * (sélecteur de boutique, fiche « Ma boutique »), dont il choisit lui-même
 * l'emoji.
 *
 * Deux fichiers seulement (64 px et 128 px, quelques Ko) : on sert le plus petit
 * suffisant, important pour les connexions lentes.
 */
export default function Logo({ size = 40, className = '', style }: {
  size?: number
  className?: string
  style?: React.CSSProperties
}) {
  const src = size <= 64 ? '/logo-64.png' : '/logo-128.png'

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="SamaCommerce"
      className={className}
      loading="eager"
      decoding="async"
      style={{ display: 'block', objectFit: 'contain', ...style }}
    />
  )
}
