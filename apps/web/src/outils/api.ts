import axios from 'axios'

// En dev : '/api' passe par le proxy Vite → http://127.0.0.1:8000.
// En prod (build statique Render) : VITE_URL_API = https://<api>.onrender.com/api
export const api = axios.create({
  baseURL: import.meta.env.VITE_URL_API || '/api',
  headers: { Accept: 'application/json' },
})

const CLE_JETON = 'samacommerce_jeton'
const CLE_APPAREIL = 'samacommerce_appareil'

/* Identifiant d'APPAREIL, envoyé comme « nom_appareil » à la connexion.
 *
 * Le serveur révoque l'ancien jeton portant le MÊME nom (hygiène : une
 * reconnexion ne laisse pas traîner de jeton orphelin). Sans identifiant
 * distinct, tous les appareils s'appelaient « app » : se connecter sur le
 * téléphone déconnectait donc le PC dans la seconde — d'où l'impression que la
 * session « expirait tout le temps ». */
function nomAppareil(): string {
  let nom = localStorage.getItem(CLE_APPAREIL)
  if (!nom) {
    const alea = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8)
    nom = (/Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'ordi') + '-' + alea
    localStorage.setItem(CLE_APPAREIL, nom)
  }
  return nom
}
const CLE_UTILISATEUR = 'samacommerce_utilisateur'

export type Utilisateur = {
  id: number
  identifiant: string
  nom_commerce: string | null
  boutique_active_id: number | null
  telephone: string | null
  role: string
  plan: string
  statut_demande_premium: string
  est_employe?: boolean
  permissions?: Record<string, boolean> | null
  /** Photo de profil (data-URL réduite). */
  photo?: string | null
  /** Réglages d'écran du compte (sections masquées, impression auto). */
  preferences?: Preferences | null
  double_facteur_actif?: boolean
}

export type Conditionnement = { id: number; produit_id?: number; libelle: string; facteur: number; prix: number }
export type Produit = {
  id: number
  nom: string
  categorie_id: number | null
  description: string | null
  code_barres?: string | null
  prix_vente: number
  prix_achat: number
  stock: number
  unite_base?: 'piece' | 'g' | 'ml'
  prix_min?: number | null
  negociable?: boolean | null
  conditionnements?: Conditionnement[]
  /** Photo de la fiche (data-URL réduite, cf. outils/photo.ts). */
  photo?: string | null
}

// Affichage du détail selon l'unité de base : [libellé, facteur vers la base]
export const UNITE_AFFICHAGE: Record<string, [string, number]> = {
  piece: ['pièce', 1], g: ['kg', 1000], ml: ['L', 1000],
}
export const infosAffichage = (p: Produit): [string, number] => UNITE_AFFICHAGE[p.unite_base || 'piece'] || UNITE_AFFICHAGE.piece

export type Categorie = { id: number; nom: string; emoji: string; couleur: string | null; negociable?: boolean }

export type Vente = {
  id: number
  produit_id: number
  /** Fiche client liée (null = vente anonyme au comptoir). */
  client_id?: number | null
  nom_produit?: string
  quantite: number
  total: number
  moyen_paiement: string
  nom_client: string | null
  telephone_client: string | null
  date_echeance: string | null
  paye: boolean
  cree_le: string
  quantite_base?: number | null
  libelle_conditionnement?: string | null
  prix_reference?: number | null
  prix_reel?: number | null
  remise?: number | null
  cout_marchandises?: number | null
  vendu_par_nom?: string | null
}

export function lireJeton() { return localStorage.getItem(CLE_JETON) }
export function lireUtilisateur(): Utilisateur | null {
  const brut = localStorage.getItem(CLE_UTILISATEUR)
  return brut ? JSON.parse(brut) : null
}
export function enregistrerUtilisateur(utilisateur: Utilisateur) {
  localStorage.setItem(CLE_UTILISATEUR, JSON.stringify(utilisateur))
}
function memoriserSession(jeton: string, utilisateur: Utilisateur) {
  localStorage.setItem(CLE_JETON, jeton)
  localStorage.setItem(CLE_UTILISATEUR, JSON.stringify(utilisateur))
}

