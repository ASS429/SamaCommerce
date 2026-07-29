/* Vignette d'identification, utilisée partout (produit, client, fournisseur,
 * employé, boutique). Ordre de repli : PHOTO → PICTOGRAMME → INITIALES.
 * L'image prime toujours sur le texte : c'est elle que reconnaît un utilisateur
 * qui ne lit pas. */

import { initials } from '../lib/photo'
import { productTint } from '../lib/productIcon'

export default function Avatar({ photo, icon, name, size = 46, radius, className = '', tint }: {
  /** data-URL enregistrée sur la fiche (facultative). */
  photo?: string | null
  /** Pictogramme de repli (emoji de catégorie, 🚚, 👤…). */
  icon?: string | null
  /** Nom : sert aux initiales et à la teinte de fond. */
  name?: string | null
  size?: number
  /** Rayon des coins ; par défaut ~30 % (carré très arrondi). */
  radius?: number
  className?: string
  tint?: string
}) {
  const r = radius ?? Math.round(size * 0.3)
  const base: React.CSSProperties = {
    width: size, height: size, borderRadius: r, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  }

  if (photo) {
    return (
      <span className={`sc-avatar ${className}`} style={base}>
        <img src={photo} alt="" loading="lazy" decoding="async"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </span>
    )
  }

  return (
    <span className={`sc-avatar ${className}`} aria-hidden="true"
      style={{ ...base, background: tint || productTint(name), fontSize: Math.round(size * 0.5), lineHeight: 1 }}>
      {icon || <span className="sora" style={{ fontSize: Math.round(size * 0.36), fontWeight: 800, color: 'var(--brand-dark)' }}>{initials(name)}</span>}
    </span>
  )
}
