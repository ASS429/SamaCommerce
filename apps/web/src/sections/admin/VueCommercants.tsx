/* Commerçants : qui est en essai, qui paie, qui arrive à échéance ; la fiche
 * d'un compte et les gestes de l'administrateur (relancer, offrir des jours,
 * enregistrer un plan payé en espèces, bloquer, supprimer). */

import { useEffect, useState, type FormEvent } from 'react'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Ban, CalendarPlus, ChevronLeft, ChevronRight, Copy, Gift, Mail, MessageCircle, Repeat, RotateCcw, Search, Store, Trash2, UserPlus } from 'lucide-react'
import { Admin, fcfa, type CleLimite, type CodePlan, type FicheCommercant, type FiltreCommercants, type LigneCommercant, type MoyenAbonnement, type PaiementAbonnement, type PlanPublic } from '../../outils/api'
import { LIBELLES_LIMITES, dateLongue, texteUtilisation } from '../../outils/abonnement'
import { bulle, demanderConfirmation } from '../../outils/bulles'
import { LISTE_VIDE } from '../../outils/requetes'
import { EnTeteVue, ErreurVue, LogoMoyen, Pastille, Squelette, Vide } from './communs'
import {
  aller, CLES_ADMIN, echeanceCourte, initiale, jourCourt, messageErreur, nomCommercant, pastilleStatut, pluriel, useEcranLarge,
  useRafraichirAdmin, vu,
} from './outilsAdmin'

const FILTRES: { id: FiltreCommercants; libelle: string }[] = [
  { id: 'tous', libelle: 'Tous' },
  { id: 'essai', libelle: 'En essai' },
  { id: 'payants', libelle: 'Payants' },
  { id: 'bientot', libelle: 'Expirent bientôt' },
  { id: 'expires', libelle: 'Expirés' },
  { id: 'bloques', libelle: 'Bloqués' },
  { id: 'attente', libelle: 'Paiement à vérifier' },
]
const PAR_PAGE = 25
const CLES_LIMITES: CleLimite[] = ['produits', 'boutiques', 'employes', 'ia']
const STATUTS_PAIEMENT: Record<PaiementAbonnement['statut'], string> = { en_attente: 'à vérifier', valide: 'validé', refuse: 'refusé' }