api.interceptors.request.use((requete) => {
  const jeton = lireJeton()
  if (jeton) requete.headers.Authorization = `Bearer ${jeton}`
  return requete
})

/* Chemins d'AUTHENTIFICATION : un 401 y veut dire « identifiants refusés », pas
   « session expirée ». Les exclure évite de transformer une faute de frappe sur
   le mot de passe en message de déconnexion. */
const CHEMINS_AUTHENTIFICATION = [
  '/auth/connexion', '/auth/verifier-double-facteur', '/auth/inscription',
  '/auth/mot-de-passe-oublie', '/auth/reinitialiser-mot-de-passe',
]

/** Émis quand le serveur REFUSE le jeton : l'application doit revenir à la connexion. */
export const EVENEMENT_SESSION_EXPIREE = 'samacommerce:session-expiree'

/*
 * Jeton périmé = retour à l'écran de connexion.
 *
 * Sans cet intercepteur, un jeton expiré laissait l'application « connectée » :
 * `connecte` vaut !!lireJeton(), donc un jeton MORT suffisait à afficher
 * l'interface complète. Chaque appel repartait en 401, les sections chargeaient
 * en `.then(definirX)` sans `.catch`, et l'état restait un tableau vide — TOUS
 * les écrans s'affichaient vides, sans un seul message. Un commerçant revenant
 * après une longue absence croyait sa base de données perdue.
 *
 * Deux garde-fous : on ne réagit qu'à un VRAI 401 du serveur (une panne réseau
 * n'a pas de `response` — hors ligne, on ne déconnecte surtout pas, la file
 * d'attente doit pouvoir rejouer les ventes au retour du réseau), et jamais sur
 * les chemins d'authentification eux-mêmes.
 */
api.interceptors.response.use(
  (reponse) => reponse,
  (erreur) => {
    const statut = erreur?.response?.status
    const adresse: string = erreur?.config?.url || ''
    if (statut === 401 && lireJeton() && !CHEMINS_AUTHENTIFICATION.some((c) => adresse.startsWith(c))) {
      deconnecter() // purge le jeton mort ; la file hors ligne (IndexedDB) est conservée
      window.dispatchEvent(new CustomEvent(EVENEMENT_SESSION_EXPIREE))
    }
    return Promise.reject(erreur)
  },
)

// --- Authentification ---
/** `envoye` : le code est-il vraiment parti par e-mail ? `message` le dit en clair. */
export type ResultatConnexion =
  | { utilisateur: Utilisateur }
  | { double_facteur_requis: true; envoye?: boolean; message?: string; code_dev?: string | null }
export async function connecter(identifiant: string, motDePasse: string): Promise<ResultatConnexion> {
  const { data } = await api.post('/auth/connexion', { identifiant, mot_de_passe: motDePasse, nom_appareil: nomAppareil() })
  if (data.double_facteur_requis) {
    return { double_facteur_requis: true, envoye: data.envoye, message: data.message, code_dev: data.code_dev }
  }
  memoriserSession(data.jeton, data.utilisateur)
  return { utilisateur: data.utilisateur as Utilisateur }
}
export async function verifierDoubleFacteur(identifiant: string, code: string): Promise<Utilisateur> {
  const { data } = await api.post('/auth/verifier-double-facteur', { identifiant, code, nom_appareil: nomAppareil() })
  memoriserSession(data.jeton, data.utilisateur)
  return data.utilisateur as Utilisateur
}
/**
 * Désactiver est immédiat. Activer envoie un code par e-mail (`code_envoye`) :
 * l'option ne s'active qu'une fois ce code confirmé (confirmerDoubleFacteur).
 */
