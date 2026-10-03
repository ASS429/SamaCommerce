import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { lireJeton, lireUtilisateur, enregistrerUtilisateur, moi, deconnecter, EVENEMENT_SESSION_EXPIREE, Membres, Boutiques, Statistiques, Clients as ApiClients, fcfa, type AlerteStock, type Utilisateur, type Boutique, type Client } from './outils/api'
import { oublierInvitation, invitationEnAttente } from './outils/invitation'
import { bulle } from './outils/bulles'
import Connexion from './sections/Connexion'
import Accueil, { type Ecran } from './sections/Accueil'
import Stock from './sections/Stock'
import Vente from './sections/Vente'
import SectionCategories from './sections/SectionCategories'
// Design 3.7 — sections lourdes (chart.js / jspdf) chargées en différé (budget de performance).
const Rapports = lazy(() => import('./sections/Rapports'))
const Credits = lazy(() => import('./sections/Credits'))
const Inventaire = lazy(() => import('./sections/Inventaire'))
const TableauBordBoutiques = lazy(() => import('./sections/TableauBordBoutiques'))
const ApplicationAdmin = lazy(() => import('./sections/admin/ApplicationAdmin'))
import MonPlan from './sections/MonPlan'
import CartePlan from './composants/CartePlan'
import FeuillePlanRequis from './composants/FeuillePlanRequis'
import VoletPlus from './sections/VoletPlus'
import PremiersPas from './composants/PremiersPas'
import VerrouPin from './composants/VerrouPin'
import Compteur from './composants/Compteur'
import PaletteCommandes, { type Commande } from './composants/PaletteCommandes'
import { changerTheme, lirePreferenceTheme, LIBELLES_THEME, type PreferenceTheme } from './outils/theme'
import { useProduits, LISTE_VIDE } from './outils/requetes'
import { sectionVisible, EVENEMENT_SECTIONS, appliquerReglagesDuServeur, envoyerReglages, effacerReglagesLocaux } from './outils/modules'
import Avatar from './composants/Avatar'
import { useTirerPourRafraichir } from './outils/useTirerPourRafraichir'
import { brancherSynchronisation, nombreVentesEnAttente, synchroniserVentesEnAttente } from './outils/fileHorsLigne'
import { notifierStock } from './outils/notifications'
import { traduire } from './outils/traductions'
import Clients from './sections/Clients'
import Fournisseurs from './sections/Fournisseurs'
const Caisse = lazy(() => import('./sections/Caisse')) // jspdf → différé
import Retours from './sections/Retours'
import Commandes from './sections/Commandes'
import Livraisons from './sections/Livraisons'
import SectionBoutiques from './sections/SectionBoutiques'
import Equipe from './sections/Equipe'
import Profil from './sections/Profil'
import IaReappro from './sections/IaReappro'
import Logo from './composants/Logo'
import AssistantVocal from './composants/AssistantVocalDiffere'

const TITRES: Record<Ecran, string> = {
  accueil: traduire('titre.accueil'), 'toutes-boutiques': 'Toutes mes boutiques', vente: traduire('titre.vente'), stock: traduire('titre.stock'),
  categories: traduire('titre.categories'), rapports: traduire('titre.rapports'), inventaire: traduire('titre.inventaire'), credits: traduire('titre.credits'),
  clients: traduire('titre.clients'), fournisseurs: traduire('titre.fournisseurs'), caisse: traduire('titre.caisse'), commandes: traduire('titre.commandes'), retours: traduire('titre.retours'), livraisons: traduire('titre.livraisons'), boutiques: traduire('titre.boutiques'), equipe: traduire('titre.equipe'), profil: traduire('titre.profil'), ia: traduire('titre.ia'),
  plan: traduire('titre.plan'),
}

// Liste de navigation (colonne latérale sur ordinateur) — emoji + libellé
const NAVIGATION: { ecran: Ecran; icone: string; libelle: string }[] = [
  { ecran: 'accueil', icone: '🏠', libelle: traduire('nav.accueil') },
  { ecran: 'vente', icone: '🛒', libelle: traduire('nav.vente') },
  { ecran: 'stock', icone: '📦', libelle: traduire('nav.stock') },
  { ecran: 'rapports', icone: '📈', libelle: traduire('nav.rapports') },
  { ecran: 'ia', icone: '🤖', libelle: traduire('nav.ia') },
  { ecran: 'credits', icone: '🤝', libelle: traduire('nav.credits') },
  { ecran: 'inventaire', icone: '📋', libelle: traduire('nav.inventaire') },
  { ecran: 'categories', icone: '🗂️', libelle: traduire('nav.categories') },
  { ecran: 'clients', icone: '👤', libelle: traduire('nav.clients') },
  { ecran: 'fournisseurs', icone: '🚚', libelle: traduire('nav.fournisseurs') },
  { ecran: 'commandes', icone: '📋', libelle: traduire('nav.commandes') },
  { ecran: 'livraisons', icone: '🛵', libelle: traduire('nav.livraisons') },
  { ecran: 'caisse', icone: '💰', libelle: traduire('nav.caisse') },
  { ecran: 'retours', icone: '↩️', libelle: traduire('nav.retours') },
  { ecran: 'boutiques', icone: '🏬', libelle: traduire('nav.boutiques') },
  { ecran: 'equipe', icone: '👥', libelle: traduire('nav.equipe') },
  { ecran: 'profil', icone: '⚙️', libelle: traduire('nav.profil') },
]

