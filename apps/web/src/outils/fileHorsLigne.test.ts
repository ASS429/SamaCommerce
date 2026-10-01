/* La file des ventes hors ligne — la promesse faite au comptoir : une vente
 * faite sans réseau attend dans le téléphone, part au retour du réseau, et
 * n'est oubliée qu'une fois reçue par le serveur (ou reconnue comme déjà
 * reçue). Jamais avant. */

import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'
import {
  _reinitialiserFile, mettreEnFile, nombreVentesEnAttente, synchroniserVentesEnAttente, ventesEnAttente,
  type VenteEnAttente,
} from './fileHorsLigne'

const VENTE: VenteEnAttente = {
  uuid_appareil: '0b3b1f7c-9d2e-4b8a-8f00-000000000001',
  produit_id: 7, conditionnement_id: null, quantite_base: 2, prix_reel: 250, moyen_paiement: 'credit',
  client_id: 1, nom_client: 'Fatou Diop', telephone_client: '77 222 33 44', date_echeance: '2026-10-15',
  cree_le: '2026-09-29T10:00:00.000Z', libelle: 'Jus bissap 2 pièce — 500 F',
}

/** Réponse simulée du serveur à POST /ventes/synchroniser. */
function serveurRepond(reponse: { synchronisees?: string[]; doublons?: string[]; echecs?: unknown[] }) {
  const appels: { adresse: string; corps: { ventes: VenteEnAttente[] } }[] = []
  api.defaults.adapter = async (requete) => {
    appels.push({ adresse: requete.url ?? '', corps: JSON.parse(requete.data) })
    return { data: { synchronisees: [], doublons: [], echecs: [], ...reponse }, status: 200, statusText: '', headers: {}, config: requete }
  }
  return appels
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory() // navigateur « neuf » à chaque test
  _reinitialiserFile()
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
})

describe('file des ventes hors ligne', () => {
  it('garde la vente dans le téléphone et la compte', async () => {
    await mettreEnFile(VENTE)

    expect(await nombreVentesEnAttente()).toBe(1)
    expect(await ventesEnAttente()).toEqual([VENTE])
  })

  it('l\'envoie au serveur au retour du réseau, et l\'oublie une fois reçue', async () => {
    await mettreEnFile(VENTE)
    const appels = serveurRepond({ synchronisees: [VENTE.uuid_appareil] })

    expect(await synchroniserVentesEnAttente()).toBe(1)

    expect(appels[0].adresse).toBe('/ventes/synchroniser')
    expect(appels[0].corps.ventes).toEqual([VENTE])
    expect(await nombreVentesEnAttente()).toBe(0)
  })

  it('oublie aussi une vente que le serveur avait déjà (accusé de réception perdu)', async () => {
    await mettreEnFile(VENTE)
    serveurRepond({ doublons: [VENTE.uuid_appareil] })

    expect(await synchroniserVentesEnAttente()).toBe(0)
    expect(await nombreVentesEnAttente()).toBe(0)
  })

  it('garde une vente refusée : elle repartira', async () => {
    await mettreEnFile(VENTE)
    serveurRepond({ echecs: [{ uuid_appareil: VENTE.uuid_appareil, erreur: 'Stock insuffisant' }] })

    expect(await synchroniserVentesEnAttente()).toBe(0)
    expect(await nombreVentesEnAttente()).toBe(1)
  })

  it('garde la vente si le serveur est injoignable', async () => {
    await mettreEnFile(VENTE)
    api.defaults.adapter = async () => { throw new Error('Network Error') }

    expect(await synchroniserVentesEnAttente()).toBe(-1)
    expect(await nombreVentesEnAttente()).toBe(1)
  })

  it('n\'envoie rien hors ligne', async () => {
    await mettreEnFile(VENTE)
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const appels = serveurRepond({ synchronisees: [VENTE.uuid_appareil] })

    expect(await synchroniserVentesEnAttente()).toBe(-1)
    expect(appels).toHaveLength(0)
    expect(await nombreVentesEnAttente()).toBe(1)
  })
})
