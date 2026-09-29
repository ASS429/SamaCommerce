/* Sélecteur de photo des fiches.
 *
 * DEUX chemins, pas un seul. L'attribut `capture` d'un `<input type="file">`
 * n'est pas une préférence : sur téléphone il ouvre DIRECTEMENT l'appareil
 * photo et supprime l'accès à la galerie. Une seule entrée `capture` rendait
 * donc impossible de réutiliser une photo déjà prise — celle du fournisseur
 * reçue par WhatsApp, le logo enregistré, la photo faite hier.
 *   • la grande vignette (et « Importer ») ouvre le sélecteur du téléphone,
 *     qui propose lui-même galerie ET appareil photo ;
 *   • « Prendre une photo » va droit à l'appareil, pour le geste du comptoir.
 *
 * La photo est facultative — jamais bloquante.
 */

import { useRef, useState } from 'react'
import { compresserPhoto, ErreurPhoto } from '../outils/photo'
import { bulle } from '../outils/bulles'
import Avatar from './Avatar'

export default function ChoixPhoto({ valeur, surChangement, icone, nom, libelle = 'Photo (facultatif)', taille = 84 }: {
  valeur: string | null
  surChangement: (photo: string | null) => void
  /** Pictogramme affiché tant qu'il n'y a pas de photo. */
  icone?: string
  nom?: string | null
  libelle?: string
  taille?: number
}) {
  /** Sans `capture` : le téléphone propose galerie ET appareil photo. */
  const libre = useRef<HTMLInputElement>(null)
  /** Avec `capture` : ouvre directement l'appareil photo. */
  const camera = useRef<HTMLInputElement>(null)
  const [occupe, definirOccupe] = useState(false)

  const choisir = async (fichier: File | undefined, champ: HTMLInputElement | null) => {
    if (!fichier) return
    definirOccupe(true)
    try {
      surChangement(await compresserPhoto(fichier))
      bulle('Photo ajoutée 📸', 'succes')
    } catch (e) {
      bulle(e instanceof ErreurPhoto ? e.message : 'Photo illisible', 'erreur')
    } finally {
      definirOccupe(false)
      if (champ) champ.value = '' // permet de reprendre le même fichier
    }
  }

  return (
    <div className="groupe-champ champ-photo">
      <label>{libelle}</label>
      <div className="choix-photo">
        <button type="button" className="choix-photo-bouton" onClick={() => libre.current?.click()} disabled={occupe}
          aria-label={valeur ? 'Changer la photo' : 'Ajouter une photo'}>
          {occupe
            ? <span className="choix-photo-occupe">⏳</span>
            : <Avatar photo={valeur} icone={valeur ? undefined : (icone || '📷')} nom={nom} taille={taille} rayon={18} />}
          <span className="choix-photo-pastille" aria-hidden="true">📷</span>
        </button>
        <div className="choix-photo-cote">
          <button type="button" className="pastille-douce" onClick={() => camera.current?.click()} disabled={occupe}>
            📷 Prendre une photo
          </button>
          <button type="button" className="pastille-douce choix-photo-importer" onClick={() => libre.current?.click()} disabled={occupe}>
            🖼️ Choisir dans le téléphone
          </button>
          {valeur && <button type="button" className="pastille-douce choix-photo-retirer" onClick={() => surChangement(null)}>🗑️ Retirer</button>}
        </div>
      </div>
      <input ref={libre} type="file" accept="image/*" hidden data-testid="photo-importer"
        onChange={(e) => choisir(e.target.files?.[0], libre.current)} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden data-testid="photo-camera"
        onChange={(e) => choisir(e.target.files?.[0], camera.current)} />
    </div>
  )
}