const PERMISSION_PAR_ECRAN: Partial<Record<Ecran, string>> = {
  vente: 'vente', stock: 'stock', categories: 'categories', rapports: 'rapports',
  inventaire: 'stock', credits: 'vente', clients: 'clients', fournisseurs: 'fournisseurs',
  caisse: 'caisse', commandes: 'commandes', retours: 'credits', livraisons: 'livraisons', ia: 'stock',
}
const RESERVES_AU_PROPRIETAIRE: Ecran[] = ['boutiques', 'equipe', 'toutes-boutiques', 'plan']

/**
 * Deux filtres bien distincts se superposent sur la navigation :
 *  - `peutAcceder` = DROIT (permissions de l'employé) — non négociable ;
 *  - `sectionVisible` = CHOIX d'affichage du commerçant (Paramètres).
 * On les garde séparés : masquer une section ne doit jamais donner un droit,
 * et un employé ne doit pas pouvoir s'ouvrir une section en la « réaffichant ».
 */
function peutAcceder(utilisateur: Utilisateur | null, ecran: Ecran): boolean {
  if (ecran === 'accueil') return true
  if (!utilisateur?.est_employe) return true
  if (RESERVES_AU_PROPRIETAIRE.includes(ecran)) return false
  const cle = PERMISSION_PAR_ECRAN[ecran]
  return cle ? !!utilisateur.permissions?.[cle] : true
}

/** Section réellement affichable : droit ET affichée dans les Paramètres. */
function estVisible(utilisateur: Utilisateur | null, ecran: Ecran): boolean {
  return peutAcceder(utilisateur, ecran) && sectionVisible(ecran)
}

