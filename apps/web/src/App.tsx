import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { getToken, getUser, saveUser, me, logout, SESSION_EXPIRED_EVENT, Members, Boutiques, Stats, Clients as ClientsApi, fcfa, type User, type Boutique, type Client } from './lib/api'
import { clearInvite, pendingInvite } from './lib/invite'
import { toast } from './lib/toast'
import Login from './sections/Login'
import Home, { type View } from './sections/Home'
import Stock from './sections/Stock'
import Vente from './sections/Vente'
import CategoriesSection from './sections/CategoriesSection'
// Design 3.7 — sections lourdes (chart.js / jspdf) chargées en lazy (perf budget).
const Rapports = lazy(() => import('./sections/Rapports'))
const Credits = lazy(() => import('./sections/Credits'))
const Inventaire = lazy(() => import('./sections/Inventaire'))
const BoutiquesDashboard = lazy(() => import('./sections/BoutiquesDashboard'))
const AdminApp = lazy(() => import('./sections/admin/AdminApp'))
import Premium from './sections/Premium'
import PlusSheet from './sections/PlusSheet'
import Onboarding from './components/Onboarding'
import PinLock from './components/PinLock'
import Odometer from './components/Odometer'
import CommandPalette, { type Command } from './components/CommandPalette'
import { cycleTheme, getThemePref, THEME_LABEL, type ThemePref } from './lib/theme'
import { useProduits, LISTE_VIDE } from './lib/queries'
import { isModuleEnabled, MODULES_EVENT, hydrateFromServer, pushPreferences, clearLocalPreferences } from './lib/modules'
import Avatar from './components/Avatar'
import { usePullToRefresh } from './lib/usePullToRefresh'
import { initOfflineSync, pendingCount, syncPending } from './lib/offlineQueue'
import { notifyStock } from './lib/notifications'
import { t } from './lib/i18n'
import Clients from './sections/Clients'
import Fournisseurs from './sections/Fournisseurs'
const Caisse = lazy(() => import('./sections/Caisse')) // jspdf → lazy
import Returns from './sections/Returns'
import Commandes from './sections/Commandes'
import Livraisons from './sections/Livraisons'
import BoutiquesSection from './sections/BoutiquesSection'
import Equipe from './sections/Equipe'
import Profil from './sections/Profil'
import IaReappro from './sections/IaReappro'
import Logo from './components/Logo'

const TITLES: Record<View, string> = {
  menu: t('title.menu'), dashboard: 'Toutes mes boutiques', vente: t('title.vente'), stock: t('title.stock'),
  categories: t('title.categories'), rapports: t('title.rapports'), inventaire: t('title.inventaire'), credits: t('title.credits'),
  clients: t('title.clients'), fournisseurs: t('title.fournisseurs'), caisse: t('title.caisse'), commandes: t('title.commandes'), returns: t('title.returns'), livraisons: t('title.livraisons'), boutiques: t('title.boutiques'), equipe: t('title.equipe'), profil: t('title.profil'), ia: t('title.ia'),
}

// Liste de navigation (sidebar desktop) — emoji + libellé
const NAV: { view: View; icon: string; label: string }[] = [
  { view: 'menu', icon: '🏠', label: t('nav.menu') },
  { view: 'vente', icon: '🛒', label: t('nav.vente') },
  { view: 'stock', icon: '📦', label: t('nav.stock') },
  { view: 'rapports', icon: '📈', label: t('nav.rapports') },
  { view: 'ia', icon: '🤖', label: t('nav.ia') },
  { view: 'credits', icon: '🤝', label: t('nav.credits') },
  { view: 'inventaire', icon: '📋', label: t('nav.inventaire') },
  { view: 'categories', icon: '🗂️', label: t('nav.categories') },
  { view: 'clients', icon: '👤', label: t('nav.clients') },
  { view: 'fournisseurs', icon: '🚚', label: t('nav.fournisseurs') },
  { view: 'commandes', icon: '📋', label: t('nav.commandes') },
  { view: 'livraisons', icon: '🛵', label: t('nav.livraisons') },
  { view: 'caisse', icon: '💰', label: t('nav.caisse') },
  { view: 'returns', icon: '↩️', label: t('nav.returns') },
  { view: 'boutiques', icon: '🏬', label: t('nav.boutiques') },
  { view: 'equipe', icon: '👥', label: t('nav.equipe') },
  { view: 'profil', icon: '⚙️', label: t('nav.profil') },
]

