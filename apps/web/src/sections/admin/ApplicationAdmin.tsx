/* Panneau d'administration (refonte d'octobre 2026).
 *
 * Remplace l'ancien panneau en Tailwind brut (« BOUTIQUE GESTION — Admin »).
 * Il sert d'abord à une chose : vérifier les paiements d'abonnement déclarés
 * par les commerçants, puis suivre les comptes, les plans et l'argent.
 * Colonne d'encre sur ordinateur, barre du bas sur téléphone ; la vue en
 * cours vit dans l'adresse (#/paiements?id=12). */

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ellipsis, Layers, LayoutDashboard, LogOut, ReceiptText, Settings, ShieldAlert, ShieldCheck, Store, Wallet, type LucideIcon } from 'lucide-react'
import { Admin, type Utilisateur } from '../../outils/api'
import { aller, CLES_ADMIN, initiale, useAdresse, type Vue } from './outilsAdmin'
import VueTableauDeBord from './VueTableauDeBord'
import VuePaiements from './VuePaiements'
import VueCommercants from './VueCommercants'
import VuePlans from './VuePlans'
import VueFinances from './VueFinances'
import VueParametres from './VueParametres'
import './admin.css'

const NAVIGATION: { vue: Vue; libelle: string; court: string; Icone: LucideIcon }[] = [
  { vue: 'accueil', libelle: 'Tableau de bord', court: 'Accueil', Icone: LayoutDashboard },
  { vue: 'paiements', libelle: 'Paiements à vérifier', court: 'Paiements', Icone: ReceiptText },
  { vue: 'commercants', libelle: 'Commerçants', court: 'Commerçants', Icone: Store },
  { vue: 'plans', libelle: 'Plans et tarifs', court: 'Plans', Icone: Layers },
  { vue: 'finances', libelle: 'Finances', court: 'Finances', Icone: Wallet },
  { vue: 'parametres', libelle: 'Paramètres', court: 'Paramètres', Icone: Settings },
]
/** Téléphone : quatre vues à portée de pouce, le reste sous « Plus ». */
const BARRE_BAS: Vue[] = ['accueil', 'paiements', 'commercants', 'finances']