export async function basculerDoubleFacteur(actif: boolean): Promise<{
  double_facteur_actif: boolean; code_envoye?: boolean; message?: string; code_dev?: string | null
}> {
  const { data } = await api.put('/auth/double-facteur', { actif })
  return data
}
export async function confirmerDoubleFacteur(code: string): Promise<{ double_facteur_actif: boolean }> {
  const { data } = await api.post('/auth/double-facteur/confirmer', { code })
  return data
}
export async function inscrire(charge: { identifiant: string; mot_de_passe: string; nom_commerce?: string; telephone?: string }) {
  const { data } = await api.post('/auth/inscription', { ...charge, nom_appareil: nomAppareil() })
  memoriserSession(data.jeton, data.utilisateur)
  return data.utilisateur as Utilisateur
}
export function deconnecter() {
  localStorage.removeItem(CLE_JETON)
  localStorage.removeItem(CLE_UTILISATEUR)
}
/** S2 — Déconnecte tous les appareils (révoque tous les jetons côté serveur). */
export async function deconnecterPartout() {
  try { await api.post('/auth/deconnexion-partout') } catch { /* réseau : on nettoie quand même le local */ }
  deconnecter()
}
export async function motDePasseOublie(identifiant: string): Promise<{ message: string; envoye?: boolean; code_dev?: string | null }> {
  const { data } = await api.post('/auth/mot-de-passe-oublie', { identifiant })
  return data
}
export async function reinitialiserMotDePasse(identifiant: string, code: string, motDePasse: string): Promise<{ message: string }> {
  const { data } = await api.post('/auth/reinitialiser-mot-de-passe', { identifiant, code, mot_de_passe: motDePasse })
  return data
}

// --- Ressources ---
/** Page de résultats. L'enveloppe (`data`, `current_page`…) est celle de Laravel. */
export type Page<T> = { data: T[]; current_page: number; last_page: number; total: number }
export const Produits = {
  lister: () => api.get<Produit[]>('/produits').then((r) => r.data),
  page: (numero: number, parPage = 30) => api.get<Page<Produit>>('/produits', { params: { page: numero, par_page: parPage } }).then((r) => r.data), // T9
  creer: (p: Partial<Produit>) => api.post<Produit>('/produits', p).then((r) => r.data),
  modifier: (id: number, p: Partial<Produit>) => api.patch<Produit>(`/produits/${id}`, p).then((r) => r.data),
  supprimer: (id: number) => api.delete(`/produits/${id}`),
  corbeille: () => api.get<Produit[]>('/produits/corbeille').then((r) => r.data), // T4
  restaurer: (id: number) => api.post<Produit>(`/produits/${id}/restaurer`).then((r) => r.data), // T4
}
export const Categories = {
  lister: () => api.get<Categorie[]>('/categories').then((r) => r.data),
  creer: (c: Partial<Categorie>) => api.post<Categorie>('/categories', c).then((r) => r.data),
  modifier: (id: number, c: Partial<Categorie>) => api.patch<Categorie>(`/categories/${id}`, c).then((r) => r.data),
  supprimer: (id: number) => api.delete(`/categories/${id}`),
}
export const Ventes = {
  lister: () => api.get<Vente[]>('/ventes').then((r) => r.data),
  page: (numero: number, parPage = 20) => api.get<Page<Vente>>('/ventes', { params: { page: numero, par_page: parPage } }).then((r) => r.data),
  corbeille: () => api.get<Vente[]>('/ventes/corbeille').then((r) => r.data), // T4
  restaurer: (id: number) => api.post<Vente>(`/ventes/${id}/restaurer`).then((r) => r.data), // T4
  creer: (v: Record<string, unknown>) => api.post<Vente>('/ventes', v).then((r) => r.data),
  modifier: (id: number, v: Record<string, unknown>) => api.patch<Vente>(`/ventes/${id}`, v).then((r) => r.data),
  supprimer: (id: number) => api.delete(`/ventes/${id}`),
}
export type Client = {
  id: number; nom: string; telephone: string | null; email: string | null; adresse: string | null; notes: string | null
  photo?: string | null
  nb_achats?: number; total_achats?: number; credits_ouverts?: number; montant_credits?: number
}
/** Fiche allégée d'un client, telle que la reçoit un employé qui vend. */
export type ClientPourVente = { id: number; nom: string; telephone: string | null }
export type Fournisseur = { id: number; nom: string; telephone: string | null; email: string | null; adresse: string | null; notes: string | null; photo?: string | null }