const PERM_BY_VIEW: Partial<Record<View, string>> = {
  vente: 'vente', stock: 'stock', categories: 'categories', rapports: 'rapports',
  inventaire: 'stock', credits: 'vente', clients: 'clients', fournisseurs: 'fournisseurs',
  caisse: 'caisse', commandes: 'commandes', returns: 'credits', livraisons: 'livraisons', ia: 'stock',
}
const OWNER_ONLY: View[] = ['boutiques', 'equipe', 'dashboard']

/**
 * Deux filtres bien distincts se superposent sur la navigation :
 *  - `canAccess` = DROIT (permissions de l'employé) — non négociable ;
 *  - `isModuleEnabled` = CHOIX d'affichage du commerçant (Paramètres).
 * On les garde séparés : masquer une section ne doit jamais donner un droit,
 * et un employé ne doit pas pouvoir s'ouvrir une section en la « réactivant ».
 */
function canAccess(user: User | null, view: View): boolean {
  if (view === 'menu') return true
  if (!user?.is_employee) return true
  if (OWNER_ONLY.includes(view)) return false
  const key = PERM_BY_VIEW[view]
  return key ? !!user.permissions?.[key] : true
}

/** Section réellement affichable : droit ET activée dans les Paramètres. */
function isVisible(user: User | null, view: View): boolean {
  return canAccess(user, view) && isModuleEnabled(view)
}

