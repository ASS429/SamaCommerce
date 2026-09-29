/* Retour haptique (vibration) — sans effet si non pris en charge. */

function vibrer(motif: number | number[]) {
  try { navigator.vibrate?.(motif) } catch { /* ignoré */ }
}

export const vibration = {
  toucher: () => vibrer(10),                // ajout au panier, +/- stock
  reussite: () => vibrer([12, 40, 18]),     // encaissement, enregistrement
  avertissement: () => vibrer([30, 20, 30]), // suppression, alerte
}
