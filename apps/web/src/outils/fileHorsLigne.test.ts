/* La file des ventes hors ligne — et surtout la promesse faite au comptoir :
 * « une vente hors ligne en attente SURVIT à la mise à jour ».
 *
 * Scénario réel : le réseau tombe, le commerçant vend quand même (la vente
 * attend dans le téléphone), puis la nouvelle version arrive avant le retour
 * du réseau. L'ancienne version rangeait la file ailleurs, sous des noms
 * anglais. Sans reprise, cette vente serait perdue sans que personne ne le
 * sache. */

import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'
import {
  _reinitialiserFile, mettreEnFile, nombreVentesEnAttente, recupererVentesDeLAncienneVersion,
  synchroniserVentesEnAttente, traduireAncienneVente, ventesEnAttente,
} from './fileHorsLigne'

/** Ce que l'ancienne version rangeait dans sa file. */
const ANCIENNE_VENTE = {
  client_uuid: '0b3b1f7c-9d2e-4b8a-8f00-000000000001',
  product_id: 7, unit_id: null, quantite_base: 2, prix_reel: 250, payment_method: 'credit',
  client_id: 1, client_name: 'Fatou Diop', client_phone: '77 222 33 44', due_date: '2026-10-15',
  created_at: '2026-09-29T10:00:00.000Z', label: 'Jus bissap 2 pièce — 500 F',
}

/** Recrée la base de l'ancienne version, avec ses noms d'origine. */
function installerAncienneFile(ventes: Record<string, unknown>[]): Promise<void> {
  return new Promise((resoudre, rejeter) => {
    const requete = indexedDB.open('samacommerce_offline', 1)
    requete.onupgradeneeded = () => requete.result.createObjectStore('pending_sales', { keyPath: 'client_uuid' })
    requete.onsuccess = () => {
      const base = requete.result
      const t = base.transaction('pending_sales', 'readwrite')
      ventes.forEach((v) => t.objectStore('pending_sales').put(v))
      t.oncomplete = () => { base.close(); resoudre() }
      t.onerror = () => rejeter(t.error)
    }
    requete.onerror = () => rejeter(requete.error)
  })
}

/** Contenu restant dans l'ancienne file. */
function lireAncienneFile(): Promise<unknown[]> {
  return new Promise((resoudre, rejeter) => {
    const requete = indexedDB.open('samacommerce_offline')
    requete.onsuccess = () => {
      const base = requete.result
      const lecture = base.transaction('pending_sales', 'readonly').objectStore('pending_sales').getAll()
      lecture.onsuccess = () => { base.close(); resoudre(lecture.result) }
      lecture.onerror = () => rejeter(lecture.error)
    }
  })
}

/** Liste des bases présentes dans le navigateur. */
async function bases(): Promise<string[]> {
  return (await indexedDB.databases()).map((b) => b.name ?? '')
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory() // navigateur « neuf » à chaque test
  _reinitialiserFile()
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
})

describe('traduction d\'une vente de l\'ancienne version', () => {
  it('renomme chaque champ sans toucher aux valeurs', () => {
    expect(traduireAncienneVente(ANCIENNE_VENTE)).toEqual({
      uuid_appareil: ANCIENNE_VENTE.client_uuid,
      produit_id: 7, conditionnement_id: null, quantite_base: 2, prix_reel: 250, moyen_paiement: 'credit',
      client_id: 1, nom_client: 'Fatou Diop', telephone_client: '77 222 33 44', date_echeance: '2026-10-15',
      cree_le: '2026-09-29T10:00:00.000Z', libelle: 'Jus bissap 2 pièce — 500 F',
    })
  })
})

describe('une vente hors ligne en attente survit à la mise à jour', () => {
  it('reprend la vente de l\'ancienne file dans la nouvelle, puis l\'efface de l\'ancienne', async () => {
    await installerAncienneFile([ANCIENNE_VENTE])

    expect(await recupererVentesDeLAncienneVersion()).toBe(1)

    const reprises = await ventesEnAttente()
    expect(reprises).toHaveLength(1)
    expect(reprises[0].uuid_appareil).toBe(ANCIENNE_VENTE.client_uuid)
    expect(reprises[0].nom_client).toBe('Fatou Diop')
    expect(await lireAncienneFile()).toEqual([])
  })

  it('la compte dès le premier affichage du compteur « en attente »', async () => {
    await installerAncienneFile([ANCIENNE_VENTE, { ...ANCIENNE_VENTE, client_uuid: '0b3b1f7c-9d2e-4b8a-8f00-000000000002' }])
    // Aucun appel explicite à la reprise : la file la fait avant sa première lecture.
    expect(await nombreVentesEnAttente()).toBe(2)
  })

  it('l\'envoie au serveur au format français, et l\'oublie une fois acceptée', async () => {
    await installerAncienneFile([ANCIENNE_VENTE])
    let corps: { ventes: Record<string, unknown>[] } | null = null
    let adresse = ''
    api.defaults.adapter = async (config) => {
      adresse = config.url ?? ''
      corps = JSON.parse(config.data)
      return { data: { synchronisees: [ANCIENNE_VENTE.client_uuid], doublons: [], echecs: [] }, status: 200, statusText: '', headers: {}, config }
    }

    expect(await synchroniserVentesEnAttente()).toBe(1)

    expect(adresse).toBe('/ventes/synchroniser')
    expect(corps!.ventes[0]).toMatchObject({ uuid_appareil: ANCIENNE_VENTE.client_uuid, produit_id: 7, moyen_paiement: 'credit', date_echeance: '2026-10-15' })
    expect(corps!.ventes[0]).not.toHaveProperty('client_uuid')
    expect(await nombreVentesEnAttente()).toBe(0)
  })

  it('garde la vente si le serveur est injoignable (elle repartira plus tard)', async () => {
    await installerAncienneFile([ANCIENNE_VENTE])
    api.defaults.adapter = async () => { throw new Error('Network Error') }

    expect(await synchroniserVentesEnAttente()).toBe(-1)
    expect(await nombreVentesEnAttente()).toBe(1)
  })

  it('ne crée pas l\'ancienne base sur un téléphone qui ne l\'a jamais eue', async () => {
    expect(await recupererVentesDeLAncienneVersion()).toBe(0)
    expect(await bases()).not.toContain('samacommerce_offline')
  })

  it('n\'écrase pas une vente déjà enregistrée par la nouvelle version', async () => {
    await mettreEnFile({ uuid_appareil: 'nouvelle-vente', produit_id: 1, moyen_paiement: 'especes', cree_le: '2026-09-30T08:00:00Z' })
    await installerAncienneFile([ANCIENNE_VENTE])
    _reinitialiserFile() // simule un nouveau lancement
    expect(await nombreVentesEnAttente()).toBe(2)
  })
})