export const Clients = {
  lister: () => api.get<Client[]>('/clients').then((r) => r.data),
  /** Liste allégée (id/nom/téléphone) : autorisée aux employés qui vendent. */
  pourVente: () => api.get<ClientPourVente[]>('/clients/pour-vente').then((r) => r.data),
  afficher: (id: number) => api.get(`/clients/${id}`).then((r) => r.data),
  creer: (c: Partial<Client>) => api.post<Client>('/clients', c).then((r) => r.data),
  modifier: (id: number, c: Partial<Client>) => api.patch<Client>(`/clients/${id}`, c).then((r) => r.data),
  supprimer: (id: number) => api.delete(`/clients/${id}`),
}
export const Fournisseurs = {
  lister: () => api.get<Fournisseur[]>('/fournisseurs').then((r) => r.data),
  creer: (f: Partial<Fournisseur>) => api.post<Fournisseur>('/fournisseurs', f).then((r) => r.data),
  modifier: (id: number, f: Partial<Fournisseur>) => api.patch<Fournisseur>(`/fournisseurs/${id}`, f).then((r) => r.data),
  supprimer: (id: number) => api.delete(`/fournisseurs/${id}`),
  messageReappro: (id: number) => api.get(`/fournisseurs/${id}/message-reappro`).then((r) => r.data),
}

export const Commandes = {
  lister: () => api.get('/commandes').then((r) => r.data),
  afficher: (id: number) => api.get(`/commandes/${id}`).then((r) => r.data),
  creer: (charge: { fournisseur_id?: number | null; notes?: string | null; date_prevue?: string | null; lignes: { produit_id: number; quantite: number; prix_unitaire: number }[] }) =>
    api.post('/commandes', charge).then((r) => r.data),
  recevoir: (id: number) => api.patch(`/commandes/${id}/recevoir`).then((r) => r.data),
  supprimer: (id: number) => api.delete(`/commandes/${id}`),
}

export const Livraisons = {
  lister: () => api.get('/livraisons').then((r) => r.data),
  creer: (commande_id: number | null, note_suivi?: string) => api.post('/livraisons', { commande_id, note_suivi }).then((r) => r.data),
  changerStatut: (id: number, statut: string, recevoir = false) => api.patch(`/livraisons/${id}`, { statut, recevoir }).then((r) => r.data),
  supprimer: (id: number) => api.delete(`/livraisons/${id}`),
}

export const Retours = {
  lister: () => api.get('/retours').then((r) => r.data),
  statistiques: () => api.get('/retours/statistiques').then((r) => r.data),
  creer: (vente_id: number, quantite: number, motif?: string, moyen_remboursement?: string) =>
    api.post('/retours', { vente_id, quantite, motif, moyen_remboursement }).then((r) => r.data),
}

export const Caisse = {
  aujourdhui: () => api.get('/caisse/aujourdhui').then((r) => r.data),
  cloturer: (notes?: string) => api.post('/caisse/cloturer', { notes }).then((r) => r.data),
  historique: () => api.get('/caisse/historique').then((r) => r.data),
  semaine: () => api.get('/caisse/semaine').then((r) => r.data),
}

export type Activite = { id: number; action: string; detail: string | null; nom_acteur: string | null; cree_le: string }
export const JournalActivite = {
  lister: () => api.get<Activite[]>('/activite').then((r) => r.data),
}

export type ElementReappro = {
  produit_id: number; nom: string; libelle_affichage: string; stock_affiche: number; moyenne_jour_affichee: number
  jours_avant_rupture: number | null; a_commander_affiche: number; methode: string
}
export type ScoreCredit = { score: number; risque: 'vert' | 'orange' | 'rouge'; raisons: string[]; methode: string }
export const Ia = {
  reappro: () => api.get<ElementReappro[]>('/ia/reappro').then((r) => r.data),
  scoreCredit: (charge: { montant: number; date_echeance?: string | null; nom_client?: string | null; client_id?: number | null }) =>
    api.post<ScoreCredit>('/ia/score-credit', charge).then((r) => r.data),
}