export default function App() {
  const [user, setUser] = useState<User | null>(getUser())
  const [authed, setAuthed] = useState(!!getToken())
  const [view, setView] = useState<View>('menu')
  const [showPremium, setShowPremium] = useState(false)
  const [showPlus, setShowPlus] = useState(false)
  const [stats, setStats] = useState({ ca: 0, articles: 0, stock: 0 })
  const [desktop, setDesktop] = useState(window.matchMedia('(min-width: 1024px)').matches)
  const [online, setOnline] = useState(navigator.onLine)
  const [pendingSync, setPendingSync] = useState(0)
  const [boutiques, setBoutiques] = useState<Boutique[]>([])
  const [alerts, setAlerts] = useState<{ produit: string; stock: number }[]>([])
  const [showBoutiques, setShowBoutiques] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(localStorage.getItem('samacommerce_onboarded') !== '1')
  const [refreshKey, setRefreshKey] = useState(0)
  const notifiedRef = useRef(false)
  const [gQuery, setGQuery] = useState('')
  /* Recherche globale : meme cache que Stock et Vendre. Avant, cette liste
     etait retelechargee a CHAQUE changement d'ecran, en plus des ventes. */
  const gProducts = useProduits(authed).data ?? LISTE_VIDE
  const [gClients, setGClients] = useState<Client[]>([])
  const [themePref, setThemePref] = useState<ThemePref>(getThemePref())
  // Redessine la navigation quand l'utilisateur active/masque une section.
  const [modulesRev, setModulesRev] = useState(0)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => setDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const onModules = () => setModulesRev((n) => n + 1)
    window.addEventListener(MODULES_EVENT, onModules)
    return () => window.removeEventListener(MODULES_EVENT, onModules)
  }, [])

  /* Un seul appel, de taille CONSTANTE : le serveur agrege. Avant, chaque
     changement d'ecran retelechargeait tout l'historique des ventes pour
     recalculer trois nombres en JavaScript (34 Ko pour 75 ventes, et ca
     grossissait sans fin). Les champs `null` = l'employe n'y a pas droit. */
  const refreshStats = () => {
    if (!getToken()) return
    Stats.resumeJour()
      .then((r) => setStats({ ca: r.ca ?? 0, articles: r.articles ?? 0, stock: r.stock ?? 0 }))
      .catch(() => {})
  }
  useEffect(() => { if (authed && user?.role !== 'admin') refreshStats() }, [authed, view, user?.role])
  /* Le serveur a refusé notre jeton (session expirée, ou révoquée depuis un
     autre appareil) : on repart proprement sur l'écran de connexion.
     Sans ça, l'application restait « connectée » avec un jeton mort et TOUS les
     écrans s'affichaient vides — l'utilisateur croyait ses données perdues. */
  useEffect(() => {
    const onExpired = () => {
      setAuthed(false); setUser(null); setView('menu')
      toast('Session expirée — reconnectez-vous', 'info')
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

  // /auth/me rapporte aussi les réglages d'écran du compte : c'est ce qui fait
  // qu'un second téléphone retrouve les mêmes sections activées.
  useEffect(() => {
    if (!authed) return
    me().then((full) => { saveUser(full); setUser(full); hydrateFromServer(full.preferences) }).catch(() => {})
  }, [authed])

  /* Invitation reçue par lien : l'acceptation exige d'être connecté (elle
     rattache la boutique à un compte). On la rejoue donc ici, dès que le compte
     existe — que l'employé vienne de le créer ou qu'il se soit connecté à un
     compte déjà ouvert. Il n'a rien à coller nulle part.

     Le garde-fou `useRef` est nécessaire : en développement React monte les
     effets deux fois, et le second appel consommerait un jeton déjà utilisé —
     l'employé verrait « invitation invalide » alors qu'il vient d'entrer.

     Rechargement à la fin : rejoindre une boutique change le locataire de
     TOUTES les données (produits, ventes, caisse) déjà chargées sous l'ancien
     compte. C'est le même geste que le changement de boutique, qui recharge
     lui aussi — et cela évite une course entre les deux lectures de /auth/me. */
  const inviteTraitee = useRef(false)
  useEffect(() => {
    if (!authed || inviteTraitee.current) return
    const token = pendingInvite()
    if (!token) return
    inviteTraitee.current = true
    Members.accept(token)
      .then((d) => {
        clearInvite()
        toast(`Vous avez rejoint ${d?.boutique?.company_name || 'la boutique'} 🎉`, 'success')
        setTimeout(() => window.location.reload(), 1200)
      })
      .catch((e) => {
        // Réponse du serveur = jeton mort (déjà utilisé, expiré) : on l'oublie,
        // sinon l'erreur reviendrait à chaque connexion.
        if (e?.response) {
          clearInvite()
          toast(e.response.data?.error || 'Invitation invalide ou expirée', 'error')
        } else {
          inviteTraitee.current = false // panne réseau : on réessaiera
        }
      })
  }, [authed])

  // Réseau (indicateur hors-ligne)
  useEffect(() => {
    // Au retour du réseau, on renvoie les réglages modifiés hors ligne.
    const on = () => { setOnline(true); void pushPreferences() }
    const off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // T11 — synchronisation des ventes hors-ligne + compteur en attente
  useEffect(() => {
    if (!authed || user?.role === 'admin') return
    const refresh = () => pendingCount().then(setPendingSync).catch(() => {})
    const stop = initOfflineSync(() => { refresh(); refreshStats() })
    refresh()
    return stop
  }, [authed, user?.role])

  /* Boutiques : la liste ne change pas d'un écran à l'autre, et changer de
     boutique recharge la page. Une seule lecture par session suffit — avant,
     elle repartait à CHAQUE navigation. */
  useEffect(() => {
    if (!authed || user?.role === 'admin') return
    Boutiques.list().then(setBoutiques).catch(() => {})
  }, [authed, user?.role])

  // Alertes de stock (cloche) + fichier clients de la recherche globale.
  useEffect(() => {
    if (!authed || user?.role === 'admin') return
    Stats.stockFaible(5).then((a) => { setAlerts(a); if (!notifiedRef.current) { notifiedRef.current = true; notifyStock(a) } }).catch(() => {})
    ClientsApi.list().then(setGClients).catch(() => {})
  }, [authed, view, user?.role])

  const q = gQuery.trim().toLowerCase()
  const gMatchP = q.length >= 2 ? gProducts.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5) : []
  const gMatchC = q.length >= 2 ? gClients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 4) : []

  const switchBoutique = async (b: Boutique) => {
    await Boutiques.switch(b.id)
    const u = getUser(); if (u) saveUser({ ...u, current_boutique_id: b.id })
    window.location.reload()
  }

  const { pull, refreshing, handlers } = usePullToRefresh(async () => {
    setRefreshKey((k) => k + 1); refreshStats()
    await new Promise((r) => setTimeout(r, 450))
  })

  if (!authed) return <Login onLogin={(u) => { setUser(u); setAuthed(true) }} />

  // Les réglages d'écran sont rechargés depuis le compte à la connexion : on
  // purge le local pour qu'un autre commerçant sur le même téléphone ne récupère
  // pas l'application configurée du précédent.
  const doLogout = () => { logout(); clearLocalPreferences(); setAuthed(false); setUser(null); setView('menu') }
  if (user?.role === 'admin') return <Suspense fallback={<SectionLoader />}><AdminApp user={user} onLogout={doLogout} /></Suspense>

  const go = (v: View) => setView(canAccess(user, v) ? v : view)
  const boutiqueActive = boutiques.find((b) => b.id === user?.current_boutique_id)

  void modulesRev // relit les modules actifs à chaque changement
  const section = !canAccess(user, view) ? <AccessDenied /> : (<Suspense fallback={<SectionLoader />}>
    {view === 'dashboard' && <BoutiquesDashboard onNavigate={setView} />}
    {view === 'menu' && <Home user={user} can={(v) => isVisible(user, v)} onNavigate={setView} onLogout={doLogout} onUpgrade={() => setShowPremium(true)} desktop={desktop} stats={stats} />}
    {view === 'vente' && <Vente />}
    {view === 'stock' && <Stock />}
    {view === 'categories' && <CategoriesSection />}
    {view === 'rapports' && <Rapports />}
    {view === 'ia' && <IaReappro onNavigate={setView} />}
    {view === 'credits' && <Credits />}
    {view === 'inventaire' && <Inventaire />}
    {view === 'clients' && <Clients />}
    {view === 'fournisseurs' && <Fournisseurs />}
    {view === 'caisse' && <Caisse />}
    {view === 'returns' && <Returns />}
    {view === 'commandes' && <Commandes />}
    {view === 'livraisons' && <Livraisons />}
    {view === 'boutiques' && <BoutiquesSection />}
    {view === 'equipe' && <Equipe />}
    {view === 'profil' && <Profil user={user} onLogout={doLogout} onUpgrade={() => setShowPremium(true)} />}
  </Suspense>)

  // Design 3.6 — commandes de la palette (Ctrl+K) : navigation + actions rapides.
  const commands: Command[] = [
    ...NAV.filter((n) => isVisible(user, n.view)).map((n) => ({
      id: 'go-' + n.view, icon: n.icon, label: n.label, hint: 'Aller à', run: () => go(n.view),
    })),
    { id: 'act-vendre', icon: '💳', label: 'Nouvelle vente', hint: 'Action', run: () => go('vente') },
    { id: 'act-theme', icon: '🌓', label: 'Thème : auto / clair / sombre', hint: 'Action', run: () => setThemePref(cycleTheme()) },
    { id: 'act-logout', icon: '🔓', label: 'Se déconnecter', hint: 'Action', run: doLogout },
  ]

  const modals = (<>
    {showPremium && <Premium onClose={() => setShowPremium(false)} onUpgraded={() => setUser((u) => (u ? { ...u, plan: 'Premium' } : u))} />}
    {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
    <PinLock />
    <CommandPalette commands={commands} />
  </>)

  // ═══════════ DESKTOP : sidebar + topbar ═══════════
  if (desktop) {
    return (
      <div className="dk-shell">
        <aside className="dk-sidebar">
          {/* Le logo ramène à l'accueil (convention web attendue). */}
          <button className="dk-logo" onClick={() => go('menu')} title="Retour à l'accueil" aria-label="Retour à l'accueil">
            <Logo size={38} className="dk-logo-badge" /> Sama<span style={{ opacity: .85 }}>Commerce</span>
          </button>
          <nav className="dk-nav">
            {NAV.filter((n) => isVisible(user, n.view)).map((n) => (
              <button key={n.view} className={`dk-nav-item ${view === n.view ? 'active' : ''}`} onClick={() => go(n.view)}>
                <span className="di">{n.icon}</span> {n.label}
              </button>
            ))}
          </nav>
          {user?.plan === 'Free' && !user?.is_employee && (
            <div className="dk-premium" onClick={() => setShowPremium(true)}>
              <div style={{ fontSize: 22 }}>👑</div>
              <div className="dk-premium-title">Passer Premium</div>
              <div className="dk-premium-sub">IA + multi-boutique</div>
            </div>
          )}
        </aside>
        <div className="dk-main">
          {!online && <div className="offline-bar">📴 Hors ligne — les données affichées peuvent être anciennes</div>}
          {pendingSync > 0 && <button className="sync-bar" onClick={() => syncPending().then(() => pendingCount().then(setPendingSync))}>🔄 {pendingSync} vente{pendingSync > 1 ? 's' : ''} en attente de synchronisation{online ? ' — cliquer pour synchroniser' : ''}</button>}
          <div className="dk-topbar">
            <div style={{ position: 'relative' }}>
              <input className="dk-search" style={{ border: 'none', outline: 'none' }} placeholder="🔍 Rechercher un produit, un client…" value={gQuery} onChange={(e) => setGQuery(e.target.value)} />
              {q.length >= 2 && (
                <div className="notif-panel" style={{ left: 0, right: 'auto', top: 50, width: 320 }}>
                  {gMatchP.length === 0 && gMatchC.length === 0 && <div className="notif-item" style={{ color: 'var(--muted)' }}>Aucun résultat</div>}
                  {gMatchP.map((p) => (
                    <button key={'p' + p.id} className="bsel-item" onClick={() => { setView('stock'); setGQuery('') }}>
                      📦 <div style={{ flex: 1 }}>{p.name}</div><span style={{ color: 'var(--green)', fontWeight: 700 }}>{fcfa(p.price)}</span>
                    </button>
                  ))}
                  {gMatchC.map((c) => (
                    <button key={'c' + c.id} className="bsel-item" onClick={() => { setView('clients'); setGQuery('') }}>
                      👤 <div style={{ flex: 1 }}>{c.name}</div><span style={{ color: 'var(--muted)', fontSize: 12 }}>client</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <button className="dk-boutique" style={{ marginLeft: 0, cursor: 'pointer' }} onClick={() => setShowBoutiques((s) => !s)}>🏪 {user?.company_name || 'Ma Boutique'} ▾</button>
              {showBoutiques && (
                <div className="bsel-menu">
                  {/* Vue consolidée : elle ne change pas de boutique, elle les réunit. */}
                  {!user?.is_employee && boutiques.length > 1 && (
                    <button className="bsel-item" onClick={() => { setView('dashboard'); setShowBoutiques(false) }}>
                      <span>📊</span> Toutes mes boutiques
                    </button>
                  )}
                  {boutiques.map((b) => (
                    <button key={b.id} className={`bsel-item ${b.id === user?.current_boutique_id ? 'active' : ''}`} onClick={() => switchBoutique(b)}>
                      <span>{b.emoji}</span> {b.name} {b.id === user?.current_boutique_id && '✓'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="dk-icon-btn" title={`Thème : ${THEME_LABEL[themePref].label}`} aria-label={`Thème : ${THEME_LABEL[themePref].label} — changer`}
              onClick={(e) => setThemePref(cycleTheme({ x: e.clientX, y: e.clientY }))}>{THEME_LABEL[themePref].icon}</button>
            <div style={{ position: 'relative' }}>
              <button className="dk-icon-btn" aria-label="Notifications" onClick={() => setShowNotif((s) => !s)}>🔔{alerts.length > 0 && <span style={{ position: 'absolute', top: 8, right: 9, width: 8, height: 8, background: 'var(--accent)', borderRadius: '50%' }} />}</button>
              {showNotif && (
                <div className="notif-panel">
                  <div className="notif-head">Alertes de stock ({alerts.length})</div>
                  {alerts.length === 0 ? <div className="notif-item" style={{ color: 'var(--muted)' }}>Aucune alerte 🎉</div>
                    : alerts.map((a, i) => <div key={i} className="notif-item"><span>⚠️</span><div style={{ flex: 1 }}>{a.produit}</div><span style={{ color: 'var(--danger)', fontWeight: 700 }}>{a.stock}</span></div>)}
                </div>
              )}
            </div>
            <div className="dk-profile">
              <div className="dk-avatar">{(user?.company_name || 'SC').slice(0, 2).toUpperCase()}</div>
              <div style={{ fontSize: 12.5 }}>
                <div className="sora" style={{ fontWeight: 700 }}>{user?.username}</div>
                <div style={{ color: 'var(--muted2)', fontSize: 11 }}>{user?.is_employee ? 'Employé' : 'Propriétaire'}</div>
              </div>
              <button className="btn-quiet" style={{ marginLeft: 8 }} onClick={doLogout}>Quitter</button>
            </div>
          </div>
          <div className="dk-content"><div className="dk-content-inner">{section}</div></div>
        </div>
        {modals}
      </div>
    )
  }

  // ═══════════ MOBILE : header + bottom-nav ═══════════
  return (
    <div className="app-container">
      {!online && <div className="offline-bar">📴 Hors ligne</div>}
      {pendingSync > 0 && <button className="sync-bar" onClick={() => syncPending().then(() => pendingCount().then(setPendingSync))}>🔄 {pendingSync} vente{pendingSync > 1 ? 's' : ''} en attente de sync</button>}
      {showNotif && (
        <div className="notif-panel" style={{ top: 60 }}>
          <div className="notif-head">Alertes de stock ({alerts.length})</div>
          {alerts.length === 0 ? <div className="notif-item" style={{ color: 'var(--muted)' }}>Aucune alerte 🎉</div>
            : alerts.map((a, i) => <div key={i} className="notif-item"><span>⚠️</span><div style={{ flex: 1 }}>{a.produit}</div><span style={{ color: 'var(--danger)', fontWeight: 700 }}>{a.stock}</span></div>)}
        </div>
      )}
      <div className="top-header">
        <div className="header-inner">
          {view !== 'menu'
            ? <button className="back-btn" aria-label="Retour à l'accueil" onClick={() => setView('menu')}>←</button>
            : <button className="header-icon" style={{ border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
                aria-label="Mon profil" onClick={() => setView('profil')}>
                <Avatar photo={user?.photo} name={user?.company_name} size={40} radius={12} tint="rgba(255,255,255,.18)" />
              </button>}
          <div className="header-center" style={{ textAlign: view === 'menu' ? 'left' : 'center' }}>
            {view === 'menu'
              ? (
                <>
                  <div className="header-sub">Bonjour 👋</div>
                  {/* Le sélecteur de boutique n'existait que sur ordinateur : sur
                      téléphone, on ne pouvait pas changer de point de vente.
                      Le nom devient donc un bouton dès qu'il y a plusieurs boutiques. */}
                  {boutiques.length > 1 ? (
                    <button className="header-shop" onClick={() => setShowBoutiques(true)} aria-label="Changer de boutique">
                      <span className="header-title">{boutiqueActive?.name || user?.company_name || 'Sama Commerce'}</span>
                      <span aria-hidden="true">▾</span>
                    </button>
                  ) : (
                    <div className="header-title">{user?.company_name || 'Sama Commerce'}</div>
                  )}
                </>
              )
              : <div className="header-title">{TITLES[view]}</div>}
          </div>
          <button className="header-icon" aria-label="Notifications" style={{ border: 'none', cursor: 'pointer', position: 'relative' }} onClick={() => setShowNotif((s) => !s)}>🔔{alerts.length > 0 && <span style={{ position: 'absolute', top: 7, right: 8, width: 8, height: 8, background: '#fbbf24', borderRadius: '50%' }} />}</button>
        </div>
        {view === 'menu' && (
          <div style={{ marginTop: 16, position: 'relative', zIndex: 1 }}>
            <div className="header-sub">🔥 Encaissé aujourd'hui</div>
            <Odometer value={stats.ca} className="sora header-ca" />
          </div>
        )}
      </div>

      {/* Ces compteurs n'ont de sens que sur l'accueil : ailleurs ils mangeaient
          110 px de hauteur utile sur chaque écran, et sur « Chiffres » ils
          répétaient les chiffres affichés juste en dessous.
          « En stock » compte des ARTICLES, pas des références — le libellé
          précédent (« Réf. en stock ») annonçait une autre grandeur que celle
          réellement calculée. La troisième case mène au stock quand un produit
          s'épuise : le compteur devient alors une alerte sur laquelle agir. */}
      {view === 'menu' && (
        <div className="today-float">
          <div className="ts g"><Odometer value={stats.ca} className="v" /><div className="l">Encaissé</div></div>
          <div className="ts b"><Odometer value={stats.articles} format={(n) => String(n)} className="v" /><div className="l">Vendus</div></div>
          {alerts.length > 0
            ? <button className="ts r" onClick={() => go('stock')} style={{ border: 'none', cursor: 'pointer', font: 'inherit' }}>
                <div className="v">{alerts.length}</div><div className="l">À racheter</div>
              </button>
            : <div className="ts o"><Odometer value={stats.stock} format={(n) => String(n)} className="v" /><div className="l">En stock</div></div>}
        </div>
      )}

      <div className="scroll-content" {...handlers}>
        {(pull > 0 || refreshing) && (
          <div style={{ height: pull, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13, overflow: 'hidden', transition: refreshing ? 'none' : 'height .15s' }}>
            {refreshing ? '⟳ Actualisation…' : pull > 50 ? '↑ Relâcher pour actualiser' : '↓ Tirer pour actualiser'}
          </div>
        )}
        <div className="section-page" key={`${view}-${refreshKey}`}>{section}</div>
      </div>

      <div className="bottom-nav">
        <NavBtn active={view === 'menu'} icon="🏠" label={t('nav.menu')} onClick={() => setView('menu')} />
        {/* Raccourci de gauche : la première section utile encore activée. Si
            le commerçant a tout masqué sauf Vendre, on ne laisse pas un bouton
            mort dans sa barre. */}
        {(() => {
          const shortcut = (['rapports', 'stock', 'inventaire', 'clients', 'credits'] as View[]).find((v) => isVisible(user, v))
          const meta = NAV.find((n) => n.view === shortcut)
          return shortcut && meta
            ? <NavBtn active={view === shortcut} icon={meta.icon} label={meta.label} onClick={() => setView(shortcut)} />
            : <span className="nav-btn" aria-hidden="true" />
        })()}
        {/* Bouton central : Vendre, ou la principale section restante. Le rond
            porte son libellé — un pictogramme seul dans un cercle ne dit pas
            ce qu'il déclenche. */}
        {(() => {
          const main = (['vente', 'stock', 'rapports'] as View[]).find((v) => isVisible(user, v))
          const meta = NAV.find((n) => n.view === main)
          const label = main ? (meta?.label || t('nav.vente')) : t('nav.menu')
          return (
            <span className="nav-fab-wrap">
              <button className="nav-fab" aria-label={label} title={label}
                onClick={() => (main ? go(main) : setView('menu'))}>
                {main ? (main === 'vente' ? '🛒' : meta?.icon) : '🏠'}
              </button>
              <span className="nav-fab-l" aria-hidden="true">{label}</span>
            </span>
          )
        })()}
        <NavBtn active={view === 'profil'} icon="👤" label={t('nav.profil')} onClick={() => setView('profil')} />
        <NavBtn active={showPlus} icon="＋" label="Plus" onClick={() => setShowPlus(true)} />
      </div>

      {showBoutiques && (
        <div className="modal-overlay" style={{ alignItems: 'flex-end' }} onClick={() => setShowBoutiques(false)}>
          <div className="modal-box" style={{ maxWidth: 480, borderRadius: '22px 22px 0 0' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">🏬 Ma boutique</div>
            {!user?.is_employee && (
              <button className="sheet-item" onClick={() => { setView('dashboard'); setShowBoutiques(false) }}>
                <span className="sheet-icon" style={{ background: '#EDE9FE' }}>📊</span>
                <div><h3>Toutes mes boutiques</h3><p>Vue d'ensemble et comparaison</p></div>
                <span className="sheet-chevron">›</span>
              </button>
            )}
            {boutiques.map((b) => (
              <button key={b.id} className="sheet-item" onClick={() => switchBoutique(b)}>
                <Avatar photo={b.photo} icon={b.photo ? undefined : (b.emoji || '🏪')} name={b.name} size={46} radius={13} />
                <div>
                  <h3>{b.name}</h3>
                  <p>{b.nb_produits || 0} produit(s) · {b.nb_ventes || 0} vente(s)</p>
                </div>
                <span className="sheet-chevron">{b.id === user?.current_boutique_id ? '✅' : '›'}</span>
              </button>
            ))}
            <button className="btn-cancel" style={{ width: '100%', marginTop: 8 }} onClick={() => setShowBoutiques(false)}>Fermer</button>
          </div>
        </div>
      )}

      {showPlus && <PlusSheet can={(v) => isVisible(user, v)} onClose={() => setShowPlus(false)} onNavigate={(v) => { setView(v); setShowPlus(false) }} />}
      {modals}
    </div>
  )
}

function SectionLoader() {
  return (
    <div style={{ padding: 24 }}>
      <div className="skeleton" style={{ height: 28, width: '45%', marginBottom: 16 }} />
      <div className="sk-card"><div className="skeleton" style={{ height: 90 }} /></div>
      <div className="sk-card"><div className="skeleton" style={{ height: 90 }} /></div>
    </div>
  )
}

function AccessDenied() {
  return (
    <div className="empty-state" style={{ paddingTop: 60 }}>
      <div className="empty-icon">🔒</div>
      <div className="empty-text">Accès refusé</div>
      <div className="empty-sub">Vous n'avez pas la permission pour cette section. Contactez le propriétaire.</div>
    </div>
  )
}

function NavBtn({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button className={`nav-btn ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="ni">{icon}</span>
      <span className="nl">{label}</span>
    </button>
  )
}
