/* Plans et tarifs : prix, limites et fonctionnalités de chaque plan, réglés
 * ici sans redéployer. Les cases du tableau s'enregistrent dès le clic. */

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil } from 'lucide-react'
import { Admin, fcfa, type CleLimite, type CodePlan, type PlanPublic, type ReglagesAbonnement, type TableauDeBordAdmin } from '../../outils/api'
import { bulle } from '../../outils/bulles'
import { ChargementVue, EnTeteVue, ErreurVue, Pastille } from './communs'
import { CLES_ADMIN, messageErreur, pluriel, useRafraichirAdmin } from './outilsAdmin'

type DonneesPlans = Awaited<ReturnType<typeof Admin.plans>>
const CLES_LIMITES: CleLimite[] = ['boutiques', 'employes', 'produits', 'ia']
const LIBELLES: Record<CleLimite, string> = { boutiques: 'Boutiques', employes: 'Employés', produits: 'Produits', ia: 'Conseils IA par mois' }

/** Une limite dite comme un commerçant la lirait. */
function texteLimite(cle: CleLimite, n: number | null): string {
  const nombre = (x: number) => new Intl.NumberFormat('fr-FR').format(x)
  switch (cle) {
    case 'boutiques': return n === null ? 'Boutiques illimitées' : pluriel(n, 'boutique', 'boutiques')
    case 'employes': return n === null ? 'Employés illimités' : n === 0 ? 'Patron seul' : `Patron et ${pluriel(n, 'employé', 'employés')}`
    case 'produits': return n === null ? 'Produits illimités' : `${nombre(n)} produits`
    default: return n === null ? 'Conseils IA illimités' : n === 0 ? 'Sans conseils IA' : `${nombre(n)} conseils IA par mois`
  }
}

/** Cellule courte du tableau comparatif. */
function celluleLimite(cle: CleLimite, n: number | null): string {
  if (n === null) return 'Illimité'
  if (cle === 'employes' && n === 0) return 'Patron seul'
  return new Intl.NumberFormat('fr-FR').format(n)
}

export default function VuePlans() {
  const plans = useQuery({ queryKey: CLES_ADMIN.plans, queryFn: Admin.plans })
  // Facultatifs : nombre d'abonnés par plan, durée de l'essai.
  const tableau = useQuery({ queryKey: CLES_ADMIN.tableau, queryFn: Admin.tableauDeBord })
  const reglages = useQuery({ queryKey: CLES_ADMIN.reglages, queryFn: Admin.reglages })
  const [enEdition, definirEnEdition] = useState<CodePlan | null>(null)

  if (plans.isPending) return <ChargementVue blocs={[340, 420]} />
  if (plans.isError) {
    return <div className="adm-contenu"><EnTeteVue titre="Plans et tarifs" /><ErreurVue erreur={plans.error} surReessai={() => plans.refetch()} /></div>
  }

  const liste = plans.data.plans

  return (
    <div className="adm-contenu">
      <EnTeteVue
        titre="Plans et tarifs"
        soustitre="Ce que chaque plan débloque. Prix, limites et fonctionnalités se règlent ici, sans mise à jour de l’application."
      />

      <section className="adm-plans" aria-label="Plans">
        {liste.map((p) => (
          <CartePlanAdmin key={p.code} plan={p} repartition={tableau.data?.repartition} reglages={reglages.data}
            enEdition={enEdition === p.code} surModifier={() => definirEnEdition(enEdition === p.code ? null : p.code)} surFini={() => definirEnEdition(null)} />
        ))}
      </section>

      <Matrice donnees={plans.data} />
    </div>
  )
}