export default function ApplicationAdmin({ utilisateur, surDeconnexion }: { utilisateur: Utilisateur | null; surDeconnexion: () => void }) {
  const { vue, params } = useAdresse()
  const client = useQueryClient()
  const [plusOuvert, definirPlusOuvert] = useState(false)
  const [doubleFacteur, definirDoubleFacteur] = useState(!!utilisateur?.double_facteur_actif)
  const courante = NAVIGATION.find((n) => n.vue === vue) ?? NAVIGATION[0]

  // Le compteur de la navigation : relu toutes les 2 minutes tant que le
  // panneau est ouvert, et au retour dans l'onglet.
  const file = useQuery({
    queryKey: CLES_ADMIN.paiements('en_attente'),
    queryFn: () => Admin.paiements('en_attente'),
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  })
  const nbAttente = file.data?.compteurs.en_attente ?? 0

  useEffect(() => {
    const avant = document.title
    return () => { document.title = avant }
  }, [])
  useEffect(() => { document.title = `${courante.libelle} · Admin SamaCommerce` }, [courante])

  // Changer de vue ramène en haut et place le lecteur d'écran sur le contenu.
  const premierRendu = useRef(true)
  useEffect(() => {
    if (premierRendu.current) { premierRendu.current = false; return }
    window.scrollTo({ top: 0 })
    document.getElementById('contenu-admin')?.focus({ preventScroll: true })
  }, [vue])

  const ouvrir = (cible: Vue) => { definirPlusOuvert(false); aller(cible) }
  const seDeconnecter = () => {
    history.replaceState(history.state, '', window.location.pathname + window.location.search)
    client.removeQueries({ queryKey: CLES_ADMIN.tout })
    surDeconnexion()
  }

  const compteur = (cible: Vue) => cible === 'paiements' && nbAttente > 0
    ? <span className="adm-compteur" aria-label={`${nbAttente} à vérifier`}>{nbAttente}</span>
    : null

  return (
    <div className="adm">
      <button type="button" className="adm-evitement" onClick={() => document.getElementById('contenu-admin')?.focus()}>Aller au contenu</button>

      <aside className="adm-colonne" aria-label="Administration">
        <div className="adm-marque">
          <span className="adm-marque-pastille" aria-hidden="true">S</span>
          <span className="adm-marque-nom">SamaCommerce<span>Administration</span></span>
        </div>
        <nav className="adm-nav" aria-label="Rubriques">
          {NAVIGATION.map(({ vue: cible, libelle, Icone }) => (
            <button key={cible} type="button" className="adm-nav-lien" aria-current={vue === cible ? 'page' : undefined} onClick={() => ouvrir(cible)}>
              <Icone size={20} aria-hidden="true" />
              <span>{libelle}</span>
              {compteur(cible)}
            </button>
          ))}
        </nav>
        <div className="adm-compte">
          <div className="adm-compte-identite">
            <span className="adm-compte-avatar" aria-hidden="true">{initiale(utilisateur?.identifiant)}</span>
            <span className="adm-compte-texte">
              <strong>Administrateur</strong>
              <span>{utilisateur?.identifiant}</span>
            </span>
          </div>
          <span className={`adm-compte-double-facteur adm-compte-double-facteur--${doubleFacteur ? 'actif' : 'inactif'}`}>
            {doubleFacteur ? <ShieldCheck size={15} aria-hidden="true" /> : <ShieldAlert size={15} aria-hidden="true" />}
            {doubleFacteur ? 'Vérification en 2 étapes' : 'Sans vérification en 2 étapes'}
          </span>
          <button type="button" className="adm-sortie" onClick={seDeconnecter}>
            <LogOut size={16} aria-hidden="true" />Déconnexion
          </button>
        </div>
      </aside>

      <div className="adm-cadre">
        <header className="adm-entete-mobile">
          <span className="adm-marque-pastille" aria-hidden="true">S</span>
          <span className="adm-marque-nom">SamaCommerce<span>Administration</span></span>
        </header>

        <main id="contenu-admin" className="adm-principal" tabIndex={-1}>
          {vue === 'accueil' && <VueTableauDeBord />}
          {vue === 'paiements' && <VuePaiements params={params} />}
          {vue === 'commercants' && <VueCommercants params={params} />}
          {vue === 'plans' && <VuePlans />}
          {vue === 'finances' && <VueFinances params={params} />}
          {vue === 'parametres' && <VueParametres doubleFacteur={doubleFacteur} surDoubleFacteur={definirDoubleFacteur} />}
        </main>
      </div>

      <nav className="adm-barre-bas" aria-label="Rubriques">
        {NAVIGATION.filter((n) => BARRE_BAS.includes(n.vue)).map(({ vue: cible, court, Icone }) => (
          <button key={cible} type="button" aria-current={vue === cible ? 'page' : undefined} onClick={() => ouvrir(cible)}>
            <Icone size={22} aria-hidden="true" />
            {court}
            {compteur(cible)}
          </button>
        ))}
        <button type="button" aria-current={!BARRE_BAS.includes(vue) ? 'page' : undefined} aria-expanded={plusOuvert} onClick={() => definirPlusOuvert(true)}>
          <Ellipsis size={22} aria-hidden="true" />
          Plus
        </button>
      </nav>

      {plusOuvert && <FeuillePlus vue={vue} surOuvrir={ouvrir} surDeconnexion={seDeconnecter} surFermer={() => definirPlusOuvert(false)} />}
    </div>
  )
}

/** « Plus » sur téléphone : les rubriques qui n'ont pas leur place en bas. */
function FeuillePlus({ vue, surOuvrir, surDeconnexion, surFermer }: { vue: Vue; surOuvrir: (v: Vue) => void; surDeconnexion: () => void; surFermer: () => void }) {
  const premier = useRef<HTMLButtonElement>(null)
  const fermer = useRef(surFermer)
  fermer.current = surFermer
  useEffect(() => {
    premier.current?.focus()
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') fermer.current() }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [])

  return (
    <div className="adm-feuille-calque" onClick={surFermer}>
      <div className="adm-feuille" role="dialog" aria-modal="true" aria-label="Autres rubriques" onClick={(e) => e.stopPropagation()}>
        {NAVIGATION.filter((n) => !BARRE_BAS.includes(n.vue)).map(({ vue: cible, libelle, Icone }, i) => (
          <button key={cible} ref={i === 0 ? premier : undefined} type="button" className="adm-feuille-lien" aria-current={vue === cible ? 'page' : undefined} onClick={() => surOuvrir(cible)}>
            <Icone size={22} aria-hidden="true" />{libelle}
          </button>
        ))}
        <button type="button" className="adm-feuille-lien adm-feuille-lien--danger" onClick={surDeconnexion}>
          <LogOut size={22} aria-hidden="true" />Déconnexion
        </button>
      </div>
    </div>
  )
}
