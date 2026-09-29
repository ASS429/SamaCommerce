/* Notifications natives (Notification API). Le vrai Web Push serveur (VAPID)
   nécessite un déploiement + un service worker de notification ; ici on couvre
   les notifications locales d'alerte de stock, déclenchées côté client —
   testables. */

import type { AlerteStock } from './api'

const CLE = 'samacommerce_notifications'

export function notificationsPrisesEnCharge() {
  return typeof window !== 'undefined' && 'Notification' in window
}
export function notificationsActives() {
  return notificationsPrisesEnCharge() && localStorage.getItem(CLE) === '1' && Notification.permission === 'granted'
}

/** Demande la permission et mémorise le choix. */
export async function activerNotifications(): Promise<boolean> {
  if (!notificationsPrisesEnCharge()) return false
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  const accordee = permission === 'granted'
  localStorage.setItem(CLE, accordee ? '1' : '0')
  return accordee
}
export function desactiverNotifications() {
  localStorage.setItem(CLE, '0')
}

/** Notifie les produits en stock faible (étiquette → remplace, pas de rafale). */
export function notifierStock(alertes: AlerteStock[]) {
  if (!notificationsActives() || alertes.length === 0) return
  const apercu = alertes.slice(0, 4).map((a) => `${a.produit} (${a.stock})`).join(', ')
  try {
    new Notification('⚠️ Stock faible — SamaCommerce', {
      body: `${alertes.length} produit(s) à réapprovisionner : ${apercu}`,
      tag: 'samacommerce-stock-faible',
    })
  } catch { /* ignoré */ }
}
