/* Vignette d'identification, utilisée partout (produit, client, fournisseur,
 * employé, boutique). Ordre de repli : PHOTO → PICTOGRAMME → INITIALES.
 * L'image prime toujours sur le texte : c'est elle que reconnaît un utilisateur
 * qui ne lit pas. */

import { initiales } from '../outils/photo'
import { fondProduit } from '../outils/iconeProduit'

export default function Avatar({ photo, icone, nom, taille = 46, rayon, className = '', fond }: {
  /** data-URL enregistrée sur la fiche (facultative). */
  photo?: string | null
  /** Pictogramme de repli (emoji de catégorie, 🚚, 👤…). */
  icone?: string | null
  /** Nom : sert aux initiales et à la teinte de fond. */
  nom?: string | null
  taille?: number
  /** Rayon des coins ; par défaut ~30 % (carré très arrondi). */
  rayon?: number
  className?: string
  fond?: string
}) {
  const r = rayon ?? Math.round(taille * 0.3)
  const base: React.CSSProperties = {
    width: taille, height: taille, borderRadius: r, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  }

  if (photo) {
    return (
      <span className={`avatar ${className}`} style={base}>
        <img src={photo} alt="" loading="lazy" decoding="async"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </span>
    )
  }

  return (
    <span className={`avatar ${className}`} aria-hidden="true"
      style={{ ...base, background: fond || fondProduit(nom), fontSize: Math.round(taille * 0.5), lineHeight: 1 }}>
      {icone || <span className="police-titre" style={{ fontSize: Math.round(taille * 0.36), fontWeight: 800, color: 'var(--marque-fonce)' }}>{initiales(nom)}</span>}
    </span>
  )
}
