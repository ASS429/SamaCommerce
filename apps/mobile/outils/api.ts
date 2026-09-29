import axios from 'axios'

// ⚠️ Sur un vrai téléphone (Expo Go), « localhost » désigne le téléphone, pas votre PC.
// Donnez l'adresse de l'API dans EXPO_PUBLIC_URL_API (lue au lancement d'Expo), sinon
// l'adresse IP de votre PC sur le réseau local ci-dessous est utilisée.
//  - Émulateur Android : http://10.0.2.2:8000/api
//  - Web / simulateur iOS : http://localhost:8000/api
//  - Production : https://samacommerce-api.onrender.com/api
export const URL_API = process.env.EXPO_PUBLIC_URL_API || 'http://192.168.1.10:8000/api'

let jeton: string | null = null

/* L'API révoque, à chaque connexion, l'ancien jeton portant le même nom
   d'appareil (ControleurAuthentification::emettreJeton). Un nom fixe ferait
   se déconnecter mutuellement deux téléphones du même compte. */
const NOM_APPAREIL = `mobile-${Math.random().toString(36).slice(2, 10)}`

export const api = axios.create({
  baseURL: URL_API,
  // Contrat français de l'API : sans cet en-tête, les adresses communes aux
  // deux versions répondent dans l'ancien format anglais.
  headers: { Accept: 'application/json', 'X-Contrat-Api': 'fr' },
})

api.interceptors.request.use((requete) => {
  if (jeton) requete.headers.Authorization = `Bearer ${jeton}`
  return requete
})

export type Utilisateur = { id: number; identifiant: string; nom_commerce: string | null; role: string }
export type Conditionnement = { id: number; libelle: string; facteur: number; prix: number }
export type Produit = {
  id: number
  nom: string
  /** Toujours exprimé dans l'unité de base : pièce, gramme ou millilitre. */
  stock: number
  unite_base?: 'piece' | 'g' | 'ml'
  conditionnements?: Conditionnement[]
}
/** Chiffres du jour ; `null` quand un employé n'a pas le droit de les voir. */
export type ResumeJour = { date: string; ca: number | null; articles: number | null; stock: number | null }

export type ResultatConnexion = { utilisateur: Utilisateur } | { double_facteur_requis: true }

export async function connecter(identifiant: string, motDePasse: string): Promise<ResultatConnexion> {
  const { data } = await api.post('/auth/connexion', { identifiant, mot_de_passe: motDePasse, nom_appareil: NOM_APPAREIL })
  if (data.double_facteur_requis) return { double_facteur_requis: true }
  jeton = data.jeton
  return { utilisateur: data.utilisateur }
}

/** Deuxième temps de la connexion quand le double facteur est activé. */
export async function verifierDoubleFacteur(identifiant: string, code: string): Promise<Utilisateur> {
  const { data } = await api.post('/auth/verifier-double-facteur', { identifiant, code, nom_appareil: NOM_APPAREIL })
  jeton = data.jeton
  return data.utilisateur
}

/** Révoque le jeton côté serveur ; la session locale est effacée même sans réseau. */
export async function deconnecter() {
  try {
    await api.post('/auth/deconnexion')
  } catch {
    // Hors ligne : le jeton expirera de lui-même.
  }
  jeton = null
}

export const estConnecte = () => jeton !== null

export const Statistiques = {
  resumeJour: (): Promise<ResumeJour> => api.get('/statistiques/resume-jour').then((r) => r.data),
}

export const Produits = {
  lister: (): Promise<Produit[]> => api.get('/produits').then((r) => r.data),
}

/** Le stock est suivi en grammes et millilitres, mais se lit en kg et en litres. */
const UNITE_AFFICHAGE: Record<string, [string, number]> = {
  piece: ['pièce', 1], g: ['kg', 1000], ml: ['L', 1000],
}
export function stockLisible(p: Produit): string {
  const [unite, facteur] = UNITE_AFFICHAGE[p.unite_base || 'piece'] || UNITE_AFFICHAGE.piece
  const quantite = Math.round((p.stock / facteur) * 100) / 100
  // En français, le pluriel commence à 2 : « 1,5 pièce » mais « 2 pièces ».
  const accord = unite === 'pièce' && Math.abs(quantite) >= 2 ? 'pièces' : unite
  return `${new Intl.NumberFormat('fr-FR').format(quantite)} ${accord}`
}

/** Message à afficher pour un échec d'appel : celui du serveur s'il en donne un. */
export function messageErreur(e: unknown, parDefaut: string): string {
  if (!axios.isAxiosError(e)) return parDefaut
  if (!e.response) return 'Le serveur ne répond pas. Vérifiez le réseau et l\'adresse de l\'API.'
  const donnees = e.response.data as
    { erreur?: string; message?: string; permission?: string; errors?: Record<string, string[]> } | undefined
  // Erreur de saisie (422, 429) > permission manquante (message explicite) > refus (compte bloqué…).
  const premiereErreur = Object.values(donnees?.errors ?? {})[0]?.[0]
  return premiereErreur || (donnees?.permission ? donnees.message : donnees?.erreur) || parDefaut
}

export const fcfa = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
