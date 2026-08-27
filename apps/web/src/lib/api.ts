import axios from 'axios'

// En dev : '/api' passe par le proxy Vite → http://127.0.0.1:8000.
// En prod (build statique Render) : VITE_API_URL = https://<api>.onrender.com/api
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { Accept: 'application/json' },
})

const TOKEN_KEY = 'samacommerce_token'
const DEVICE_KEY = 'samacommerce_device'

/* Identifiant d'APPAREIL, envoyé comme "device_name" à la connexion.
 *
 * Le serveur révoque l'ancien token portant le MÊME nom (hygiène : une
 * reconnexion ne laisse pas traîner de jeton orphelin). Sans identifiant
 * distinct, tous les appareils s'appelaient « app » : se connecter sur le
 * téléphone déconnectait donc le PC dans la seconde — d'où l'impression que la
 * session « expirait tout le temps ». */
function deviceName(): string {
  let d = localStorage.getItem(DEVICE_KEY)
  if (!d) {
    const rnd = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8)
    d = (/Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'ordi') + '-' + rnd
    localStorage.setItem(DEVICE_KEY, d)
  }
  return d
}
const USER_KEY = 'samacommerce_user'

export type User = {
  id: number
  username: string
  company_name: string | null
  current_boutique_id: number | null
  phone: string | null
  role: string
  plan: string
  upgrade_status: string
  is_employee?: boolean
  permissions?: Record<string, boolean> | null
  /** Photo de profil (data-URL réduite). */
  photo?: string | null
  /** Réglages d'écran du compte (sections masquées, impression auto). */
  preferences?: { modules_off?: string[]; auto_print?: boolean } | null
}

export type ProductUnit = { id: number; product_id?: number; libelle: string; facteur: number; prix: number }
export type Product = {
  id: number
  name: string
  category_id: number | null
  scent: string | null
  barcode?: string | null
  price: number
  price_achat: number
  stock: number
  unite_base?: 'piece' | 'g' | 'ml'
  prix_min?: number | null
  negociable?: boolean | null
  units?: ProductUnit[]
  /** Photo de la fiche (data-URL réduite, cf. lib/photo.ts). */
  photo?: string | null
}

// Affichage du détail selon l'unité de base : [libellé, facteur vers la base]
export const DISPLAY_UNIT: Record<string, [string, number]> = {
  piece: ['pièce', 1], g: ['kg', 1000], ml: ['L', 1000],
}
export const displayInfo = (p: Product): [string, number] => DISPLAY_UNIT[p.unite_base || 'piece'] || DISPLAY_UNIT.piece

export type Category = { id: number; name: string; emoji: string; couleur: string | null; negociable?: boolean }

export type Sale = {
  id: number
  product_id: number
  /** Fiche client liée (null = vente anonyme au comptoir). */
  client_id?: number | null
  product_name?: string
  quantity: number
  total: number
  payment_method: string
  client_name: string | null
  client_phone: string | null
  due_date: string | null
  paid: boolean
  created_at: string
  quantite_base?: number | null
  unit_libelle?: string | null
  prix_reference?: number | null
  prix_reel?: number | null
  remise?: number | null
  cogs?: number | null
  vendu_par_nom?: string | null
}

