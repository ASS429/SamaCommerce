import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme.css'
import App from './App.tsx'
import { toast } from './lib/toast'
import { applyStoredTheme, watchSystemTheme } from './lib/theme'

// Thème : préférence enregistrée, sinon celle du téléphone (mode auto par
// défaut). Le watcher suit ensuite le passage jour/nuit du système en direct.
applyStoredTheme()
watchSystemTheme()

// Remplace les alert() natifs par des toasts stylés (succès/erreur/info auto)
window.alert = (msg?: unknown) => {
  const s = String(msg ?? '')
  const type = /erreur|impossible|refus|incorrect|insuffisant|invalide|échou|expir|requis|déjà/i.test(s)
    ? 'error'
    : /✅|succès|enregistr|mis à jour|créé|ajout|envoyé|clôtur|terminé|remb/i.test(s)
      ? 'success' : 'info'
  toast(s, type)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
