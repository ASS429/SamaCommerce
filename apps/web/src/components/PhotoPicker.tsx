/* Sélecteur de photo des fiches.
 *
 * Un seul geste : on touche la grande vignette, l'appareil photo s'ouvre
 * (capture="environment" sur mobile). Aucun libellé n'est indispensable pour
 * comprendre : la vignette montre soit la photo, soit un gros 📷.
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
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const pick = async (file?: File | null) => {
    if (!file) return
    setBusy(true)
    try {
      onChange(await compressPhoto(file))
      toast('Photo ajoutée 📸', 'success')
    } catch (e) {
      toast(e instanceof PhotoError ? e.message : 'Photo illisible', 'error')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = '' // permet de reprendre le même fichier
    }
  }

  return (
    <div className="form-group">
      <label>{label}</label>
      <div className="photo-picker">
        <button type="button" className="photo-picker-btn" onClick={() => input.current?.click()} disabled={busy}
          aria-label={value ? 'Changer la photo' : 'Ajouter une photo'}>
          {busy
            ? <span className="photo-picker-busy">⏳</span>
            : <Avatar photo={value} icon={value ? undefined : (icon || '📷')} name={name} size={size} radius={18} />}
          <span className="photo-picker-badge" aria-hidden="true">📷</span>
        </button>
        <div className="photo-picker-side">
          <button type="button" className="badge-soft" onClick={() => input.current?.click()} disabled={busy}>
            {value ? '🔄 Changer' : '📷 Prendre une photo'}
          </button>
          {value && <button type="button" className="badge-soft photo-picker-del" onClick={() => onChange(null)}>🗑️ Retirer</button>}
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  )
}
