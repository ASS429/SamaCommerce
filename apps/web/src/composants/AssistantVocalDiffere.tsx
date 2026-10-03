import { lazy, Suspense, useEffect, useState } from 'react'
import { AssistantVocal as ApiAssistant, type EtatAssistant } from '../outils/assistantVocal'
import type { Ecran } from '../sections/Accueil'

/* Le code de l'assistant (micro, discussion, enregistreur, styles) n'est
   téléchargé que pour les commerçants qui y ont droit : les autres ne paient
   pas ces kilo-octets sur leurs données mobiles. Le serveur tranche
   (GET /assistant-vocal/etat), comme pour le reste des droits. */
const AssistantVocal = lazy(() => import('./AssistantVocal'))

type Proprietes = {
  bureau: boolean
  ecran: Ecran
  surNavigation: (ecran: Ecran) => void
}

export default function AssistantVocalDiffere(proprietes: Proprietes) {
  const [etat, definirEtat] = useState<EtatAssistant | null>(null)

  useEffect(() => {
    let actif = true
    ApiAssistant.etat().then((reponse) => { if (actif) definirEtat(reponse) }).catch(() => {})
    return () => { actif = false }
  }, [])

  if (!etat?.disponible) return null

  return (
    <Suspense fallback={null}>
      <AssistantVocal {...proprietes} etatInitial={etat} />
    </Suspense>
  )
}
