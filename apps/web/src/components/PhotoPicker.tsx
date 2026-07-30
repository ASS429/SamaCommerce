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
import { compressPhoto, PhotoError } from '../lib/photo'
import { toast } from '../lib/toast'
import Avatar from './Avatar'

export default function PhotoPicker({ value, onChange, icon, name, label = 'Photo (facultatif)', size = 84 }: {
  value: string | null
  onChange: (photo: string | null) => void
  /** Pictogramme affiché tant qu'il n'y a pas de photo. */
  icon?: string
  name?: string | null
  label?: string
  size?: number
}) {
  /** Sans `capture` : le téléphone propose galerie ET appareil photo. */
  const libre = useRef<HTMLInputElement>(null)
  /** Avec `capture` : ouvre directement l'appareil photo. */
  const camera = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const pick = async (file: File | undefined, input: HTMLInputElement | null) => {
    if (!file) return
    setBusy(true)
    try {
      onChange(await compressPhoto(file))
      toast('Photo ajoutée 📸', 'success')
    } catch (e) {
      toast(e instanceof PhotoError ? e.message : 'Photo illisible', 'error')
    } finally {
      setBusy(false)
      if (input) input.value = '' // permet de reprendre le même fichier
    }
  }

  return (
    <div className="form-group photo-field">
      <label>{label}</label>
      <div className="photo-picker">
        <button type="button" className="photo-picker-btn" onClick={() => libre.current?.click()} disabled={busy}
          aria-label={value ? 'Changer la photo' : 'Ajouter une photo'}>
          {busy
            ? <span className="photo-picker-busy">⏳</span>
            : <Avatar photo={value} icon={value ? undefined : (icon || '📷')} name={name} size={size} radius={18} />}
          <span className="photo-picker-badge" aria-hidden="true">📷</span>
        </button>
        <div className="photo-picker-side">
          <button type="button" className="badge-soft" onClick={() => camera.current?.click()} disabled={busy}>
            📷 Prendre une photo
          </button>
          <button type="button" className="badge-soft photo-picker-import" onClick={() => libre.current?.click()} disabled={busy}>
            🖼️ Choisir dans le téléphone
          </button>
          {value && <button type="button" className="badge-soft photo-picker-del" onClick={() => onChange(null)}>🗑️ Retirer</button>}
        </div>
      </div>
      <input ref={libre} type="file" accept="image/*" hidden data-testid="photo-import"
        onChange={(e) => pick(e.target.files?.[0], libre.current)} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden data-testid="photo-camera"
        onChange={(e) => pick(e.target.files?.[0], camera.current)} />
    </div>
  )
}
