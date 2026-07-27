/* Notifications natives (Notification API). Le vrai Web Push serveur (VAPID)
   nécessite un déploiement + service worker push ; ici on couvre les
   notifications locales d'alerte stock, déclenchées côté client — testables. */

const FLAG = 'sc_notif'

export function notifSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}
export function notifEnabled() {
  return notifSupported() && localStorage.getItem(FLAG) === '1' && Notification.permission === 'granted'
}

/** Demande la permission et mémorise le choix. */
export async function enableNotifications(): Promise<boolean> {
  if (!notifSupported()) return false
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  const ok = perm === 'granted'
  localStorage.setItem(FLAG, ok ? '1' : '0')
  return ok
}
export function disableNotifications() {
  localStorage.setItem(FLAG, '0')
}

/** Notifie les produits en stock faible (tag → remplace, pas de spam). */
export function notifyStock(alertes: { produit: string; stock: number }[]) {
  if (!notifEnabled() || alertes.length === 0) return
  const apercu = alertes.slice(0, 4).map((a) => `${a.produit} (${a.stock})`).join(', ')
  try {
    new Notification('⚠️ Stock faible — SamaCommerce', {
      body: `${alertes.length} produit(s) à réapprovisionner : ${apercu}`,
      tag: 'sc-stock-faible',
    })
  } catch { /* ignore */ }
}
