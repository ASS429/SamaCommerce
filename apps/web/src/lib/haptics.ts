/* Retour haptique (vibration) — sans effet si non supporté. */

function buzz(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern) } catch { /* ignore */ }
}

export const haptic = {
  tap: () => buzz(10),          // ajout panier, +/- stock
  success: () => buzz([12, 40, 18]), // encaissement, enregistrement
  warn: () => buzz([30, 20, 30]),    // suppression, alerte
}