/** Les 3 chiffres de l'en-tête d'accueil, agrégés par le serveur. */
export type ResumeJour = { date: string; ca: number | null; articles: number | null; stock: number | null }
/** Produit en stock faible, tel que le renvoient les statistiques. */
export type AlerteStock = { produit: string; stock: number }

export const Statistiques = {
  /* Remplace le téléchargement de TOUT l'historique des ventes (~450 octets par
     vente, à chaque changement d'écran) par une réponse de taille constante.
     Les champs valent `null` quand l'employé n'a pas le droit de les voir. */
  resumeJour: (): Promise<ResumeJour> => api.get('/statistiques/resume-jour').then((r) => r.data),
  stockFaible: (seuil = 5): Promise<AlerteStock[]> => api.get(`/statistiques/stock-faible?seuil=${seuil}`).then((r) => r.data),
  ventesParJour: () => api.get('/statistiques/ventes-par-jour').then((r) => r.data),
  paiements: () => api.get('/statistiques/paiements').then((r) => r.data),
  meilleursProduits: () => api.get('/statistiques/meilleurs-produits').then((r) => r.data),
  margeCategorie: () => api.get('/statistiques/marge-categorie').then((r) => r.data),
  rotationStock: () => api.get('/statistiques/rotation-stock').then((r) => r.data),
  meilleursClients: () => api.get('/statistiques/meilleurs-clients').then((r) => r.data),
  marchandage: () => api.get('/statistiques/marchandage').then((r) => r.data),
}

// --- Administration ---
export const Admin = {
  vueEnsemble: () => api.get('/admin/statistiques/vue-ensemble').then((r) => r.data),
  revenus: (periode = 'mois') => api.get(`/admin/statistiques/revenus?periode=${periode}`).then((r) => r.data),
  transactions: (limite = 10) => api.get(`/admin/statistiques/transactions?limite=${limite}`).then((r) => r.data),
  comptes: () => api.get('/admin/statistiques/comptes').then((r) => r.data),
  evolution: () => api.get('/admin/statistiques/revenus/evolution').then((r) => r.data),
  utilisateurs: () => api.get('/admin/utilisateurs').then((r) => r.data),
  bloquer: (id: number) => api.put(`/admin/utilisateurs/${id}/bloquer`),
  activer: (id: number) => api.put(`/admin/utilisateurs/${id}/activer`),
  supprimerUtilisateur: (id: number) => api.delete(`/admin/utilisateurs/${id}`),
  validerPassagePremium: (id: number) => api.put(`/admin/passages-premium/${id}/valider`),
  refuserPassagePremium: (id: number) => api.put(`/admin/passages-premium/${id}/refuser`),
  retraits: () => api.get('/admin/retraits').then((r) => r.data),
  retirer: (montant: number, moyen: string) => api.post('/admin/retraits', { montant, moyen }),
  transferts: () => api.get('/admin/transferts').then((r) => r.data),
  transferer: (source: string, destination: string, montant: number) => api.post('/admin/transferts', { source, destination, montant }),
  // Plus de réglage « 2FA » ici : il ne protégeait rien. La vraie vérification
  // en deux étapes passe par basculerDoubleFacteur (outils/doubleFacteur).
}

export type Boutique = { id: number; nom: string; telephone: string | null; adresse: string | null; emoji: string; est_principale: boolean; photo?: string | null; nb_produits?: number; nb_ventes?: number; nb_membres?: number }
export type LigneBoutique = {
  id: number; nom: string; emoji: string; photo?: string | null; est_principale: boolean
  ca_jour: number; nb_ventes_jour: number; ca_mois: number
  nb_produits: number; stock_total: number; ruptures: number; stock_faible: number
  credits_impayes: number; nb_membres: number
}
export type DonneesTableauBord = {
  boutiques: LigneBoutique[]
  total: { ca_jour: number; nb_ventes_jour: number; ca_mois: number; nb_produits: number; ruptures: number; credits_impayes: number; nb_boutiques: number }
  meilleure: LigneBoutique | null
}

