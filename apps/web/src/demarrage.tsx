// EN PREMIER : reprise du stockage laissé par l'ancienne version (session,
// code PIN, réglages…). Doit précéder tout module qui lit le stockage à son
// import — cf. outils/migrationAuDemarrage.ts.
import './outils/migrationAuDemarrage'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme.css'
import Application from './Application.tsx'
import { bulle } from './outils/bulles'
import { appliquerThemeEnregistre, suivreThemeSysteme } from './outils/theme'
import { installerRapporteurErreurs } from './outils/rapporteurErreurs'
import BarriereErreur from './composants/BarriereErreur'
import { QueryClientProvider } from '@tanstack/react-query'
import { creerClientRequetes } from './outils/requetes'
import { capturerInvitationDepuisAdresse } from './outils/invitation'

// Branché AVANT tout le reste : une erreur survenue au tout premier affichage
// est justement celle qu'on ne verrait jamais autrement.
installerRapporteurErreurs()

// Thème : préférence enregistrée, sinon celle du téléphone (mode auto par
// défaut). L'écoute suit ensuite le passage jour/nuit du système en direct.
appliquerThemeEnregistre()
suivreThemeSysteme()

// Lien d'invitation d'un employé : on saisit le jeton AVANT le premier rendu et
// on nettoie l'adresse, pour qu'un rechargement ne rejoue pas l'invitation.
capturerInvitationDepuisAdresse()

// Remplace les alert() natifs par des bulles stylées (succès/erreur/info auto)
window.alert = (message?: unknown) => {
  const texte = String(message ?? '')
  const type = /erreur|impossible|refus|incorrect|insuffisant|invalide|échou|expir|requis|déjà/i.test(texte)
    ? 'erreur'
    : /✅|succès|enregistr|mis à jour|créé|ajout|envoyé|clôtur|terminé|remb/i.test(texte)
      ? 'succes' : 'info'
  bulle(texte, type)
}

// Cache partagé des listes de référence (produits, catégories) : voir outils/requetes.ts
const clientRequetes = creerClientRequetes()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BarriereErreur>
      <QueryClientProvider client={clientRequetes}>
        <Application />
      </QueryClientProvider>
    </BarriereErreur>
  </StrictMode>,
)