function CartePlanAdmin({ plan: p, repartition, reglages, enEdition, surModifier, surFini }: {
  plan: PlanPublic
  repartition: TableauDeBordAdmin['repartition'] | undefined
  reglages: ReglagesAbonnement | undefined
  enEdition: boolean
  surModifier: () => void
  surFini: () => void
}) {
  const style = p.code === 'pro' ? ' adm-plan--vedette' : p.code === 'entreprise' ? ' adm-plan--sombre' : ''
  const essai = reglages && reglages.plan_essai === p.code && reglages.duree_essai_jours > 0 ? reglages.duree_essai_jours : 0
  const abonnes = repartition?.[p.code]
  const enEssai = essai ? repartition?.essai : undefined
  const pied = abonnes === undefined ? null
    : p.code === 'gratuit' ? pluriel(abonnes, 'commerçant', 'commerçants')
      : `${pluriel(abonnes, 'abonné', 'abonnés')}${enEssai ? ` · ${enEssai} en essai` : ''}`

  return (
    <article className={`adm-plan${style}`} aria-labelledby={`plan-${p.code}`}>
      <div className="adm-pile adm-pile--serre">
        <div className="adm-plan-titre">
          <h2 id={`plan-${p.code}`} className="adm-plan-nom">{p.nom}</h2>
          {p.code === 'pro' && <span className="adm-plan-recommande">Recommandé</span>}
        </div>
        {p.accroche && <span className="adm-plan-accroche">{p.accroche}</span>}
      </div>

      <div className="adm-pile adm-pile--serre">
        {p.sur_devis ? (
          <>
            <span className="adm-plan-prix"><strong>Sur devis</strong></span>
            {p.prix_a_partir_de !== null && <span className="adm-legende">À partir de {fcfa(p.prix_a_partir_de)} par mois</span>}
          </>
        ) : p.prix_mensuel === 0 ? (
          <>
            <span className="adm-plan-prix"><strong>0 F</strong></span>
            <span className="adm-legende">Sans limite de durée</span>
          </>
        ) : (
          <>
            <span className="adm-plan-prix"><strong>{fcfa(p.prix_mensuel)}</strong><span>par mois</span></span>
            <span className="adm-legende">
              {p.prix_annuel !== null ? `Ou ${fcfa(p.prix_annuel)} par an` : ''}{essai ? ` · essai de ${essai} jours` : ''}
            </span>
          </>
        )}
      </div>

      {enEdition ? (
        <EditionPlan plan={p} surFini={surFini} />
      ) : (
        <ul className="adm-plan-limites">
          {CLES_LIMITES.map((cle) => (
            <li key={cle}><Check size={16} aria-hidden="true" />{texteLimite(cle, p.limites[cle])}</li>
          ))}
        </ul>
      )}

      <div className="adm-plan-pied">
        <span>{pied}</span>
        {!enEdition && (
          <button type="button" className="adm-bouton adm-bouton--contour" onClick={surModifier} aria-label={`Modifier le plan ${p.nom}`}>
            <Pencil size={16} aria-hidden="true" />Modifier
          </button>
        )}
      </div>
    </article>
  )
}

const versTexte = (n: number | null) => (n === null ? '' : String(n))