export default function VueCommercants({ params }: { params: URLSearchParams }) {
  const brut = params.get('filtre')
  const filtre: FiltreCommercants = FILTRES.find((f) => f.id === brut)?.id ?? 'tous'
  const recherche = params.get('q') ?? ''
  const idChoisi = Number(params.get('id')) || null
  const large = useEcranLarge()
  const [saisie, definirSaisie] = useState(recherche)
  const [page, definirPage] = useState(1)
  const [ajoutOuvert, definirAjoutOuvert] = useState(false)

  const liste = useQuery({
    queryKey: CLES_ADMIN.commercants(filtre, recherche),
    queryFn: () => Admin.commercants(filtre, recherche),
    placeholderData: keepPreviousData,
  })
  const plans = useQuery({ queryKey: CLES_ADMIN.plans, queryFn: Admin.plans })

  const filtreCourant = filtre === 'tous' ? null : filtre
  // La recherche part 300 ms après la dernière touche, sans encombrer l'historique.
  useEffect(() => {
    if (saisie.trim() === recherche) return
    const minuterie = setTimeout(() => { definirPage(1); aller('commercants', { filtre: filtreCourant, q: saisie.trim(), id: idChoisi }, true) }, 300)
    return () => clearTimeout(minuterie)
  }, [saisie, recherche, filtreCourant, idChoisi])

  const commercants = liste.data?.commercants ?? LISTE_VIDE
  const compteurs = liste.data?.compteurs
  const nbPages = Math.max(1, Math.ceil(commercants.length / PAR_PAGE))
  const pageCourante = Math.min(page, nbPages)
  const visibles = commercants.slice((pageCourante - 1) * PAR_PAGE, pageCourante * PAR_PAGE)

  const changerFiltre = (cible: FiltreCommercants) => { definirPage(1); aller('commercants', { filtre: cible === 'tous' ? null : cible, q: recherche }, true) }
  const ouvrir = (id: number) => aller('commercants', { filtre: filtreCourant, q: recherche, id })
  const fermer = () => aller('commercants', { filtre: filtreCourant, q: recherche }, true)

  return (
    <div className="adm-contenu">
      <EnTeteVue
        titre="Commerçants"
        soustitre={compteurs ? `${pluriel(compteurs.tous, 'compte', 'comptes')}, dont ${pluriel(compteurs.payants, 'payant', 'payants')} et ${compteurs.essai} en essai.` : undefined}
        actions={
          <button type="button" className="adm-bouton" aria-expanded={ajoutOuvert} onClick={() => definirAjoutOuvert((o) => !o)}>
            <UserPlus size={18} aria-hidden="true" />Ajouter un commerçant
          </button>
        }
      />

      {ajoutOuvert && <AjoutCommercant surFermer={() => definirAjoutOuvert(false)} />}

      <div className="adm-outils-liste">
        <div className="adm-filtres" role="group" aria-label="Filtrer les commerçants">
          {FILTRES.filter((f) => f.id !== 'attente' || (compteurs?.attente ?? 0) > 0 || filtre === 'attente').map((f) => (
            <button key={f.id} type="button" aria-pressed={filtre === f.id} onClick={() => changerFiltre(f.id)}>
              {f.libelle}{compteurs && <span>{compteurs[f.id]}</span>}
            </button>
          ))}
        </div>
        <label className="adm-recherche">
          <Search size={18} aria-hidden="true" />
          <input type="search" value={saisie} onChange={(e) => definirSaisie(e.target.value)} placeholder="Nom, téléphone, référence…"
            aria-label="Rechercher un commerçant par nom, téléphone ou référence de paiement" enterKeyHint="search" />
        </label>
      </div>

      {liste.isPending ? (
        <div className="adm-maitre" aria-busy="true">{[0, 1, 2, 3].map((i) => <Squelette key={i} hauteur={84} />)}</div>
      ) : liste.isError ? (
        <ErreurVue erreur={liste.error} surReessai={() => liste.refetch()} />
      ) : (
        <div className="adm-maitre-detail">
          <div className="adm-maitre">
            {commercants.length === 0 ? (
              <Vide icone={<Store size={28} aria-hidden="true" />}
                titre={recherche ? `Aucun commerçant ne correspond à « ${recherche} »` : 'Aucun commerçant ici'}
                texte={recherche ? 'Essayez un autre nom, un numéro ou une référence de paiement.' : 'Changez de filtre pour voir les autres comptes.'} />
            ) : (
              <ul className="adm-pile" aria-label="Commerçants">
                {visibles.map((c) => (
                  <li key={c.id}><LigneCommercantVue commercant={c} choisi={c.id === idChoisi} surOuvrir={() => ouvrir(c.id)} /></li>
                ))}
              </ul>
            )}
            {nbPages > 1 && (
              <nav className="adm-pagination" aria-label="Pages">
                <button type="button" className="adm-bouton adm-bouton--contour" disabled={pageCourante === 1} onClick={() => definirPage(pageCourante - 1)} aria-label="Page précédente">
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <span>Page {pageCourante} sur {nbPages}</span>
                <button type="button" className="adm-bouton adm-bouton--contour" disabled={pageCourante === nbPages} onClick={() => definirPage(pageCourante + 1)} aria-label="Page suivante">
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </nav>
            )}
          </div>
          <div className={`adm-detail${idChoisi ? ' adm-detail--ouvert' : ''}`}>
            {idChoisi ? (
              <VoletCommercant key={idChoisi} id={idChoisi} plans={plans.data?.plans ?? LISTE_VIDE} surFermer={fermer} />
            ) : large && commercants.length > 0 ? (
              <Vide icone={<Store size={28} aria-hidden="true" />} titre="Choisissez un commerçant" texte="Sa fiche, son utilisation et ses paiements s’affichent ici." />
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function LigneCommercantVue({ commercant: c, choisi, surOuvrir }: { commercant: LigneCommercant; choisi: boolean; surOuvrir: () => void }) {
  const nom = nomCommercant(c)
  const statut = pastilleStatut(c)
  return (
    <button type="button" className="adm-ligne" aria-pressed={choisi} onClick={surOuvrir}>
      <span className="adm-ligne-haut">
        <span className="adm-avatar" aria-hidden="true">{initiale(nom)}</span>
        <span className="adm-ligne-texte">
          <span className="adm-ligne-titre">{nom}</span>
          <span className="adm-ligne-sous">{c.nom_commerce ? c.identifiant : ''}{c.nom_commerce && c.telephone ? ' · ' : ''}{c.telephone ?? ''}</span>
        </span>
        <span className="adm-ligne-droite">
          <span className="adm-ligne-echeance">{echeanceCourte(c)}</span>
          <span className="adm-ligne-sous">{vu(c.derniere_activite)}</span>
        </span>
      </span>
      <span className="adm-ligne-bas">
        <span className="adm-ligne-plan">{c.plan_nom}</span>
        {c.statut !== 'gratuit' && <Pastille ton={statut.ton}>{statut.texte}</Pastille>}
      </span>
    </button>
  )
}

type Formulaire = 'offrir' | 'plan' | null

function VoletCommercant({ id, plans, surFermer }: { id: number; plans: PlanPublic[]; surFermer: () => void }) {
  const fiche = useQuery({ queryKey: CLES_ADMIN.commercant(id), queryFn: () => Admin.commercant(id) })
  const rafraichir = useRafraichirAdmin()
  const [formulaire, definirFormulaire] = useState<Formulaire>(null)

  const signalerErreur = (e: unknown) => bulle(messageErreur(e), 'erreur', { duree: 6000 })
  const relancer = useMutation({
    mutationFn: () => Admin.relancer(id),
    onSuccess: (r) => bulle(r.message, r.email_envoye || r.lien_whatsapp ? 'succes' : 'info', { duree: 5000 }),
    onError: signalerErreur,
  })
  const basculer = useMutation({
    mutationFn: (bloquer: boolean) => (bloquer ? Admin.bloquer(id) : Admin.activer(id)),
    onSuccess: (_, bloquer) => { bulle(bloquer ? 'Compte bloqué : ses appareils sont déconnectés.' : 'Compte réactivé.'); rafraichir() },
    onError: signalerErreur,
  })
  const supprimer = useMutation({
    mutationFn: () => Admin.supprimer(id),
    onSuccess: () => { bulle('Compte supprimé.'); rafraichir(); surFermer() },
    onError: signalerErreur,
  })

  const retour = (
    <button type="button" className="adm-bouton adm-bouton--contour adm-volet-retour" onClick={surFermer}>
      <ArrowLeft size={18} aria-hidden="true" />Retour à la liste
    </button>
  )
  if (fiche.isPending) return <div className="adm-volet" aria-busy="true">{retour}<Squelette hauteur={64} /><Squelette hauteur={120} /><Squelette hauteur={180} /></div>
  if (fiche.isError) return <div className="adm-volet">{retour}<ErreurVue erreur={fiche.error} surReessai={() => fiche.refetch()} compacte /></div>

  const f = fiche.data
  const nom = nomCommercant(f)
  const statut = pastilleStatut(f)
  const bloque = f.statut_compte === 'Bloqué'
  const attente = f.paiements.find((p) => p.statut === 'en_attente')
  const occupe = basculer.isPending || supprimer.isPending

  const confirmerBlocage = async () => {
    if (bloque) { basculer.mutate(false); return }
    if (await demanderConfirmation(`Bloquer ${nom} ? Il est déconnecté de tous ses appareils et ne peut plus se connecter tant que vous ne le réactivez pas.`, 'Bloquer')) basculer.mutate(true)
  }
  const confirmerSuppression = async () => {
    if (await demanderConfirmation(`Supprimer définitivement ${nom} ? Ses boutiques, ventes, produits et clients seront effacés. C’est irréversible.`, 'Supprimer')) supprimer.mutate()
  }

  return (
    <article className="adm-volet" aria-labelledby={`titre-commercant-${f.id}`}>
      {retour}
      <div className="adm-volet-entete">
        <div className="adm-volet-identite">
          <span className="adm-avatar adm-avatar--grand" aria-hidden="true">{initiale(nom)}</span>
          <div>
            <h2 id={`titre-commercant-${f.id}`} className="adm-volet-titre">{nom}</h2>
            <span className="adm-volet-sous">{f.identifiant}{f.telephone ? ` · ${f.telephone}` : ''}</span>
            <span className="adm-volet-sous">Inscrit le {dateLongue(f.cree_le)}. {vu(f.derniere_activite)}.</span>
          </div>
        </div>
      </div>

      <div className="adm-bloc-plan">
        <span className="adm-bloc-plan-libelle">Plan actuel</span>
        <span className="adm-bloc-plan-nom">{f.plan_nom}{f.statut !== 'gratuit' && <Pastille ton={statut.ton}>{statut.texte}</Pastille>}</span>
        <p>{f.description}.</p>
      </div>

      {attente && (
        <div className="adm-controle adm-controle--info">
          <span>
            Paiement de {fcfa(attente.montant_declare)} déclaré par {attente.moyen_libelle} pour {attente.formule}.{' '}
            <button type="button" className="adm-lien" onClick={() => aller('paiements', { id: attente.id })}>Vérifier ce paiement</button>
          </span>
        </div>
      )}

      <div className="adm-actions-grille">
        {f.relance.lien_whatsapp ? (
          <a className="adm-bouton" href={f.relance.lien_whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => relancer.mutate()}>
            <MessageCircle size={18} aria-hidden="true" />Relancer sur WhatsApp
          </a>
        ) : (
          <button type="button" className="adm-bouton" disabled={relancer.isPending} onClick={() => relancer.mutate()}>
            <Mail size={18} aria-hidden="true" />{relancer.isPending ? 'Envoi…' : 'Relancer par e-mail'}
          </button>
        )}
        <button type="button" className="adm-bouton adm-bouton--doux" aria-expanded={formulaire === 'offrir'} onClick={() => definirFormulaire(formulaire === 'offrir' ? null : 'offrir')}>
          <CalendarPlus size={18} aria-hidden="true" />Offrir des jours
        </button>
        <button type="button" className="adm-bouton adm-bouton--doux" aria-expanded={formulaire === 'plan'} onClick={() => definirFormulaire(formulaire === 'plan' ? null : 'plan')}>
          <Repeat size={18} aria-hidden="true" />Changer de plan
        </button>
        <button type="button" className={`adm-bouton ${bloque ? 'adm-bouton--contour' : 'adm-bouton--danger'}`} disabled={occupe} onClick={confirmerBlocage}>
          {bloque ? <RotateCcw size={18} aria-hidden="true" /> : <Ban size={18} aria-hidden="true" />}
          {bloque ? 'Réactiver le compte' : 'Bloquer le compte'}
        </button>
      </div>

      {formulaire === 'offrir' && <FormulaireOffrir fiche={f} plans={plans} surFini={() => definirFormulaire(null)} />}
      {formulaire === 'plan' && <FormulairePlan fiche={f} plans={plans} surFini={() => definirFormulaire(null)} />}

      <section className="adm-pile" aria-labelledby={`utilisation-${f.id}`}>
        <h3 id={`utilisation-${f.id}`} className="adm-h3">Utilisation</h3>
        <dl className="adm-dl">
          {CLES_LIMITES.map((cle) => (
            <div key={cle}><dt>{LIBELLES_LIMITES[cle]}</dt><dd>{texteUtilisation(cle, f.utilisation[cle], f.etat.limites[cle])}</dd></div>
          ))}
        </dl>
      </section>

      <section className="adm-pile" aria-labelledby={`historique-${f.id}`}>
        <h3 id={`historique-${f.id}`} className="adm-h3">Historique des paiements</h3>
        {f.paiements.length === 0 ? (
          <p className="adm-legende">Aucun paiement pour l’instant.</p>
        ) : (
          <ul className="adm-petite-liste adm-petite-liste--encadree">
            {f.paiements.map((p) => (
              <li key={p.id}>
                <LogoMoyen moyen={p.moyen} taille={32} />
                <span className="adm-ligne-texte">
                  <span className="adm-ligne-titre">{p.formule}</span>
                  <span className="adm-ligne-sous">{p.moyen_libelle}, {STATUTS_PAIEMENT[p.statut]} le {jourCourt(p.decide_le ?? p.cree_le)}</span>
                </span>
                <span className="adm-ligne-montant">{p.montant_declare > 0 ? fcfa(p.montant_declare) : 'Offert'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="adm-zone-sensible">
        <button type="button" className="adm-lien adm-lien--danger" disabled={occupe} onClick={confirmerSuppression}>
          <Trash2 size={16} aria-hidden="true" />Supprimer ce compte
        </button>
      </div>
    </article>
  )
}

/** Plan payé que l'on prolonge par défaut : le payé, sinon celui de l'essai. */
const planParDefaut = (f: FicheCommercant): CodePlan => f.etat.plan_paye ?? f.etat.plan_essai ?? 'essentiel'

function FormulaireOffrir({ fiche, plans, surFini }: { fiche: FicheCommercant; plans: PlanPublic[]; surFini: () => void }) {
  const rafraichir = useRafraichirAdmin()
  const payants = plans.filter((p) => p.code !== 'gratuit')
  const [jours, definirJours] = useState('7')
  const [plan, definirPlan] = useState<CodePlan>(planParDefaut(fiche))
  const [erreur, definirErreur] = useState('')
  const nombre = Number(jours)
  const valide = Number.isInteger(nombre) && nombre >= 1 && nombre <= 366
  const offrir = useMutation({
    mutationFn: () => Admin.offrir(fiche.id, nombre, plan),
    onSuccess: (r) => { bulle(r.message); rafraichir(); surFini() },
    onError: (e) => definirErreur(messageErreur(e)),
  })
  const envoyer = (e: FormEvent) => { e.preventDefault(); if (valide) offrir.mutate() }

  return (
    <form className="adm-formulaire" onSubmit={envoyer} aria-label="Offrir des jours">
      <div className="adm-formulaire-ligne">
        <div className="adm-champ">
          <label htmlFor="offrir-jours">Nombre de jours</label>
          <input id="offrir-jours" type="number" inputMode="numeric" min={1} max={366} value={jours} aria-invalid={!valide}
            onChange={(e) => { definirJours(e.target.value); definirErreur('') }} />
        </div>
        <div className="adm-champ">
          <label htmlFor="offrir-plan">Plan</label>
          <select id="offrir-plan" value={plan} onChange={(e) => definirPlan(e.target.value as CodePlan)}>
            {payants.map((p) => <option key={p.code} value={p.code}>{p.nom}</option>)}
          </select>
        </div>
      </div>
      <span className="adm-champ-aide">Les jours s’ajoutent à la suite de la période en cours. Aucun paiement n’est encaissé.</span>
      {erreur && <span className="adm-champ-erreur" role="alert">{erreur}</span>}
      <div className="adm-actions">
        <button type="submit" className="adm-bouton" disabled={!valide || offrir.isPending}>
          <Gift size={18} aria-hidden="true" />{offrir.isPending ? 'Envoi…' : valide ? `Offrir ${pluriel(nombre, 'jour', 'jours')}` : 'Offrir'}
        </button>
        <button type="button" className="adm-bouton adm-bouton--contour" onClick={surFini}>Annuler</button>
      </div>
    </form>
  )
}

const MOYENS: { id: MoyenAbonnement; libelle: string }[] = [
  { id: 'especes', libelle: 'Espèces' }, { id: 'wave', libelle: 'Wave' }, { id: 'orange', libelle: 'Orange Money' }, { id: 'offert', libelle: 'Offert' },
]

function FormulairePlan({ fiche, plans, surFini }: { fiche: FicheCommercant; plans: PlanPublic[]; surFini: () => void }) {
  const rafraichir = useRafraichirAdmin()
  const payants = plans.filter((p) => p.code !== 'gratuit')
  const [plan, definirPlan] = useState<CodePlan>(planParDefaut(fiche))
  const [periode, definirPeriode] = useState<'mois' | 'an'>('mois')
  const [moyen, definirMoyen] = useState<MoyenAbonnement>('especes')
  // Le montant suit le prix du plan, sauf si l'administrateur l'a changé.
  const [montantSaisi, definirMontantSaisi] = useState<string | null>(null)
  const [erreur, definirErreur] = useState('')
  const choisi = payants.find((p) => p.code === plan)
  const prix = !choisi ? null : choisi.sur_devis ? choisi.prix_a_partir_de : periode === 'an' ? choisi.prix_annuel : choisi.prix_mensuel
  const montant = montantSaisi ?? (prix !== null ? String(prix) : '')
  const offert = moyen === 'offert'
  const valide = offert || (montant !== '' && Number.isInteger(Number(montant)) && Number(montant) >= 0)

  const enregistrer = useMutation({
    mutationFn: () => Admin.changerPlan(fiche.id, { plan, periode, moyen, montant: offert ? 0 : Number(montant) }),
    onSuccess: (r) => { bulle(r.message); rafraichir(); surFini() },
    onError: (e) => definirErreur(messageErreur(e)),
  })
  const envoyer = (e: FormEvent) => { e.preventDefault(); if (valide) enregistrer.mutate() }

  return (
    <form className="adm-formulaire" onSubmit={envoyer} aria-label="Changer de plan">
      <div className="adm-formulaire-ligne">
        <div className="adm-champ">
          <label htmlFor="plan-code">Plan</label>
          <select id="plan-code" value={plan} onChange={(e) => { definirPlan(e.target.value as CodePlan); definirMontantSaisi(null) }}>
            {payants.map((p) => <option key={p.code} value={p.code}>{p.nom}</option>)}
          </select>
        </div>
        <div className="adm-champ">
          <label htmlFor="plan-periode">Durée</label>
          <select id="plan-periode" value={periode} onChange={(e) => { definirPeriode(e.target.value as 'mois' | 'an'); definirMontantSaisi(null) }}>
            <option value="mois">1 mois</option>
            <option value="an">1 an</option>
          </select>
        </div>
        <div className="adm-champ">
          <label htmlFor="plan-moyen">Payé par</label>
          <select id="plan-moyen" value={moyen} onChange={(e) => definirMoyen(e.target.value as MoyenAbonnement)}>
            {MOYENS.map((m) => <option key={m.id} value={m.id}>{m.libelle}</option>)}
          </select>
        </div>
        {!offert && (
          <div className="adm-champ">
            <label htmlFor="plan-montant">Montant reçu (F)</label>
            <input id="plan-montant" type="number" inputMode="numeric" min={0} value={montant} aria-invalid={!valide}
              onChange={(e) => { definirMontantSaisi(e.target.value); definirErreur('') }} />
          </div>
        )}
      </div>
      <span className="adm-champ-aide">
        Pour un paiement reçu hors de l’application, ou un plan offert. La période commence à la suite de l’actuelle et apparaît dans les finances.
      </span>
      {erreur && <span className="adm-champ-erreur" role="alert">{erreur}</span>}
      <div className="adm-actions">
        <button type="submit" className="adm-bouton" disabled={!valide || enregistrer.isPending}>{enregistrer.isPending ? 'Enregistrement…' : 'Enregistrer le plan'}</button>
        <button type="button" className="adm-bouton adm-bouton--contour" onClick={surFini}>Annuler</button>
      </div>
    </form>
  )
}

/** Création d'un compte : le mot de passe provisoire n'est montré qu'une fois. */
function AjoutCommercant({ surFermer }: { surFermer: () => void }) {
  const rafraichir = useRafraichirAdmin()
  const [identifiant, definirIdentifiant] = useState('')
  const [nomCommerce, definirNomCommerce] = useState('')
  const [telephone, definirTelephone] = useState('')
  const [erreur, definirErreur] = useState('')
  const creer = useMutation({
    mutationFn: () => Admin.creerCommercant({ identifiant: identifiant.trim(), nom_commerce: nomCommerce.trim() || undefined, telephone: telephone.trim() || undefined }),
    onSuccess: () => rafraichir(),
    onError: (e) => definirErreur(messageErreur(e)),
  })
  const envoyer = (e: FormEvent) => { e.preventDefault(); if (identifiant.trim()) creer.mutate() }

  if (creer.data) {
    const compte = creer.data
    const copier = async () => {
      try { await navigator.clipboard.writeText(compte.mot_de_passe_provisoire); bulle('Mot de passe copié.') } catch { bulle('Copie impossible : notez-le à la main.', 'info') }
    }
    return (
      <section className="adm-carte" aria-labelledby="titre-compte-cree" role="status">
        <h2 id="titre-compte-cree" className="adm-h2">Compte créé pour {nomCommercant(compte)}</h2>
        <p className="adm-soustitre">
          Transmettez ces accès au commerçant. Le mot de passe provisoire ne sera plus affiché ; il pourra le changer ensuite.
        </p>
        <dl className="adm-dl">
          <div><dt>Identifiant</dt><dd>{compte.identifiant}</dd></div>
        </dl>
        <div className="adm-motpasse">
          <code>{compte.mot_de_passe_provisoire}</code>
          <button type="button" className="adm-bouton adm-bouton--contour" onClick={copier}><Copy size={16} aria-hidden="true" />Copier</button>
        </div>
        <div className="adm-actions">
          <button type="button" className="adm-bouton" onClick={() => { surFermer(); aller('commercants', { id: compte.id }) }}>Ouvrir sa fiche</button>
          <button type="button" className="adm-bouton adm-bouton--contour" onClick={surFermer}>Terminé</button>
        </div>
      </section>
    )
  }

  return (
    <form className="adm-carte" onSubmit={envoyer} aria-labelledby="titre-ajout">
      <h2 id="titre-ajout" className="adm-h2">Ajouter un commerçant</h2>
      <div className="adm-formulaire-ligne">
        <div className="adm-champ">
          <label htmlFor="ajout-identifiant">Identifiant de connexion</label>
          <input id="ajout-identifiant" value={identifiant} onChange={(e) => { definirIdentifiant(e.target.value); definirErreur('') }}
            placeholder="E-mail ou numéro de téléphone" autoComplete="off" required />
        </div>
        <div className="adm-champ">
          <label htmlFor="ajout-nom">Nom du commerce</label>
          <input id="ajout-nom" value={nomCommerce} onChange={(e) => definirNomCommerce(e.target.value)} placeholder="Ex. : Boutique Ndiaye" />
        </div>
        <div className="adm-champ">
          <label htmlFor="ajout-telephone">Téléphone WhatsApp</label>
          <input id="ajout-telephone" type="tel" inputMode="tel" value={telephone} onChange={(e) => definirTelephone(e.target.value)} placeholder="Ex. : 77 123 45 67" />
        </div>
      </div>
      <span className="adm-champ-aide">Le compte démarre comme une inscription : une boutique, et l’essai offert s’il est activé dans les paramètres.</span>
      {erreur && <span className="adm-champ-erreur" role="alert">{erreur}</span>}
      <div className="adm-actions">
        <button type="submit" className="adm-bouton" disabled={!identifiant.trim() || creer.isPending}>{creer.isPending ? 'Création…' : 'Créer le compte'}</button>
        <button type="button" className="adm-bouton adm-bouton--contour" onClick={surFermer}>Annuler</button>
      </div>
    </form>
  )
}