export function getToken() { return localStorage.getItem(TOKEN_KEY) }
export function getUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}
export function saveUser(user: User) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}
function persist(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/* Chemins d'AUTHENTIFICATION : un 401 y veut dire « identifiants refusés », pas
   « session expirée ». Les exclure évite de transformer une faute de frappe sur
   le mot de passe en message de déconnexion. */
const AUTH_PATHS = ['/auth/login', '/auth/verify-2fa', '/auth/register', '/auth/forgot-password', '/auth/reset-password']

/** Émis quand le serveur REFUSE le jeton : l'app doit revenir à la connexion. */
export const SESSION_EXPIRED_EVENT = 'samacommerce:session-expired'

/*
 * Jeton périmé = retour à l'écran de connexion.
 *
 * Sans cet intercepteur, un jeton expiré laissait l'application « connectée » :
 * `authed` vaut !!getToken(), donc un jeton MORT suffisait à afficher l'interface
 * complète. Chaque appel repartait en 401, les sections chargent en
 * `.then(setX)` sans `.catch`, et l'état restait un tableau vide — TOUS les
 * écrans s'affichaient vides, sans un seul message. Un commerçant revenant après
 * une longue absence croyait sa base de données perdue.
 *
 * Deux garde-fous : on ne réagit qu'à un VRAI 401 du serveur (une panne réseau
 * n'a pas de `response` — hors ligne, on ne déconnecte surtout pas, la file
 * d'attente doit pouvoir rejouer les ventes au retour du réseau), et jamais sur
 * les chemins d'authentification eux-mêmes.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const url: string = error?.config?.url || ''
    if (status === 401 && getToken() && !AUTH_PATHS.some((p) => url.startsWith(p))) {
      logout() // purge le jeton mort ; la file hors-ligne (IndexedDB) est conservée
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
    }
    return Promise.reject(error)
  },
)

// --- Auth ---
export type LoginResult = { user: User } | { twofa_required: true; dev_code?: string | null }
export async function login(username: string, password: string): Promise<LoginResult> {
  const { data } = await api.post('/auth/login', { username, password, device_name: deviceName() })
  if (data.twofa_required) return { twofa_required: true, dev_code: data.dev_code }
  persist(data.token, data.user)
  return { user: data.user as User }
}
export async function verify2fa(username: string, code: string): Promise<User> {
  const { data } = await api.post('/auth/verify-2fa', { username, code, device_name: deviceName() })
  persist(data.token, data.user)
  return data.user as User
}
export async function toggle2fa(enabled: boolean): Promise<{ twofa_enabled: boolean }> {
  const { data } = await api.put('/auth/2fa', { enabled })
  return data
}
export async function register(payload: { username: string; password: string; company_name?: string; phone?: string }) {
  const { data } = await api.post('/auth/register', { ...payload, device_name: deviceName() })
  persist(data.token, data.user)
  return data.user as User
}
export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
/** S2 — Déconnecte tous les appareils (révoque tous les tokens côté serveur). */
export async function logoutAllDevices() {
  try { await api.post('/auth/logout-all') } catch { /* réseau : on nettoie quand même le local */ }
  logout()
}
export async function forgotPassword(username: string): Promise<{ message: string; dev_code?: string | null }> {
  const { data } = await api.post('/auth/forgot-password', { username })
  return data
}
export async function resetPassword(username: string, code: string, password: string): Promise<{ message: string }> {
  const { data } = await api.post('/auth/reset-password', { username, code, password })
  return data
}

// --- Ressources ---
export type Page<T> = { data: T[]; current_page: number; last_page: number; total: number }
export const Products = {
  list: () => api.get<Product[]>('/products').then((r) => r.data),
  page: (page: number, perPage = 30) => api.get<Page<Product>>('/products', { params: { page, per_page: perPage } }).then((r) => r.data), // T9
  create: (p: Partial<Product>) => api.post<Product>('/products', p).then((r) => r.data),
  update: (id: number, p: Partial<Product>) => api.patch<Product>(`/products/${id}`, p).then((r) => r.data),
  remove: (id: number) => api.delete(`/products/${id}`),
  trash: () => api.get<Product[]>('/products/trash').then((r) => r.data), // T4
  restore: (id: number) => api.post<Product>(`/products/${id}/restore`).then((r) => r.data), // T4
}
export const Categories = {
  list: () => api.get<Category[]>('/categories').then((r) => r.data),
  create: (c: Partial<Category>) => api.post<Category>('/categories', c).then((r) => r.data),
  update: (id: number, c: Partial<Category>) => api.patch<Category>(`/categories/${id}`, c).then((r) => r.data),
  remove: (id: number) => api.delete(`/categories/${id}`),
}
export const Sales = {
  list: () => api.get<Sale[]>('/sales').then((r) => r.data),
  page: (page: number, perPage = 20) => api.get<Page<Sale>>('/sales', { params: { page, per_page: perPage } }).then((r) => r.data),
  trash: () => api.get<Sale[]>('/sales/trash').then((r) => r.data), // T4
  restore: (id: number) => api.post<Sale>(`/sales/${id}/restore`).then((r) => r.data), // T4
  create: (s: Partial<Sale>) => api.post<Sale>('/sales', s).then((r) => r.data),
  update: (id: number, s: Partial<Sale>) => api.patch<Sale>(`/sales/${id}`, s).then((r) => r.data),
  remove: (id: number) => api.delete(`/sales/${id}`),
}
export type Client = {
  id: number; name: string; phone: string | null; email: string | null; address: string | null; notes: string | null
  photo?: string | null
  nb_achats?: number; total_achats?: number; credits_ouverts?: number; credits_montant?: number
}
export type Fournisseur = { id: number; name: string; phone: string | null; email: string | null; address: string | null; notes: string | null; photo?: string | null }

export const Clients = {
  list: () => api.get<Client[]>('/clients').then((r) => r.data),
  /** Liste allégée (id/nom/téléphone) : autorisée aux employés qui vendent. */
  forSale: () => api.get<{ id: number; name: string; phone: string | null }[]>('/clients/for-sale').then((r) => r.data),
  show: (id: number) => api.get(`/clients/${id}`).then((r) => r.data),
  create: (c: Partial<Client>) => api.post<Client>('/clients', c).then((r) => r.data),
  update: (id: number, c: Partial<Client>) => api.patch<Client>(`/clients/${id}`, c).then((r) => r.data),
  remove: (id: number) => api.delete(`/clients/${id}`),
}
export const Fournisseurs = {
  list: () => api.get<Fournisseur[]>('/fournisseurs').then((r) => r.data),
  create: (f: Partial<Fournisseur>) => api.post<Fournisseur>('/fournisseurs', f).then((r) => r.data),
  update: (id: number, f: Partial<Fournisseur>) => api.patch<Fournisseur>(`/fournisseurs/${id}`, f).then((r) => r.data),
  remove: (id: number) => api.delete(`/fournisseurs/${id}`),
  reappro: (id: number) => api.get(`/fournisseurs/${id}/reappro-message`).then((r) => r.data),
}

export const Commandes = {
  list: () => api.get('/commandes').then((r) => r.data),
  show: (id: number) => api.get(`/commandes/${id}`).then((r) => r.data),
  create: (payload: { fournisseur_id?: number | null; notes?: string | null; expected_date?: string | null; items: { product_id: number; quantity: number; prix_unitaire: number }[] }) =>
    api.post('/commandes', payload).then((r) => r.data),
  recevoir: (id: number) => api.patch(`/commandes/${id}/recevoir`).then((r) => r.data),
  remove: (id: number) => api.delete(`/commandes/${id}`),
}

export const Livraisons = {
  list: () => api.get('/livraisons').then((r) => r.data),
  create: (commande_id: number | null, tracking_note?: string) => api.post('/livraisons', { commande_id, tracking_note }).then((r) => r.data),
  setStatus: (id: number, status: string, recevoir = false) => api.patch(`/livraisons/${id}`, { status, recevoir }).then((r) => r.data),
  remove: (id: number) => api.delete(`/livraisons/${id}`),
}

export const Returns = {
  list: () => api.get('/returns').then((r) => r.data),
  stats: () => api.get('/returns/stats').then((r) => r.data),
  create: (sale_id: number, quantity: number, reason?: string, refund_method?: string) =>
    api.post('/returns', { sale_id, quantity, reason, refund_method }).then((r) => r.data),
}

export const Caisse = {
  today: () => api.get('/caisse/today').then((r) => r.data),
  close: (notes?: string) => api.post('/caisse/close', { notes }).then((r) => r.data),
  history: () => api.get('/caisse/history').then((r) => r.data),
  weekly: () => api.get('/caisse/weekly').then((r) => r.data),
}

export type Activity = { id: number; action: string; detail: string | null; actor_name: string | null; created_at: string }
export const Activity = {
  list: () => api.get<Activity[]>('/activity').then((r) => r.data),
}

export type ReapproItem = { product_id: number; name: string; display_label: string; stock_display: number; avg_daily_display: number; days_until_stockout: number | null; reorder_display: number; method: string }
export type CreditScore = { score: number; risk: 'green' | 'amber' | 'red'; reasons: string[]; method: string }
export const Ia = {
  reappro: () => api.get<ReapproItem[]>('/ia/reappro').then((r) => r.data),
  creditScore: (payload: { amount: number; due_date?: string | null; client_name?: string | null; client_id?: number | null }) =>
    api.post<CreditScore>('/ia/credit-score', payload).then((r) => r.data),
}

/** Les 3 chiffres de l'en-tete d'accueil, agreges par le serveur. */
export type ResumeJour = { date: string; ca: number | null; articles: number | null; stock: number | null }

export const Stats = {
  /* Remplace le telechargement de TOUT l'historique des ventes (~450 octets par
     vente, a chaque changement d'ecran) par une reponse de taille constante.
     Les champs valent `null` quand l'employe n'a pas le droit de les voir. */
  resumeJour: (): Promise<ResumeJour> => api.get('/stats/resume-jour').then((r) => r.data),
  stockFaible: (seuil = 5) => api.get(`/stats/stock-faible?seuil=${seuil}`).then((r) => r.data),
  ventesParJour: () => api.get('/stats/ventes-par-jour').then((r) => r.data),
  paiements: () => api.get('/stats/paiements').then((r) => r.data),
  topProduits: () => api.get('/stats/top-produits').then((r) => r.data),
  margeCategorie: () => api.get('/stats/marge-categorie').then((r) => r.data),
  rotationStock: () => api.get('/stats/rotation-stock').then((r) => r.data),
  meilleursClients: () => api.get('/stats/meilleurs-clients').then((r) => r.data),
  marchandage: () => api.get('/stats/marchandage').then((r) => r.data),
}

// --- Admin ---
export const Admin = {
  overview: () => api.get('/admin-stats/overview').then((r) => r.data),
  revenus: (period = 'monthly') => api.get(`/admin-stats/revenus?period=${period}`).then((r) => r.data),
  transactions: (limit = 10) => api.get(`/admin-stats/transactions?limit=${limit}`).then((r) => r.data),
  accounts: () => api.get('/admin-stats/accounts').then((r) => r.data),
  evolution: () => api.get('/admin-stats/revenus/evolution').then((r) => r.data),
  users: () => api.get('/auth/users').then((r) => r.data),
  block: (id: number) => api.put(`/auth/users/${id}/block`),
  activate: (id: number) => api.put(`/auth/users/${id}/activate`),
  deleteUser: (id: number) => api.delete(`/auth/users/${id}`),
  approve: (id: number) => api.put(`/auth/upgrade/${id}/approve`),
  reject: (id: number) => api.put(`/auth/upgrade/${id}/reject`),
  withdrawals: () => api.get('/admin-withdrawals').then((r) => r.data),
  withdraw: (amount: number, method: string) => api.post('/admin-withdrawals', { amount, method }),
  transfers: () => api.get('/admin-transfers').then((r) => r.data),
  transfer: (from: string, to: string, amount: number) => api.post('/admin-transfers', { from, to, amount }),
  settings: () => api.get('/admin-settings').then((r) => r.data),
  toggle2fa: () => api.patch('/admin-settings/twofa').then((r) => r.data),
}

export type Boutique = { id: number; name: string; phone: string | null; address: string | null; emoji: string; is_primary: boolean; photo?: string | null; nb_produits?: number; nb_ventes?: number; nb_membres?: number }
export type BoutiqueLine = {
  id: number; name: string; emoji: string; photo?: string | null; is_primary: boolean
  ca_jour: number; nb_ventes_jour: number; ca_mois: number
  nb_produits: number; stock_total: number; ruptures: number; stock_faible: number
  credits_impayes: number; nb_membres: number
}
export type BoutiquesDashboard = {
  boutiques: BoutiqueLine[]
  total: { ca_jour: number; nb_ventes_jour: number; ca_mois: number; nb_produits: number; ruptures: number; credits_impayes: number; nb_boutiques: number }
  meilleure: BoutiqueLine | null
}

export type Member = {
  id: number; email: string; role: string; status: string; permissions: Record<string, boolean>; member_id: number | null
  /** Fiche saisie par le patron (prime sur le compte lié). */
  name?: string | null; phone?: string | null; photo?: string | null
  /** Repli : infos du compte utilisateur quand l'invitation a été acceptée. */
  user_company_name?: string | null; user_phone?: string | null
}

export const ALL_PERMS = ['vente', 'stock', 'categories', 'rapports', 'caisse', 'credits', 'clients', 'fournisseurs', 'commandes', 'livraisons']

export const Boutiques = {
  list: () => api.get<Boutique[]>('/boutiques').then((r) => r.data),
  create: (b: Partial<Boutique>) => api.post<Boutique>('/boutiques', b).then((r) => r.data),
  update: (id: number, b: Partial<Boutique>) => api.patch(`/boutiques/${id}`, b).then((r) => r.data),
  remove: (id: number) => api.delete(`/boutiques/${id}`),
  switch: (id: number) => api.post(`/boutiques/${id}/switch`).then((r) => r.data),
  /** Vue consolidée de toutes les boutiques (multi-boutique). */
  dashboard: () => api.get<BoutiquesDashboard>('/boutiques/dashboard').then((r) => r.data),
}
export const Members = {
  list: () => api.get<Member[]>('/members').then((r) => r.data),
  invite: (payload: { email: string; role: string; permissions?: Record<string, boolean>; name?: string | null; phone?: string | null; photo?: string | null }) =>
    api.post('/members/invite', payload).then((r) => r.data),
  accept: (invite_token: string) => api.post('/members/accept', { invite_token }).then((r) => r.data),
  /** Aperçu public d'une invitation (avant même que l'invité ait un compte). */
  preview: (token: string) =>
    api.get<{ boutique: string | null; role: string; email: string; name: string | null }>(
      `/members/invite/${encodeURIComponent(token)}`,
    ).then((r) => r.data),
  update: (id: number, payload: { permissions?: Record<string, boolean>; role?: string; name?: string | null; phone?: string | null; photo?: string | null }) =>
    api.patch(`/members/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/members/${id}`),
}

export function me() { return api.get('/auth/me').then((r) => r.data) }
/** Réglages d'écran synchronisés entre les appareils du compte. */
export type Preferences = { modules_off?: string[]; auto_print?: boolean }

export function updatePreferences(prefs: Preferences) {
  return api.put<{ preferences: Preferences }>('/auth/preferences', prefs).then((r) => r.data.preferences)
}

export function updateProfile(payload: { company_name?: string; phone?: string; photo?: string | null }) {
  return api.put('/auth/profile', payload).then((r) => r.data)
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
export function dateFr(value?: string | null): string {
  if (!value) return '—'
  const jour = String(value).slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(value)
}

/** Identité de la boutique, en-tête des messages WhatsApp et des exports. */
export function boutiqueIdentity(): { nom: string; telephone?: string | null } {
  const u = getUser()
  return { nom: u?.company_name || 'Ma Boutique', telephone: u?.phone }
}