function EditionPlan({ plan, surFini }: { plan: PlanPublic; surFini: () => void }) {
  const rafraichir = useRafraichirAdmin()
  const gratuit = plan.code === 'gratuit'
  const [nom, definirNom] = useState(plan.nom)
  const [accroche, definirAccroche] = useState(plan.accroche ?? '')
  const [prix, definirPrix] = useState(String(plan.prix_mensuel))
  const [surDevis, definirSurDevis] = useState(plan.sur_devis)
  const [aPartirDe, definirAPartirDe] = useState(versTexte(plan.prix_a_partir_de))
  const [limites, definirLimites] = useState<Record<CleLimite, string>>({
    boutiques: versTexte(plan.limites.boutiques), employes: versTexte(plan.limites.employes),
    produits: versTexte(plan.limites.produits), ia: versTexte(plan.limites.ia),
  })
  const [erreur, definirErreur] = useState('')

  const entierOuVide = (v: string) => v.trim() === '' || (Number.isInteger(Number(v)) && Number(v) >= 0)
  const valide = nom.trim() !== '' && entierOuVide(prix) && prix.trim() !== '' && entierOuVide(aPartirDe) && CLES_LIMITES.every((c) => entierOuVide(limites[c]))

  const enregistrer = useMutation({
    mutationFn: () => Admin.modifierPlan(plan.code, {
      nom: nom.trim(),
      accroche: accroche.trim() || null,
      ...(gratuit ? {} : {
        prix_mensuel: Number(prix),
        sur_devis: surDevis,
        prix_a_partir_de: surDevis && aPartirDe.trim() ? Number(aPartirDe) : null,
      }),
      limites: Object.fromEntries(CLES_LIMITES.map((c) => [c, limites[c].trim() === '' ? null : Number(limites[c])])) as Record<CleLimite, number | null>,
    }),
    onSuccess: (r) => { bulle(r.message); rafraichir(); surFini() },
    onError: (e) => definirErreur(messageErreur(e)),
  })
  const envoyer = (e: FormEvent) => { e.preventDefault(); if (valide) enregistrer.mutate() }
  const id = (champ: string) => `plan-${plan.code}-${champ}`

  return (
    <form className="adm-formulaire" onSubmit={envoyer} aria-label={`Modifier le plan ${plan.nom}`}>
      <div className="adm-champ">
        <label htmlFor={id('nom')}>Nom</label>
        <input id={id('nom')} value={nom} maxLength={64} onChange={(e) => definirNom(e.target.value)} required />
      </div>
      <div className="adm-champ">
        <label htmlFor={id('accroche')}>Accroche</label>
        <input id={id('accroche')} value={accroche} maxLength={160} onChange={(e) => definirAccroche(e.target.value)} placeholder="Ex. : Pour la boutique qui tourne" />
      </div>
      {gratuit ? (
        <span className="adm-champ-aide">Le plan Gratuit reste gratuit : il accueille les comptes dont l’abonnement a expiré.</span>
      ) : (
        <>
          <div className="adm-formulaire-ligne">
            <div className="adm-champ">
              <label htmlFor={id('prix')}>Prix par mois (F)</label>
              <input id={id('prix')} type="number" inputMode="numeric" min={0} value={prix} aria-invalid={!entierOuVide(prix) || prix.trim() === ''} onChange={(e) => definirPrix(e.target.value)} />
            </div>
            {surDevis && (
              <div className="adm-champ">
                <label htmlFor={id('apartir')}>À partir de (F)</label>
                <input id={id('apartir')} type="number" inputMode="numeric" min={0} value={aPartirDe} aria-invalid={!entierOuVide(aPartirDe)} onChange={(e) => definirAPartirDe(e.target.value)} />
              </div>
            )}
          </div>
          <label className="adm-case adm-case--simple">
            <input type="checkbox" checked={surDevis} onChange={(e) => definirSurDevis(e.target.checked)} />
            <span>Sur devis : le commerçant vous contacte au lieu de payer en ligne.</span>
          </label>
        </>
      )}
      <fieldset className="adm-groupe">
        <legend>Limites</legend>
        <div className="adm-formulaire-ligne">
          {CLES_LIMITES.map((c) => (
            <div key={c} className="adm-champ">
              <label htmlFor={id(c)}>{LIBELLES[c]}</label>
              <input id={id(c)} type="number" inputMode="numeric" min={0} value={limites[c]} placeholder="Illimité" aria-invalid={!entierOuVide(limites[c])}
                onChange={(e) => definirLimites({ ...limites, [c]: e.target.value })} />
            </div>
          ))}
        </div>
        <span className="adm-champ-aide">Laissez vide pour illimité. Employés : 0 veut dire « patron seul ».</span>
      </fieldset>
      {erreur && <span className="adm-champ-erreur" role="alert">{erreur}</span>}
      <div className="adm-actions">
        <button type="submit" className="adm-bouton" disabled={!valide || enregistrer.isPending}>{enregistrer.isPending ? 'Enregistrement…' : 'Enregistrer'}</button>
        <button type="button" className="adm-bouton adm-bouton--contour" onClick={surFini}>Annuler</button>
      </div>
    </form>
  )
}

