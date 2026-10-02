/* Cache partagé des données de RÉFÉRENCE (produits, catégories).
 *
 * POURQUOI. Ces deux listes sont relues au montage de presque chaque section :
 * passer de Vendre à Stock puis revenir les retéléchargeait trois fois. Or
 * elles bougent peu dans une journée — et c'est la boucle la plus fréquente du
 * point de vente.
 *
 * @tanstack/react-query était DÉJÀ dans les dépendances du projet sans être
 * utilisé nulle part : on payait la bibliothèque sans le bénéfice.
 *
 * Choix des réglages, tous dictés par le terrain :
 *  - `staleTime` 60 s : au comptoir, une liste vieille d'une minute est bonne ;
 *    au-delà on rafraîchit, parce qu'un stock faux fait vendre à découvert.
 *  - `refetchOnWindowFocus: false` : sur mobile, chaque retour dans l'onglet
 *    (notification, appel) déclencherait un appel réseau facturé pour rien.
 *  - `retry: 1` : une seule reprise. Hors ligne, insister ne sert qu'à retarder
 *    l'affichage du message d'erreur.
 */

import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'
import { Abonnement, Categories, Produits, type Categorie, type DonneesAbonnement, type Produit } from './api'

/* Repli STABLE en attendant la réponse.
 * Écrire `?? []` crée un tableau NEUF à chaque rendu : toute dépendance de
 * useMemo le voit changer et recalcule sans arrêt. Une constante partagée
 * garde la même référence, et react-query en fournit une stable ensuite. */
export const LISTE_VIDE: never[] = []

export const CLES = {
  produits: ['produits'] as const,
  categories: ['categories'] as const,
  abonnement: ['abonnement'] as const,
}

export function creerClientRequetes(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  })
}

/* `actif` : les hooks React s'exécutent AVANT le retour anticipé vers l'écran
 * de connexion. Sans ce garde, l'application interroge l'API alors que personne
 * n'est connecté — deux 401 inutiles à chaque affichage de la connexion,
 * visibles dans la console, et une course avec l'intercepteur de session
 * expirée. */
export function useProduits(actif = true) {
  return useQuery<Produit[]>({ queryKey: CLES.produits, queryFn: Produits.lister, enabled: actif })
}

export function useCategories(actif = true) {
  return useQuery<Categorie[]>({ queryKey: CLES.categories, queryFn: Categories.lister, enabled: actif })
}

/**
 * À appeler après TOUTE écriture qui touche le stock ou le catalogue : vente,
 * ajout/modification/suppression de produit, réception de commande, retour.
 * Sans cela, le cache afficherait un stock périmé — bien pire que l'appel
 * réseau qu'on cherchait à éviter.
 */
export function useRafraichirCatalogue() {
  const client = useQueryClient()
  return () => {
    client.invalidateQueries({ queryKey: CLES.produits })
    client.invalidateQueries({ queryKey: CLES.categories })
  }
}

/* État d'abonnement : plan qui s'applique, échéance, limites, paiement en
 * cours. Lu par la carte « Mon plan » de l'accueil, l'écran Mon plan et la
 * feuille « plan requis » : un seul appel pour les trois. Il change rarement
 * (une validation par mois au plus) ; on le relit après chaque déclaration. */
export function useAbonnement(actif = true) {
  return useQuery<DonneesAbonnement>({ queryKey: CLES.abonnement, queryFn: Abonnement.etat, enabled: actif, staleTime: 5 * 60_000 })
}

export function useRafraichirAbonnement() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: CLES.abonnement })
}
