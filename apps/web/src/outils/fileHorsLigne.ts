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
  await avantUsage()
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

/* ═══════════════ Reprise des ventes de l'ANCIENNE version ═══════════════
 *
 * TEMPORAIRE (retrait prévu trois mois après la francisation, cf. glossaire,
 * section 3). Avant la francisation, la file vivait dans une autre base, sous
 * des noms anglais. Une vente faite hors ligne juste avant la mise à jour, et
 * pas encore envoyée, y attend toujours : il faut la reprendre, sinon elle est
 * perdue sans que personne ne le sache.
 *
 * Ordre des opérations, choisi pour ne JAMAIS perdre une vente :
 *   1. lire les ventes de l'ancienne base ;
 *   2. les écrire, traduites, dans la nouvelle — et attendre la confirmation ;
 *   3. SEULEMENT ENSUITE effacer de l'ancienne base celles qu'on a recopiées.
 * Une panne entre 2 et 3 laisse un double, que le serveur écarte (l'uuid rend
 * l'envoi idempotent). L'ancienne base n'est pas supprimée : un onglet resté
 * sur l'ancienne version pourrait encore y écrire, et ses ventes seront reprises
 * au lancement suivant.
 */
const ANCIENNE_BASE = 'samacommerce_offline'
const ANCIEN_MAGASIN = 'pending_sales'

/** Ancien nom de champ → nouveau (la valeur ne change pas). */
const CHAMPS_ANCIENS: Record<string, keyof VenteEnAttente> = {
  client_uuid: 'uuid_appareil',
  product_id: 'produit_id',
  unit_id: 'conditionnement_id',
  quantite_base: 'quantite_base',
  quantity: 'quantite',
  prix_reel: 'prix_reel',
  payment_method: 'moyen_paiement',
  client_id: 'client_id',
  client_name: 'nom_client',
  client_phone: 'telephone_client',
  due_date: 'date_echeance',
  created_at: 'cree_le',
  label: 'libelle',
}

/** Traduit une vente enregistrée par l'ancienne version. */
export function traduireAncienneVente(ancienne: Record<string, unknown>): VenteEnAttente {
  const vente: Record<string, unknown> = {}
  for (const [ancien, nouveau] of Object.entries(CHAMPS_ANCIENS)) {
    if (ancien in ancienne) vente[nouveau] = ancienne[ancien]
  }
  return vente as VenteEnAttente
}

/** Ouvre l'ancienne base SANS la créer. `null` si elle n'a jamais existé. */
function ouvrirAncienneBase(): Promise<IDBDatabase | null> {
  return new Promise((resoudre) => {
    let requete: IDBOpenDBRequest
    try { requete = indexedDB.open(ANCIENNE_BASE) } catch { resoudre(null); return }
    // Une mise à niveau à l'ouverture = la base n'existait pas. On annule : la
    // spécification supprime alors la base à peine créée.
    requete.onupgradeneeded = () => { requete.transaction?.abort() }
    requete.onsuccess = () => resoudre(requete.result)
    requete.onerror = () => resoudre(null)
  })
}

export async function recupererVentesDeLAncienneVersion(): Promise<number> {
  const ancienne = await ouvrirAncienneBase()
  if (!ancienne) return 0
  try {
    if (!ancienne.objectStoreNames.contains(ANCIEN_MAGASIN)) return 0

    // 1. Lecture.
    const lues = await new Promise<Record<string, unknown>[]>((resoudre, rejeter) => {
      const requete = ancienne.transaction(ANCIEN_MAGASIN, 'readonly').objectStore(ANCIEN_MAGASIN).getAll()
      requete.onsuccess = () => resoudre(requete.result || [])
      requete.onerror = () => rejeter(requete.error)
    })
    const reprenables = lues.filter((v) => typeof v?.client_uuid === 'string')
    if (reprenables.length === 0) return 0

    // 2. Écriture dans la nouvelle base, confirmée.
    const base = await ouvrirBase()
    try {
      await new Promise<void>((resoudre, rejeter) => {
        const t = base.transaction(MAGASIN, 'readwrite')
        const magasin = t.objectStore(MAGASIN)
        reprenables.forEach((v) => magasin.put(traduireAncienneVente(v)))
        t.oncomplete = () => resoudre()
        t.onerror = () => rejeter(t.error)
        t.onabort = () => rejeter(t.error)
      })
    } finally { base.close() }

    // 3. Effacement de ce qui a été recopié — et de rien d'autre.
    await new Promise<void>((resoudre, rejeter) => {
      const t = ancienne.transaction(ANCIEN_MAGASIN, 'readwrite')
      const magasin = t.objectStore(ANCIEN_MAGASIN)
      reprenables.forEach((v) => magasin.delete(v.client_uuid as string))
      t.oncomplete = () => resoudre()
      t.onerror = () => rejeter(t.error)
    })
    window.dispatchEvent(new CustomEvent(EVENEMENT_FILE))
    return reprenables.length
  } finally {
    ancienne.close()
  }
}

/* Une seule reprise par lancement, faite AVANT toute lecture de la file : le
   compteur « ventes en attente » et la synchronisation voient donc aussi les
   ventes de l'ancienne version. En cas d'échec, on retentera au prochain usage. */
let reprise: Promise<void> | null = null
function avantUsage(): Promise<void> {
  reprise ??= recupererVentesDeLAncienneVersion().then(() => {}, () => { reprise = null })
  return reprise
}

/** Remise à zéro — tests uniquement. */
export function _reinitialiserFile(): void {
  reprise = null
  synchronisationEnCours = false
}
