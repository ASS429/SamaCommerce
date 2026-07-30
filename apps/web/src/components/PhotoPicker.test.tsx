import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PhotoPicker from './PhotoPicker'

/* `capture` n'est pas une préférence : sur téléphone il ouvre DIRECTEMENT
   l'appareil photo et retire l'accès à la galerie. Le sélecteur doit donc
   toujours exposer une entrée SANS `capture`, sinon on ne peut plus réutiliser
   une photo déjà prise (celle reçue par WhatsApp, le logo enregistré…). */
describe('PhotoPicker — importer autant que photographier', () => {
  const monter = () => render(<PhotoPicker value={null} onChange={vi.fn()} />)

  it('propose une entrée sans capture (galerie et fichiers)', () => {
    monter()
    const importer = screen.getByTestId('photo-import')
    expect(importer).toHaveAttribute('accept', 'image/*')
    expect(importer).not.toHaveAttribute('capture')
  })

  it('garde un accès direct à l\'appareil photo', () => {
    monter()
    expect(screen.getByTestId('photo-camera')).toHaveAttribute('capture', 'environment')
  })

  it('offre les deux gestes en toutes lettres', () => {
    monter()
    expect(screen.getByText(/Prendre une photo/i)).toBeInTheDocument()
    expect(screen.getByText(/Choisir dans le téléphone/i)).toBeInTheDocument()
  })

  /* La grande vignette est la cible la plus facile à viser : elle doit ouvrir
     le sélecteur qui propose LES DEUX, pas l'appareil photo seul. */
  it('fait ouvrir le sélecteur complet par la vignette', () => {
    monter()
    const vignette = screen.getByLabelText('Ajouter une photo')
    const clicImport = vi.spyOn(screen.getByTestId('photo-import'), 'click')
    const clicCamera = vi.spyOn(screen.getByTestId('photo-camera'), 'click')
    vignette.click()
    expect(clicImport).toHaveBeenCalled()
    expect(clicCamera).not.toHaveBeenCalled()
  })

  it('ne propose « Retirer » que s\'il y a une photo', () => {
    const { rerender } = render(<PhotoPicker value={null} onChange={vi.fn()} />)
    expect(screen.queryByText(/Retirer/i)).toBeNull()
    rerender(<PhotoPicker value="data:image/webp;base64,AA" onChange={vi.fn()} />)
    expect(screen.getByText(/Retirer/i)).toBeInTheDocument()
  })
})