export default function Application() {
  const [utilisateur, definirUtilisateur] = useState<Utilisateur | null>(lireUtilisateur())
  const [connecte, definirConnecte] = useState(!!lireJeton())
  const [ecran, definirEcran] = useState<Ecran>('accueil')
  const [voletPlusOuvert, definirVoletPlusOuvert] = useState(false)
  const [chiffres, definirChiffres] = useState({ ca: 0, articles: 0, stock: 0 })
  const [bureau, definirBureau] = useState(window.matchMedia('(min-width: 1024px)').matches)
  const [enLigne, definirEnLigne] = useState(navigator.onLine)
  const [nbVentesEnAttente, definirNbVentesEnAttente] = useState(0)
  const [boutiques, definirBoutiques] = useState<Boutique[]>([])
  const [alertes, definirAlertes] = useState<AlerteStock[]>([])
  const [choixBoutiqueOuvert, definirChoixBoutiqueOuvert] = useState(false)
  const [notificationsOuvertes, definirNotificationsOuvertes] = useState(false)
  const [premiersPasOuverts, definirPremiersPasOuverts] = useState(localStorage.getItem('samacommerce_premiers_pas_vus') !== '1')
  const [cleRafraichissement, definirCleRafraichissement] = useState(0)
  const dejaNotifie = useRef(false)
  const [rechercheGlobale, definirRechercheGlobale] = useState('')
  /* Recherche globale : même cache que Stock et Vendre. Avant, cette liste
     était retéléchargée à CHAQUE changement d'écran, en plus des ventes. */
  const produitsRecherche = useProduits(connecte).data ?? LISTE_VIDE
  const [clientsRecherche, definirClientsRecherche] = useState<Client[]>([])
  const [preferenceTheme, definirPreferenceTheme] = useState<PreferenceTheme>(lirePreferenceTheme())
  // Redessine la navigation quand l'utilisateur affiche ou masque une section.
  const [versionSections, definirVersionSections] = useState(0)

  useEffect(() => {
    const requete = window.matchMedia('(min-width: 1024px)')
    const surChangement = (e: MediaQueryListEvent) => definirBureau(e.matches)
    requete.addEventListener('change', surChangement)
    return () => requete.removeEventListener('change', surChangement)
  }, [])

  useEffect(() => {
    const surSections = () => definirVersionSections((n) => n + 1)
    window.addEventListener(EVENEMENT_SECTIONS, surSections)
    return () => window.removeEventListener(EVENEMENT_SECTIONS, surSections)
  }, [])

  /* Un seul appel, de taille CONSTANTE : le serveur agrège. Avant, chaque
     changement d'écran retéléchargeait tout l'historique des ventes pour
     recalculer trois nombres en JavaScript (34 Ko pour 75 ventes, et ça
     grossissait sans fin). Les champs `null` = l'employé n'y a pas droit. */
  const rafraichirChiffres = () => {
    if (!lireJeton()) return
    Statistiques.resumeJour()
      .then((r) => definirChiffres({ ca: r.ca ?? 0, articles: r.articles ?? 0, stock: r.stock ?? 0 }))
      .catch(() => {})
  }
  useEffect(() => { if (connecte && utilisateur?.role !== 'admin') rafraichirChiffres() }, [connecte, ecran, utilisateur?.role])
  /* Le serveur a refusé notre jeton (session expirée, ou révoquée depuis un
     autre appareil) : on repart proprement sur l'écran de connexion.
     Sans ça, l'application restait « connectée » avec un jeton mort et TOUS les
     écrans s'affichaient vides — l'utilisateur croyait ses données perdues. */
  useEffect(() => {
    const surExpiration = () => {
      definirConnecte(false); definirUtilisateur(null); definirEcran('accueil')
      bulle('Session expirée — reconnectez-vous', 'info')
    }
    window.addEventListener(EVENEMENT_SESSION_EXPIREE, surExpiration)
    return () => window.removeEventListener(EVENEMENT_SESSION_EXPIREE, surExpiration)
  }, [])

  // /auth/moi rapporte aussi les réglages d'écran du compte : c'est ce qui fait
  // qu'un second téléphone retrouve les mêmes sections affichées.
  useEffect(() => {
    if (!connecte) return
    moi().then((complet) => { enregistrerUtilisateur(complet); definirUtilisateur(complet); appliquerReglagesDuServeur(complet.preferences) }).catch(() => {})
  }, [connecte])

  /* Invitation reçue par lien : l'acceptation exige d'être connecté (elle
     rattache la boutique à un compte). On la rejoue donc ici, dès que le compte
     existe — que l'employé vienne de le créer ou qu'il se soit connecté à un
     compte déjà ouvert. Il n'a rien à coller nulle part.

     Le garde-fou `useRef` est nécessaire : en développement React monte les
     effets deux fois, et le second appel consommerait un jeton déjà utilisé —
     l'employé verrait « invitation invalide » alors qu'il vient d'entrer.

     Rechargement à la fin : rejoindre une boutique change le propriétaire de
     TOUTES les données (produits, ventes, caisse) déjà chargées sous l'ancien
     compte. C'est le même geste que le changement de boutique, qui recharge
     lui aussi — et cela évite une course entre les deux lectures de /auth/moi. */
  const invitationTraitee = useRef(false)
  useEffect(() => {
    if (!connecte || invitationTraitee.current) return
    const jeton = invitationEnAttente()
    if (!jeton) return
    invitationTraitee.current = true
    Membres.accepter(jeton)
      .then((d) => {
        oublierInvitation()
        bulle(`Vous avez rejoint ${d?.boutique?.nom_commerce || 'la boutique'} 🎉`, 'succes')
        setTimeout(() => window.location.reload(), 1200)
      })
      .catch((e) => {
        // Réponse du serveur = jeton mort (déjà utilisé, expiré) : on l'oublie,
        // sinon l'erreur reviendrait à chaque connexion.
        if (e?.response) {
          oublierInvitation()
          bulle(e.response.data?.erreur || 'Invitation invalide ou expirée', 'erreur')
        } else {
          invitationTraitee.current = false // panne réseau : on réessaiera
        }
      })
  }, [connecte])

  // Réseau (indicateur hors ligne)
  useEffect(() => {
    // Au retour du réseau, on renvoie les réglages modifiés hors ligne.
    const surEnLigne = () => { definirEnLigne(true); void envoyerReglages() }
    const surHorsLigne = () => definirEnLigne(false)
    window.addEventListener('online', surEnLigne); window.addEventListener('offline', surHorsLigne)
    return () => { window.removeEventListener('online', surEnLigne); window.removeEventListener('offline', surHorsLigne) }
  }, [])

  // T11 — synchronisation des ventes hors ligne + compteur en attente
  useEffect(() => {
    if (!connecte || utilisateur?.role === 'admin') return
    const recompter = () => nombreVentesEnAttente().then(definirNbVentesEnAttente).catch(() => {})
    const debrancher = brancherSynchronisation(() => { recompter(); rafraichirChiffres() })
    recompter()
    return debrancher
  }, [connecte, utilisateur?.role])

  /* Boutiques : la liste ne change pas d'un écran à l'autre, et changer de
     boutique recharge la page. Une seule lecture par session suffit — avant,
     elle repartait à CHAQUE navigation. */
  useEffect(() => {
    if (!connecte || utilisateur?.role === 'admin') return
    Boutiques.lister().then(definirBoutiques).catch(() => {})
  }, [connecte, utilisateur?.role])

  /* Alertes de stock (cloche) + fichier clients de la recherche globale.
     Chaque lecture n'est tentée qu'avec le droit que l'API exige (`rapports`
     pour les alertes, `clients` pour le fichier) : sans cela, un employé
     privé de ces droits recevait deux refus 403 à chaque changement d'écran. */
  const peutLireAlertes = peutAcceder(utilisateur, 'rapports')
  const peutLireClients = peutAcceder(utilisateur, 'clients')
  useEffect(() => {
    if (!connecte || utilisateur?.role === 'admin') return
    if (peutLireAlertes) {
      Statistiques.stockFaible(5).then((a) => { definirAlertes(a); if (!dejaNotifie.current) { dejaNotifie.current = true; notifierStock(a) } }).catch(() => {})
    }
    if (peutLireClients) ApiClients.lister().then(definirClientsRecherche).catch(() => {})
  }, [connecte, ecran, utilisateur?.role, peutLireAlertes, peutLireClients])

  const recherche = rechercheGlobale.trim().toLowerCase()
  const produitsTrouves = recherche.length >= 2 ? produitsRecherche.filter((p) => p.nom.toLowerCase().includes(recherche)).slice(0, 5) : []
  const clientsTrouves = recherche.length >= 2 ? clientsRecherche.filter((c) => c.nom.toLowerCase().includes(recherche)).slice(0, 4) : []

  const changerDeBoutique = async (b: Boutique) => {
    await Boutiques.activer(b.id)
    const u = lireUtilisateur(); if (u) enregistrerUtilisateur({ ...u, boutique_active_id: b.id })
    window.location.reload()
  }

  const { traction, rafraichissement, gestionnaires } = useTirerPourRafraichir(async () => {
    definirCleRafraichissement((k) => k + 1); rafraichirChiffres()
    await new Promise((r) => setTimeout(r, 450))
  })

  if (!connecte) return <Connexion surConnexion={(u) => { definirUtilisateur(u); definirConnecte(true) }} />

  // Les réglages d'écran sont rechargés depuis le compte à la connexion : on
  // purge le local pour qu'un autre commerçant sur le même téléphone ne récupère
  // pas l'application configurée du précédent.
  const seDeconnecter = () => { deconnecter(); effacerReglagesLocaux(); definirConnecte(false); definirUtilisateur(null); definirEcran('accueil') }
  if (utilisateur?.role === 'admin') return <Suspense fallback={<ChargementSection />}><ApplicationAdmin utilisateur={utilisateur} surDeconnexion={seDeconnecter} /></Suspense>

  const aller = (e: Ecran) => definirEcran(peutAcceder(utilisateur, e) ? e : ecran)
  const boutiqueActive = boutiques.find((b) => b.id === utilisateur?.boutique_active_id)

  void versionSections // relit les sections affichées à chaque changement
  const section = !peutAcceder(utilisateur, ecran) ? <AccesRefuse /> : (<Suspense fallback={<ChargementSection />}>
    {ecran === 'toutes-boutiques' && <TableauBordBoutiques surNavigation={definirEcran} />}
    {ecran === 'accueil' && <Accueil utilisateur={utilisateur} peutVoir={(e) => estVisible(utilisateur, e)} alertesAutorisees={peutLireAlertes} surNavigation={definirEcran} surDeconnexion={seDeconnecter} surMonPlan={() => aller('plan')} bureau={bureau} chiffres={chiffres} />}
    {ecran === 'vente' && <Vente />}
    {ecran === 'stock' && <Stock />}
    {ecran === 'categories' && <SectionCategories />}
    {ecran === 'rapports' && <Rapports />}
    {ecran === 'ia' && <IaReappro surNavigation={definirEcran} />}
    {ecran === 'credits' && <Credits />}
    {ecran === 'inventaire' && <Inventaire />}
    {ecran === 'clients' && <Clients />}
    {ecran === 'fournisseurs' && <Fournisseurs />}
    {ecran === 'caisse' && <Caisse />}
    {ecran === 'retours' && <Retours />}
    {ecran === 'commandes' && <Commandes />}
    {ecran === 'livraisons' && <Livraisons />}
    {ecran === 'boutiques' && <SectionBoutiques />}
    {ecran === 'equipe' && <Equipe />}
    {ecran === 'profil' && <Profil utilisateur={utilisateur} surDeconnexion={seDeconnecter} surMonPlan={() => aller('plan')} />}
    {ecran === 'plan' && <MonPlan utilisateur={utilisateur} />}
  </Suspense>)

  // Design 3.6 — commandes de la palette (Ctrl+K) : navigation + actions rapides.
  const commandes: Commande[] = [
    ...NAVIGATION.filter((n) => estVisible(utilisateur, n.ecran)).map((n) => ({
      id: 'aller-' + n.ecran, icone: n.icone, libelle: n.libelle, aide: 'Aller à', executer: () => aller(n.ecran),
    })),
    { id: 'action-vendre', icone: '💳', libelle: 'Nouvelle vente', aide: 'Action', executer: () => aller('vente') },
    { id: 'action-theme', icone: '🌓', libelle: 'Thème : auto / clair / sombre', aide: 'Action', executer: () => definirPreferenceTheme(changerTheme()) },
    { id: 'action-deconnexion', icone: '🔓', libelle: 'Se déconnecter', aide: 'Action', executer: seDeconnecter },
  ]

  const fenetres = (<>
    <FeuillePlanRequis estEmploye={!!utilisateur?.est_employe} surVoirPlans={() => aller('plan')} />
    {premiersPasOuverts && <PremiersPas surFin={() => definirPremiersPasOuverts(false)} />}
    <VerrouPin />
    <PaletteCommandes commandes={commandes} />
  </>)

  // ═══════════ BUREAU : colonne latérale + barre du haut ═══════════
  if (bureau) {
    return (
      <div className="bureau-coquille">
        <aside className="bureau-barre-laterale">
          {/* Le logo ramène à l'accueil (convention web attendue). */}
          <button className="bureau-logo" onClick={() => aller('accueil')} title="Retour à l'accueil" aria-label="Retour à l'accueil">
            <Logo taille={38} className="bureau-logo-pastille" /> Sama<span style={{ opacity: .85 }}>Commerce</span>
          </button>
          <nav className="bureau-nav">
            {NAVIGATION.filter((n) => estVisible(utilisateur, n.ecran)).map((n) => (
              <button key={n.ecran} className={`bureau-nav-element ${ecran === n.ecran ? 'actif' : ''}`} onClick={() => aller(n.ecran)}>
                <span className="bureau-nav-icone">{n.icone}</span> {n.libelle}
              </button>
            ))}
          </nav>
          {!utilisateur?.est_employe && <CartePlan contexte="bureau" surOuvrir={() => aller('plan')} />}
        </aside>
        <div className="bureau-principal">
          {!enLigne && <div className="bandeau-hors-ligne">📴 Hors ligne — les données affichées peuvent être anciennes</div>}
          {nbVentesEnAttente > 0 && <button className="bandeau-synchro" onClick={() => synchroniserVentesEnAttente().then(() => nombreVentesEnAttente().then(definirNbVentesEnAttente))}>🔄 {nbVentesEnAttente} vente{nbVentesEnAttente > 1 ? 's' : ''} en attente de synchronisation{enLigne ? ' — cliquer pour synchroniser' : ''}</button>}
          <div className="bureau-barre-haut">
            <div style={{ position: 'relative' }}>
              <input className="bureau-recherche" style={{ border: 'none', outline: 'none' }} placeholder="🔍 Rechercher un produit, un client…" value={rechercheGlobale} onChange={(e) => definirRechercheGlobale(e.target.value)} />
              {recherche.length >= 2 && (
                <div className="notif-panneau" style={{ left: 0, right: 'auto', top: 50, width: 320 }}>
                  {produitsTrouves.length === 0 && clientsTrouves.length === 0 && <div className="notif-element" style={{ color: 'var(--attenue)' }}>Aucun résultat</div>}
                  {produitsTrouves.map((p) => (
                    <button key={'p' + p.id} className="selecteur-boutique-choix" onClick={() => { definirEcran('stock'); definirRechercheGlobale('') }}>
                      📦 <div style={{ flex: 1 }}>{p.nom}</div><span style={{ color: 'var(--vert)', fontWeight: 700 }}>{fcfa(p.prix_vente)}</span>
                    </button>
                  ))}
                  {clientsTrouves.map((c) => (
                    <button key={'c' + c.id} className="selecteur-boutique-choix" onClick={() => { definirEcran('clients'); definirRechercheGlobale('') }}>
                      👤 <div style={{ flex: 1 }}>{c.nom}</div><span style={{ color: 'var(--attenue)', fontSize: 12 }}>client</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <button className="bureau-boutique" style={{ marginLeft: 0, cursor: 'pointer' }} onClick={() => definirChoixBoutiqueOuvert((o) => !o)}>🏪 {utilisateur?.nom_commerce || 'Ma Boutique'} ▾</button>
              {choixBoutiqueOuvert && (
                <div className="selecteur-boutique-menu">
                  {/* Vue consolidée : elle ne change pas de boutique, elle les réunit. */}
                  {!utilisateur?.est_employe && boutiques.length > 1 && (
                    <button className="selecteur-boutique-choix" onClick={() => { definirEcran('toutes-boutiques'); definirChoixBoutiqueOuvert(false) }}>
                      <span>📊</span> Toutes mes boutiques
                    </button>
                  )}
                  {boutiques.map((b) => (
                    <button key={b.id} className={`selecteur-boutique-choix ${b.id === utilisateur?.boutique_active_id ? 'actif' : ''}`} onClick={() => changerDeBoutique(b)}>
                      <span>{b.emoji}</span> {b.nom} {b.id === utilisateur?.boutique_active_id && '✓'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="bureau-bouton-icone" title={`Thème : ${LIBELLES_THEME[preferenceTheme].libelle}`} aria-label={`Thème : ${LIBELLES_THEME[preferenceTheme].libelle} — changer`}
              onClick={(e) => definirPreferenceTheme(changerTheme({ x: e.clientX, y: e.clientY }))}>{LIBELLES_THEME[preferenceTheme].icone}</button>
            <div style={{ position: 'relative' }}>
              <button className="bureau-bouton-icone" aria-label="Notifications" onClick={() => definirNotificationsOuvertes((o) => !o)}>🔔{alertes.length > 0 && <span style={{ position: 'absolute', top: 8, right: 9, width: 8, height: 8, background: 'var(--accent)', borderRadius: '50%' }} />}</button>
              {notificationsOuvertes && (
                <div className="notif-panneau">
                  <div className="notif-entete">Alertes de stock ({alertes.length})</div>
                  {alertes.length === 0 ? <div className="notif-element" style={{ color: 'var(--attenue)' }}>Aucune alerte 🎉</div>
                    : alertes.map((a, i) => <div key={i} className="notif-element"><span>⚠️</span><div style={{ flex: 1 }}>{a.produit}</div><span style={{ color: 'var(--danger)', fontWeight: 700 }}>{a.stock}</span></div>)}
                </div>
              )}
            </div>
            <div className="bureau-profil">
              <div className="bureau-avatar">{(utilisateur?.nom_commerce || 'SC').slice(0, 2).toUpperCase()}</div>
              <div style={{ fontSize: 12.5 }}>
                <div className="police-titre" style={{ fontWeight: 700 }}>{utilisateur?.identifiant}</div>
                <div style={{ color: 'var(--attenue-2)', fontSize: 11 }}>{utilisateur?.est_employe ? 'Employé' : 'Propriétaire'}</div>
              </div>
              <button className="bouton-discret" style={{ marginLeft: 8 }} onClick={seDeconnecter}>Quitter</button>
            </div>
          </div>
          <div className="bureau-contenu"><div className="bureau-contenu-interieur">{section}</div></div>
        </div>
        <AssistantVocal bureau ecran={ecran} surNavigation={aller} />
        {fenetres}
      </div>
    )
  }

  // ═══════════ MOBILE : en-tête + navigation du bas ═══════════
  return (
    <div className="conteneur-appli">
      {!enLigne && <div className="bandeau-hors-ligne">📴 Hors ligne</div>}
      {nbVentesEnAttente > 0 && <button className="bandeau-synchro" onClick={() => synchroniserVentesEnAttente().then(() => nombreVentesEnAttente().then(definirNbVentesEnAttente))}>🔄 {nbVentesEnAttente} vente{nbVentesEnAttente > 1 ? 's' : ''} en attente de sync</button>}
      {notificationsOuvertes && (
        <div className="notif-panneau" style={{ top: 60 }}>
          <div className="notif-entete">Alertes de stock ({alertes.length})</div>
          {alertes.length === 0 ? <div className="notif-element" style={{ color: 'var(--attenue)' }}>Aucune alerte 🎉</div>
            : alertes.map((a, i) => <div key={i} className="notif-element"><span>⚠️</span><div style={{ flex: 1 }}>{a.produit}</div><span style={{ color: 'var(--danger)', fontWeight: 700 }}>{a.stock}</span></div>)}
        </div>
      )}
      <div className="entete-haut">
        <div className="entete-interieur">
          {ecran !== 'accueil'
            ? <button className="bouton-retour" aria-label="Retour à l'accueil" onClick={() => definirEcran('accueil')}>←</button>
            : <button className="entete-icone" style={{ border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
                aria-label="Mon profil" onClick={() => definirEcran('profil')}>
                <Avatar photo={utilisateur?.photo} nom={utilisateur?.nom_commerce} taille={40} rayon={12} fond="rgba(255,255,255,.18)" />
              </button>}
          <div className="entete-centre" style={{ textAlign: ecran === 'accueil' ? 'left' : 'center' }}>
            {ecran === 'accueil'
              ? (
                <>
                  <div className="entete-sous-titre">Bonjour 👋</div>
                  {/* Le sélecteur de boutique n'existait que sur ordinateur : sur
                      téléphone, on ne pouvait pas changer de point de vente.
                      Le nom devient donc un bouton dès qu'il y a plusieurs boutiques. */}
                  {boutiques.length > 1 ? (
                    <button className="entete-boutique" onClick={() => definirChoixBoutiqueOuvert(true)} aria-label="Changer de boutique">
                      <span className="entete-titre">{boutiqueActive?.nom || utilisateur?.nom_commerce || 'Sama Commerce'}</span>
                      <span aria-hidden="true">▾</span>
                    </button>
                  ) : (
                    <div className="entete-titre">{utilisateur?.nom_commerce || 'Sama Commerce'}</div>
                  )}
                </>
              )
              : <div className="entete-titre">{TITRES[ecran]}</div>}
          </div>
          <button className="entete-icone" aria-label="Notifications" style={{ border: 'none', cursor: 'pointer', position: 'relative' }} onClick={() => definirNotificationsOuvertes((o) => !o)}>🔔{alertes.length > 0 && <span style={{ position: 'absolute', top: 7, right: 8, width: 8, height: 8, background: '#fbbf24', borderRadius: '50%' }} />}</button>
        </div>
        {ecran === 'accueil' && (
          <div style={{ marginTop: 16, position: 'relative', zIndex: 1 }}>
            <div className="entete-sous-titre">🔥 Encaissé aujourd'hui</div>
            <Compteur valeur={chiffres.ca} className="police-titre entete-ca" />
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
      {ecran === 'accueil' && (
        <div className="jour-flottant">
          <div className="compteur-jour vert"><Compteur valeur={chiffres.ca} className="valeur" /><div className="libelle">Encaissé</div></div>
          <div className="compteur-jour bleu"><Compteur valeur={chiffres.articles} format={(n) => String(n)} className="valeur" /><div className="libelle">Vendus</div></div>
          {alertes.length > 0
            ? <button className="compteur-jour rouge" onClick={() => aller('stock')} style={{ border: 'none', cursor: 'pointer', font: 'inherit' }}>
                <div className="valeur">{alertes.length}</div><div className="libelle">À racheter</div>
              </button>
            : <div className="compteur-jour orange"><Compteur valeur={chiffres.stock} format={(n) => String(n)} className="valeur" /><div className="libelle">En stock</div></div>}
        </div>
      )}

      <div className="contenu-defilant" {...gestionnaires}>
        {(traction > 0 || rafraichissement) && (
          <div style={{ height: traction, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--attenue)', fontSize: 13, overflow: 'hidden', transition: rafraichissement ? 'none' : 'height .15s' }}>
            {rafraichissement ? '⟳ Actualisation…' : traction > 50 ? '↑ Relâcher pour actualiser' : '↓ Tirer pour actualiser'}
          </div>
        )}
        <div className="page-section" key={`${ecran}-${cleRafraichissement}`}>{section}</div>
      </div>

      <div className="navigation-bas">
        <BoutonNavigation actif={ecran === 'accueil'} icone="🏠" libelle={traduire('nav.accueil')} surClic={() => definirEcran('accueil')} />
        {/* Raccourci de gauche : la première section utile encore affichée. Si
            le commerçant a tout masqué sauf Vendre, on ne laisse pas un bouton
            mort dans sa barre. */}
        {(() => {
          const raccourci = (['rapports', 'stock', 'inventaire', 'clients', 'credits'] as Ecran[]).find((e) => estVisible(utilisateur, e))
          const infos = NAVIGATION.find((n) => n.ecran === raccourci)
          return raccourci && infos
            ? <BoutonNavigation actif={ecran === raccourci} icone={infos.icone} libelle={infos.libelle} surClic={() => definirEcran(raccourci)} />
            : <span className="bouton-nav" aria-hidden="true" />
        })()}
        {/* Bouton central : Vendre, ou la principale section restante. Le rond
            porte son libellé — un pictogramme seul dans un cercle ne dit pas
            ce qu'il déclenche. */}
        {(() => {
          const principal = (['vente', 'stock', 'rapports'] as Ecran[]).find((e) => estVisible(utilisateur, e))
          const infos = NAVIGATION.find((n) => n.ecran === principal)
          const libelle = principal ? (infos?.libelle || traduire('nav.vente')) : traduire('nav.accueil')
          return (
            <span className="bouton-central-conteneur">
              <button className="bouton-central" aria-label={libelle} title={libelle}
                onClick={() => (principal ? aller(principal) : definirEcran('accueil'))}>
                {principal ? (principal === 'vente' ? '🛒' : infos?.icone) : '🏠'}
              </button>
              <span className="bouton-central-libelle" aria-hidden="true">{libelle}</span>
            </span>
          )
        })()}
        <BoutonNavigation actif={ecran === 'profil'} icone="👤" libelle={traduire('nav.profil')} surClic={() => definirEcran('profil')} />
        <BoutonNavigation actif={voletPlusOuvert} icone="＋" libelle="Plus" surClic={() => definirVoletPlusOuvert(true)} />
      </div>

      {choixBoutiqueOuvert && (
        <div className="fenetre-calque" style={{ alignItems: 'flex-end' }} onClick={() => definirChoixBoutiqueOuvert(false)}>
          <div className="fenetre-boite" style={{ maxWidth: 480, borderRadius: '22px 22px 0 0' }} onClick={(e) => e.stopPropagation()}>
            <div className="fenetre-titre">🏬 Ma boutique</div>
            {!utilisateur?.est_employe && (
              <button className="volet-element" onClick={() => { definirEcran('toutes-boutiques'); definirChoixBoutiqueOuvert(false) }}>
                <span className="volet-icone" style={{ background: '#EDE9FE' }}>📊</span>
                <div><h3>Toutes mes boutiques</h3><p>Vue d'ensemble et comparaison</p></div>
                <span className="volet-chevron">›</span>
              </button>
            )}
            {boutiques.map((b) => (
              <button key={b.id} className="volet-element" onClick={() => changerDeBoutique(b)}>
                <Avatar photo={b.photo} icone={b.photo ? undefined : (b.emoji || '🏪')} nom={b.nom} taille={46} rayon={13} />
                <div>
                  <h3>{b.nom}</h3>
                  <p>{b.nb_produits || 0} produit(s) · {b.nb_ventes || 0} vente(s)</p>
                </div>
                <span className="volet-chevron">{b.id === utilisateur?.boutique_active_id ? '✅' : '›'}</span>
              </button>
            ))}
            <button className="bouton-annuler" style={{ width: '100%', marginTop: 8 }} onClick={() => definirChoixBoutiqueOuvert(false)}>Fermer</button>
          </div>
        </div>
      )}

      {voletPlusOuvert && <VoletPlus peutVoir={(e) => estVisible(utilisateur, e)} surFermeture={() => definirVoletPlusOuvert(false)} surNavigation={(e) => { definirEcran(e); definirVoletPlusOuvert(false) }} />}
      <AssistantVocal bureau={false} ecran={ecran} surNavigation={aller} />
      {fenetres}
    </div>
  )
}

function ChargementSection() {
  return (
    <div style={{ padding: 24 }}>
      <div className="squelette" style={{ height: 28, width: '45%', marginBottom: 16 }} />
      <div className="squelette-carte"><div className="squelette" style={{ height: 90 }} /></div>
      <div className="squelette-carte"><div className="squelette" style={{ height: 90 }} /></div>
    </div>
  )
}

function AccesRefuse() {
  return (
    <div className="etat-vide" style={{ paddingTop: 60 }}>
      <div className="vide-icone">🔒</div>
      <div className="vide-texte">Accès refusé</div>
      <div className="vide-sous-titre">Vous n'avez pas la permission pour cette section. Contactez le propriétaire.</div>
    </div>
  )
}

function BoutonNavigation({ actif, icone, libelle, surClic }: { actif: boolean; icone: string; libelle: string; surClic: () => void }) {
  return (
    <button className={`bouton-nav ${actif ? 'actif' : ''}`} onClick={surClic}>
      <span className="nav-icone">{icone}</span>
      <span className="nav-libelle">{libelle}</span>
    </button>
  )
}