export type Membre = {
  id: number; email: string; role: string; statut: string; permissions: Record<string, boolean>; membre_id: number | null
  /** Fiche saisie par le patron (prime sur le compte lié). */
  nom?: string | null; telephone?: string | null; photo?: string | null
  /** Repli : infos du compte utilisateur quand l'invitation a été acceptée. */
  nom_commerce_utilisateur?: string | null; telephone_utilisateur?: string | null
}

export const TOUTES_PERMISSIONS = ['vente', 'stock', 'categories', 'rapports', 'caisse', 'credits', 'clients', 'fournisseurs', 'commandes', 'livraisons']

export const Boutiques = {
  lister: () => api.get<Boutique[]>('/boutiques').then((r) => r.data),
  creer: (b: Partial<Boutique>) => api.post<Boutique>('/boutiques', b).then((r) => r.data),
  modifier: (id: number, b: Partial<Boutique>) => api.patch(`/boutiques/${id}`, b).then((r) => r.data),
  supprimer: (id: number) => api.delete(`/boutiques/${id}`),
  activer: (id: number) => api.post(`/boutiques/${id}/activer`).then((r) => r.data),
  /** Vue consolidée de toutes les boutiques (multi-boutique). */
  tableauDeBord: () => api.get<DonneesTableauBord>('/boutiques/tableau-de-bord').then((r) => r.data),
}
export const Membres = {
  lister: () => api.get<Membre[]>('/membres').then((r) => r.data),
  inviter: (charge: { email: string; role: string; permissions?: Record<string, boolean>; nom?: string | null; telephone?: string | null; photo?: string | null }) =>
    api.post('/membres/inviter', charge).then((r) => r.data),
  accepter: (jeton_invitation: string) => api.post('/membres/accepter', { jeton_invitation }).then((r) => r.data),
  /** Aperçu public d'une invitation (avant même que l'invité ait un compte). */
  apercu: (jeton: string) =>
    api.get<{ boutique: string | null; role: string; email: string; nom: string | null }>(
      `/membres/invitation/${encodeURIComponent(jeton)}`,
    ).then((r) => r.data),
  modifier: (id: number, charge: { permissions?: Record<string, boolean>; role?: string; nom?: string | null; telephone?: string | null; photo?: string | null }) =>
    api.patch(`/membres/${id}`, charge).then((r) => r.data),
  supprimer: (id: number) => api.delete(`/membres/${id}`),
}

export function moi() { return api.get('/auth/moi').then((r) => r.data) }
/** Réglages d'écran synchronisés entre les appareils du compte. */
export type Preferences = { sections_masquees?: string[]; impression_auto?: boolean }

export function modifierPreferences(preferences: Preferences) {
  return api.put<{ preferences: Preferences }>('/auth/preferences', preferences).then((r) => r.data.preferences)
}

export function modifierProfil(charge: { nom_commerce?: string; telephone?: string; photo?: string | null }) {
  return api.put('/auth/profil', charge).then((r) => r.data)
}

export const fcfa = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' F'

/**
 * Date lisible par un humain (« 01/08/2026 »).
 *
 * Postgres renvoie les dates en ISO complet (`2026-08-01T00:00:00.000000Z`).
 * Affichée telle quelle sur une fiche de crédit, cette chaîne est illisible —
 * a fortiori pour quelqu'un qui déchiffre difficilement. On ne garde donc que
 * le jour, et on ne convertit PAS en heure locale : une échéance est une date
 * civile, pas un instant (sinon minuit UTC recule d'un jour à l'ouest).
 */
export function dateFr(valeur?: string | null): string {
  if (!valeur) return '—'
  const jour = String(valeur).slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(valeur)
}

/** Identité de la boutique, en-tête des messages WhatsApp et des exports. */
export function identiteBoutique(): { nom: string; telephone?: string | null } {
  const u = lireUtilisateur()
  return { nom: u?.nom_commerce || 'Ma Boutique', telephone: u?.telephone }
}
