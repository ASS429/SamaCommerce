import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme.css'
import App from './App.tsx'
import { toast } from './lib/toast'
import { applyStoredTheme, watchSystemTheme } from './lib/theme'
import { installErrorReporter } from './lib/errorReporter'
import ErrorBoundary from './components/ErrorBoundary'
import { QueryClientProvider } from '@tanstack/react-query'
import { creerQueryClient } from './lib/queries'
import { captureInviteFromUrl } from './lib/invite'

// Branché AVANT tout le reste : une erreur survenue au tout premier affichage
// est justement celle qu'on ne verrait jamais autrement.
installErrorReporter()

// Thème : préférence enregistrée, sinon celle du téléphone (mode auto par
// défaut). Le watcher suit ensuite le passage jour/nuit du système en direct.
applyStoredTheme()
watchSystemTheme()

// Lien d'invitation d'un employé : on saisit le jeton AVANT le premier rendu et
// on nettoie l'adresse, pour qu'un rechargement ne rejoue pas l'invitation.
captureInviteFromUrl()

// Remplace les alert() natifs par des toasts stylés (succès/erreur/info auto)
window.alert = (msg?: unknown) => {
  const s = String(msg ?? '')
  const type = /erreur|impossible|refus|incorrect|insuffisant|invalide|échou|expir|requis|déjà/i.test(s)
    ? 'error'
    : /✅|succès|enregistr|mis à jour|créé|ajout|envoyé|clôtur|terminé|remb/i.test(s)
      ? 'success' : 'info'
  toast(s, type)
}

// Cache partage des listes de reference (produits, categories) : voir lib/queries.ts
const queryClient = creerQueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
