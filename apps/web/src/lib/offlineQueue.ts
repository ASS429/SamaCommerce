import { api } from './api'

/* T11 — File d'attente hors-ligne des ventes (IndexedDB).
 *
 * Au marché, le réseau tombe : une vente NE DOIT JAMAIS être perdue. On
 * l'enregistre localement avec un uuid client, puis on synchronise dès le retour
 * du réseau via POST /sales/sync (idempotent → aucun doublon même en cas de
 * rejeu). C'est LA fonctionnalité terrain n°1. */

const DB_NAME = 'samacommerce_offline'
const STORE = 'pending_sales'

export type PendingSale = {
  client_uuid: string
  product_id: number
  unit_id?: number | null
  quantite_base?: number | null
  quantity?: number | null
  prix_reel?: number | null
  payment_method: string
  client_name?: string | null
  client_phone?: string | null
  due_date?: string | null
  created_at: string
  /** Résumé pour l'affichage local (« 2× Riz — 1000 F »). */
  label?: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'client_uuid' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then((db) => new Promise<T>((resolve, reject) => {
    const store = db.transaction(STORE, mode).objectStore(STORE)
    const r = fn(store)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  }))
}

export function uuid(): string {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`)
}

export async function enqueueSale(sale: PendingSale): Promise<void> {
  await tx('readwrite', (s) => s.put(sale))
  window.dispatchEvent(new CustomEvent('offline-queue-changed'))
}

export async function pendingSales(): Promise<PendingSale[]> {
  return (await tx<PendingSale[]>('readonly', (s) => s.getAll())) || []
}

export async function pendingCount(): Promise<number> {
  return (await tx<number>('readonly', (s) => s.count())) || 0
}

async function removeMany(uuids: (string | undefined)[]): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite')
    const store = t.objectStore(STORE)
    uuids.filter(Boolean).forEach((u) => store.delete(u as string))
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
  window.dispatchEvent(new CustomEvent('offline-queue-changed'))
}

let syncing = false

/** Envoie toutes les ventes en attente. Retourne le nb synchronisé, ou -1 si rien/echec. */
export async function syncPending(): Promise<number> {
  if (syncing || !navigator.onLine) return -1
  const list = await pendingSales()
  if (list.length === 0) return 0

  syncing = true
  try {
    const { data } = await api.post('/sales/sync', { sales: list })
    // On purge les ventes synchronisées ET les doublons (déjà côté serveur).
    await removeMany([...(data.synced ?? []), ...(data.duplicates ?? [])])
    return (data.synced ?? []).length
  } catch {
    return -1 // toujours hors-ligne / serveur injoignable : on réessaiera
  } finally {
    syncing = false
  }
}

/** Branche la synchronisation automatique au retour du réseau. */
export function initOfflineSync(onChange?: () => void): () => void {
  const trigger = () => { syncPending().then(() => onChange?.()) }
  window.addEventListener('online', trigger)
  const notify = () => onChange?.()
  window.addEventListener('offline-queue-changed', notify)
  if (navigator.onLine) trigger() // tentative au démarrage
  return () => {
    window.removeEventListener('online', trigger)
    window.removeEventListener('offline-queue-changed', notify)
  }
}
