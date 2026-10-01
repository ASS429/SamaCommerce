import { api } from './api'

/* T11 — File d'attente hors ligne des ventes (IndexedDB).
 *
 * Au marché, le réseau tombe : une vente NE DOIT JAMAIS être perdue. On
 * l'enregistre localement avec un uuid d'appareil, puis on synchronise dès le
 * retour du réseau via POST /ventes/synchroniser (idempotent → aucun doublon
 * même en cas de rejeu). C'est LA fonctionnalité terrain n°1. */

const NOM_BASE = 'samacommerce_hors_ligne'
const MAGASIN = 'ventes_en_attente'
/** Événement émis à chaque changement de la file (compteur de l'en-tête). */
export const EVENEMENT_FILE = 'samacommerce:file-hors-ligne'

export type VenteEnAttente = {
  uuid_appareil: string
  produit_id: number
  conditionnement_id?: number | null
  quantite_base?: number | null
  quantite?: number | null
  prix_reel?: number | null
  moyen_paiement: string
  /** Fiche client rattachée (null = vente de passage). */
  client_id?: number | null
  nom_client?: string | null
  telephone_client?: string | null
  date_echeance?: string | null
  cree_le: string
  /** Résumé pour l'affichage local (« 2× Riz — 1000 F »). */
  libelle?: string
}

function ouvrirBase(): Promise<IDBDatabase> {
  return new Promise((resoudre, rejeter) => {
    const requete = indexedDB.open(NOM_BASE, 1)
    requete.onupgradeneeded = () => {
      const base = requete.result
      if (!base.objectStoreNames.contains(MAGASIN)) base.createObjectStore(MAGASIN, { keyPath: 'uuid_appareil' })
    }
    requete.onsuccess = () => resoudre(requete.result)
    requete.onerror = () => rejeter(requete.error)
  })
}

async function transaction<T>(mode: IDBTransactionMode, operation: (m: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const base = await ouvrirBase()
  return new Promise<T>((resoudre, rejeter) => {
    const magasin = base.transaction(MAGASIN, mode).objectStore(MAGASIN)
    const requete = operation(magasin)
    requete.onsuccess = () => resoudre(requete.result)
    requete.onerror = () => rejeter(requete.error)
  })
}

export function uuid(): string {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`)
}

export async function mettreEnFile(vente: VenteEnAttente): Promise<void> {
  await transaction('readwrite', (m) => m.put(vente))
  window.dispatchEvent(new CustomEvent(EVENEMENT_FILE))
}

export async function ventesEnAttente(): Promise<VenteEnAttente[]> {
  return (await transaction<VenteEnAttente[]>('readonly', (m) => m.getAll())) || []
}

export async function nombreVentesEnAttente(): Promise<number> {
  return (await transaction<number>('readonly', (m) => m.count())) || 0
}

async function retirerPlusieurs(uuids: (string | undefined)[]): Promise<void> {
  const base = await ouvrirBase()
  await new Promise<void>((resoudre, rejeter) => {
    const t = base.transaction(MAGASIN, 'readwrite')
    const magasin = t.objectStore(MAGASIN)
    uuids.filter(Boolean).forEach((u) => magasin.delete(u as string))
    t.oncomplete = () => resoudre()
    t.onerror = () => rejeter(t.error)
  })
  window.dispatchEvent(new CustomEvent(EVENEMENT_FILE))
}

let synchronisationEnCours = false

/** Envoie toutes les ventes en attente. Renvoie le nombre synchronisé, ou -1 si rien n'a pu partir. */
export async function synchroniserVentesEnAttente(): Promise<number> {
  if (synchronisationEnCours || !navigator.onLine) return -1
  const liste = await ventesEnAttente()
  if (liste.length === 0) return 0

  synchronisationEnCours = true
  try {
    const { data } = await api.post('/ventes/synchroniser', { ventes: liste })
    // On purge les ventes synchronisées ET les doublons (déjà côté serveur).
    await retirerPlusieurs([...(data.synchronisees ?? []), ...(data.doublons ?? [])])
    return (data.synchronisees ?? []).length
  } catch {
    return -1 // toujours hors ligne / serveur injoignable : on réessaiera
  } finally {
    synchronisationEnCours = false
  }
}

/** Branche la synchronisation automatique au retour du réseau. */
export function brancherSynchronisation(surChangement?: () => void): () => void {
  const declencher = () => { synchroniserVentesEnAttente().then(() => surChangement?.()) }
  window.addEventListener('online', declencher)
  const prevenir = () => surChangement?.()
  window.addEventListener(EVENEMENT_FILE, prevenir)
  if (navigator.onLine) declencher() // tentative au démarrage
  return () => {
    window.removeEventListener('online', declencher)
    window.removeEventListener(EVENEMENT_FILE, prevenir)
  }
}

/** Remise à zéro — tests uniquement. */
export function _reinitialiserFile(): void {
  synchronisationEnCours = false
}