function Matrice({ donnees }: { donnees: DonneesPlans }) {
  const client = useQueryClient()
  const [annonce, definirAnnonce] = useState('')
  const basculer = useMutation({
    mutationFn: ({ code, fonctionnalites }: { code: CodePlan; fonctionnalites: string[] }) => Admin.modifierPlan(code, { fonctionnalites }),
    // La case change tout de suite ; elle revient en arrière si l'API refuse.
    onMutate: async ({ code, fonctionnalites }) => {
      await client.cancelQueries({ queryKey: CLES_ADMIN.plans })
      const avant = client.getQueryData<DonneesPlans>(CLES_ADMIN.plans)
      client.setQueryData<DonneesPlans>(CLES_ADMIN.plans, (d) => d && { ...d, plans: d.plans.map((p) => (p.code === code ? { ...p, fonctionnalites } : p)) })
      return { avant }
    },
    onError: (e, _variables, contexte) => {
      if (contexte?.avant) client.setQueryData(CLES_ADMIN.plans, contexte.avant)
      bulle(messageErreur(e, 'Modification non enregistrée.'), 'erreur', { duree: 6000 })
    },
    onSuccess: (r) => definirAnnonce(`Plan ${r.plan.nom} enregistré.`),
    onSettled: () => client.invalidateQueries({ queryKey: CLES_ADMIN.plans }),
  })

  const { plans, fonctionnalites } = donnees
  const changer = (p: PlanPublic, code: string, inclus: boolean) => {
    const suivantes = inclus ? [...p.fonctionnalites, code] : p.fonctionnalites.filter((f) => f !== code)
    basculer.mutate({ code: p.code, fonctionnalites: suivantes })
  }

  return (
    <section className="adm-carte" aria-labelledby="titre-matrice">
      <div className="adm-carte-entete">
        <h2 id="titre-matrice" className="adm-h2">Ce que débloque chaque plan</h2>
        <span className="adm-legende" aria-live="polite">{annonce || 'Chaque case s’enregistre dès que vous la cochez.'}</span>
      </div>
      <p className="adm-legende">Toujours inclus : les ventes, le stock, la caisse et le carnet de crédit. Les données restent au commerçant, quel que soit son plan.</p>
      <div className="adm-matrice-defilement" tabIndex={0} aria-label="Tableau des plans, défilable">
        <table className="adm-matrice">
          <thead>
            <tr>
              <th scope="col">Fonctionnalité</th>
              {plans.map((p) => (
                <th key={p.code} scope="col">
                  <span className="adm-matrice-plan">{p.nom}{p.code === 'pro' && <Pastille ton="violet">Recommandé</Pastille>}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="adm-matrice-groupe"><th scope="colgroup" colSpan={plans.length + 1}>Limites</th></tr>
            {CLES_LIMITES.map((cle) => (
              <tr key={cle}>
                <th scope="row">{LIBELLES[cle]}</th>
                {plans.map((p) => <td key={p.code}>{celluleLimite(cle, p.limites[cle])}</td>)}
              </tr>
            ))}
            <tr className="adm-matrice-groupe"><th scope="colgroup" colSpan={plans.length + 1}>Fonctionnalités</th></tr>
            {Object.entries(fonctionnalites).map(([code, libelle]) => (
              <tr key={code}>
                <th scope="row">{libelle}</th>
                {plans.map((p) => (
                  <td key={p.code}>
                    <input type="checkbox" checked={p.fonctionnalites.includes(code)} aria-label={`${libelle} : plan ${p.nom}`}
                      onChange={(e) => changer(p, code, e.target.checked)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
