/* Vérification en deux étapes : un seul parcours, pour le commerçant (Profil)
   comme pour l'administrateur (panneau d'administration). */

import { basculerDoubleFacteur, confirmerDoubleFacteur, enregistrerUtilisateur, lireUtilisateur } from './api'
import { bulle, demanderSaisie } from './bulles'

/**
 * Bascule l'option depuis l'état `actuel` et renvoie le nouvel état, toujours
 * conforme au serveur. Désactiver est immédiat. Activer n'aboutit qu'avec le
 * code reçu par e-mail : c'est la preuve que les codes arrivent. (Jusqu'au
 * 30/09/2026, l'option s'activait d'un clic et aucun code ne partait jamais —
 * le compte ne pouvait plus se connecter depuis un autre appareil.)
 * Chaque issue est annoncée par une bulle.
 */
export async function basculerVerificationDeuxEtapes(actuel: boolean): Promise<boolean> {
  try {
    if (actuel) {
      await basculerDoubleFacteur(false)
      memoriser(false); bulle('2FA désactivée', 'succes')
      return false
    }
    const reponse = await basculerDoubleFacteur(true)
    if (!reponse.double_facteur_actif) {
      const code = await demanderSaisie(reponse.message || 'Saisissez le code reçu par e-mail',
        reponse.code_dev ? `Code (dev) : ${reponse.code_dev}` : '123456', '', true)
      if (!code?.trim()) { bulle('Activation annulée : la 2FA reste désactivée', 'info'); return false }
      await confirmerDoubleFacteur(code.trim())
    }
    memoriser(true); bulle('2FA activée 🔐', 'succes')
    return true
  } catch (e: any) {
    // Message long (il dit quoi faire) : laissé à l'écran le temps de le lire.
    bulle(e?.response?.data?.erreur || e?.response?.data?.errors?.code?.[0] || 'Erreur', 'erreur', { duree: 8000 })
    return actuel
  }
}

/** L'état est gardé dans la session enregistrée : il s'affiche au prochain lancement. */
function memoriser(actif: boolean) {
  const actuel = lireUtilisateur()
  if (actuel) enregistrerUtilisateur({ ...actuel, double_facteur_actif: actif })
}
