/* Mon plan : où en est l'abonnement, choisir un plan, le payer.
 *
 * Le paiement est MANUEL et VÉRIFIÉ : le commerçant paie avec Wave ou Orange
 * Money, recopie la référence du SMS de confirmation, et l'administrateur la
 * compare à l'historique de son compte. Rien ne s'active avant (cf. API,
 * ControleurAbonnement). L'écran ne promet donc aucun délai, et n'annonce
 * jamais une date d'échéance que le serveur n'a pas encore calculée. */

import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Check, CircleCheck, Clock, Copy, MessageCircle, Send, ShieldCheck, TriangleAlert, Upload, X } from 'lucide-react'
import { Abonnement, fcfa, type CleLimite, type CodePlan, type DonneesAbonnement, type EtatAbonnement, type PaiementAbonnement, type PlanPublic, type UtilisationPlan, type Utilisateur } from '../outils/api'
import { useAbonnement, useRafraichirAbonnement } from '../outils/requetes'
import { LIBELLES_LIMITES, atoutsDuPlan, dateLongue, equivalentMensuel, montant, presDeLaLimite, prixPeriode, quand, texteEtat, texteUtilisation, type Periode } from '../outils/abonnement'
import { MOYENS_PAIEMENT } from '../outils/paiements'
import { compresserPhoto, ErreurPhoto, RECU_COTE_MAX, RECU_OCTETS_MAX } from '../outils/photo'
import { decrireErreur } from '../outils/erreursChargement'
import ErreurChargement from '../composants/ErreurChargement'
import '../abonnement.css'

type Choix = { plan: PlanPublic; periode: Periode }

export default function MonPlan({ utilisateur }: { utilisateur: Utilisateur | null }) {
  const requete = useAbonnement()
  const [periode, definirPeriode] = useState<Periode>('mois')
  const [choix, definirChoix] = useState<Choix | null>(null)

  if (!requete.data) {
    const erreur = decrireErreur(requete.error)
    return erreur ? <ErreurChargement erreur={erreur} surReessai={() => requete.refetch()} /> : <ChargementPlan />
  }
  if (choix) {
    return <ParcoursPaiement choix={choix} donnees={requete.data} telephone={utilisateur?.telephone ?? ''} surRetour={() => definirChoix(null)} />
  }
  return <ApercuPlans donnees={requete.data} periode={periode} surPeriode={definirPeriode} surChoisir={(plan) => definirChoix({ plan, periode })} />
}

// ─── Aperçu : état, plans, utilisation ───────────────────────────────────────

function ApercuPlans({ donnees, periode, surPeriode, surChoisir }: {
  donnees: DonneesAbonnement
  periode: Periode
  surPeriode: (p: Periode) => void
  surChoisir: (plan: PlanPublic) => void
}) {
  const { etat, plans, en_attente, dernier_refus, paiement, peut_payer, utilisation } = donnees
  const bandeau = texteEtat(etat, plans)
  const parCode = (code: CodePlan) => plans.find((p) => p.code === code)
  const precedent = (plan: PlanPublic) => [...plans].filter((p) => p.ordre < plan.ordre).sort((a, b) => b.ordre - a.ordre)[0]
  const bloque = !!en_attente || !peut_payer
  const gratuit = parCode('gratuit')

  return (
    <div className="plan-page">
      <section className={`plan-bandeau plan-bandeau--${bandeau.ton}`}>
        <span className="plan-bandeau-icone" aria-hidden="true">
          {bandeau.ton === 'grace' ? <TriangleAlert size={22} /> : bandeau.ton === 'paye' ? <CircleCheck size={22} /> : <Clock size={22} />}
        </span>
        <span className="plan-bandeau-texte">
          <strong>{bandeau.titre}</strong>
          <span>{bandeau.detail}</span>
        </span>
      </section>

      {en_attente && <SuiviVerification paiement={en_attente} lienContact={paiement.lien_contact} />}
      {!en_attente && dernier_refus && (
        <section className="plan-refus">
          <TriangleAlert size={20} aria-hidden="true" />
          <span>
            <strong>Votre dernier paiement n’a pas été validé</strong>
            <span>Motif : {dernier_refus.motif_refus}. Vérifiez la référence et le montant dans le SMS, puis déclarez-le à nouveau.</span>
          </span>
        </section>
      )}
      {!peut_payer && <p className="plan-note">Seul le propriétaire de la boutique peut changer de plan.</p>}

      <BasculePeriode periode={periode} moisOfferts={paiement.mois_offerts_annuel} surChoix={surPeriode} />

      {(['pro', 'essentiel', 'entreprise'] as CodePlan[]).map((code) => {
        const plan = parCode(code)
        return plan && (
          <CarteOffre key={code} plan={plan} precedent={precedent(plan)} periode={periode} etat={etat}
            bloque={bloque} enAttente={!!en_attente} lienContact={paiement.lien_contact} surChoisir={surChoisir} />
        )
      })}

      {gratuit && (
        <article className="plan-carte plan-carte--discrete" aria-labelledby="plan-gratuit">
          <div className="plan-entete">
            <h2 id="plan-gratuit" className="plan-nom">Gratuit</h2>
            {etat.source === 'essai' && <span className="plan-chip">Après votre essai</span>}
            {etat.source === 'gratuit' && <span className="plan-chip">Votre plan</span>}
          </div>
          <span className="plan-prix-valeur plan-prix-valeur--petit">0 F</span>
          <ul className="plan-atouts plan-atouts--compact">
            {['Ventes, caisse, stock et carnet de crédit', 'Mode hors ligne', ...atoutsDuPlan(gratuit)].map((atout) => (
              <li key={atout}><CircleCheck size={18} aria-hidden="true" /><span>{atout}</span></li>
            ))}
          </ul>
        </article>
      )}

      <Utilisation etat={etat} utilisation={utilisation} />

      <p className="plan-note">
        <ShieldCheck size={20} aria-hidden="true" />
        <span>Paiement par Wave ou Orange Money, vérifié par SamaCommerce. Sans renouvellement, vous repassez au plan Gratuit sans rien perdre.</span>
      </p>
    </div>
  )
}

function BasculePeriode({ periode, moisOfferts, surChoix }: { periode: Periode; moisOfferts: number; surChoix: (p: Periode) => void }) {
  return (
    <div className="plan-bascule" role="group" aria-label="Durée de l’abonnement" data-periode={periode}>
      <button type="button" aria-pressed={periode === 'mois'} onClick={() => surChoix('mois')}>Par mois</button>
      <button type="button" aria-pressed={periode === 'an'} onClick={() => surChoix('an')}>
        <span>Par an</span>
        {moisOfferts > 0 && <span className="plan-remise">{moisOfferts} mois offerts</span>}
      </button>
    </div>
  )
}

function CarteOffre({ plan, precedent, periode, etat, bloque, enAttente, lienContact, surChoisir }: {
  plan: PlanPublic
  precedent?: PlanPublic
  periode: Periode
  etat: EtatAbonnement
  bloque: boolean
  enAttente: boolean
  lienContact: string | null
  surChoisir: (plan: PlanPublic) => void
}) {
  const vedette = plan.code === 'pro'
  const actuel = etat.plan.code === plan.code && etat.source !== 'gratuit'
  const prix = prixPeriode(plan, periode)
  const etiquette = actuel ? (etat.source === 'essai' ? 'Votre essai actuel' : 'Votre plan') : vedette ? 'Recommandé' : null
  const action = actuel ? (etat.source === 'essai' ? `Continuer avec ${plan.nom}` : `Renouveler ${plan.nom}`) : `Choisir ${plan.nom}`

  return (
    <article className={`plan-carte${vedette ? ' plan-carte--vedette' : ''}`} aria-labelledby={`plan-${plan.code}`}>
      <div className="plan-entete">
        <h2 id={`plan-${plan.code}`} className="plan-nom">{plan.nom}</h2>
        {etiquette && <span className="plan-chip">{etiquette}</span>}
      </div>
      {plan.accroche && <p className="plan-accroche">{plan.accroche}</p>}

      {plan.sur_devis ? (
        <div className="plan-prix">
          <span className="plan-prix-valeur">Sur devis</span>
          {plan.prix_a_partir_de ? <span className="plan-equivalent">À partir de {fcfa(plan.prix_a_partir_de)} par mois</span> : null}
        </div>
      ) : (
        // La clé relance le fondu à chaque bascule mois / année.
        <div className="plan-prix" key={periode}>
          <span className="plan-prix-ligne">
            <span className="plan-prix-valeur">{montant(prix)}</span>
            <span className="plan-prix-periode">{periode === 'an' ? 'par an' : 'par mois'}</span>
          </span>
          {periode === 'an' && <span className="plan-equivalent">Soit {montant(equivalentMensuel(plan))} par mois</span>}
        </div>
      )}

      <ul className="plan-atouts">
        {atoutsDuPlan(plan, precedent).map((atout) => (
          <li key={atout}><CircleCheck size={20} aria-hidden="true" /><span>{atout}</span></li>
        ))}
      </ul>

      {plan.sur_devis ? (
        lienContact
          ? <a className="plan-cta plan-cta--contour" href={lienContact} target="_blank" rel="noopener noreferrer"><MessageCircle size={20} aria-hidden="true" /> Nous écrire sur WhatsApp</a>
          : <p className="plan-accroche">Demandez un devis à l’administrateur de SamaCommerce.</p>
      ) : (
        <>
          <button type="button" className={`plan-cta${vedette ? '' : ' plan-cta--contour'}`} disabled={bloque} onClick={() => surChoisir(plan)}>
            {action}
          </button>
          {enAttente && <span className="plan-aide">Un paiement est déjà en vérification : attendez son résultat.</span>}
        </>
      )}
    </article>
  )
}

const ORDRE_LIMITES: CleLimite[] = ['produits', 'boutiques', 'employes', 'ia']

function Utilisation({ etat, utilisation }: { etat: EtatAbonnement; utilisation: UtilisationPlan }) {
  return (
    <section className="plan-utilisation" aria-labelledby="titre-utilisation">
      <h2 id="titre-utilisation" className="plan-sous-titre">Ce que vous utilisez</h2>
      <dl>
        {ORDRE_LIMITES.map((cle) => {
          const limite = etat.limites[cle]
          const proche = presDeLaLimite(utilisation[cle], limite)
          return (
            <div key={cle} className={proche ? 'plan-utilisation-proche' : undefined}>
              <dt>{LIBELLES_LIMITES[cle]}</dt>
              <dd>
                {proche && <TriangleAlert size={16} aria-hidden="true" />}
                {texteUtilisation(cle, utilisation[cle], limite)}
                {proche && <span className="lecteur-ecran-seul"> (limite proche)</span>}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}

// ─── Paiement en trois étapes ────────────────────────────────────────────────

const ETAPES = ['Payer', 'Déclarer', 'Vérification']

function ParcoursPaiement({ choix, donnees, telephone, surRetour }: {
  choix: Choix
  donnees: DonneesAbonnement
  telephone: string
  surRetour: () => void
}) {
  const rafraichir = useRafraichirAbonnement()
  const { plan, periode } = choix
  const { paiement: reglages, etat } = donnees
  const numeroDe = (m: 'wave' | 'orange') => (m === 'wave' ? reglages.numero_wave : reglages.numero_orange)
  const moyens = MOYENS_PAIEMENT.filter((m) => m.id === 'wave' || m.id === 'orange') as (typeof MOYENS_PAIEMENT[number] & { id: 'wave' | 'orange' })[]
  const prix = prixPeriode(plan, periode) ?? 0

  const [etape, definirEtape] = useState<1 | 2 | 3>(1)
  const [moyen, definirMoyen] = useState<'wave' | 'orange'>(numeroDe('wave') ? 'wave' : 'orange')
  const [numero, definirNumero] = useState(telephone)
  const [reference, definirReference] = useState('')
  const [somme, definirSomme] = useState(String(prix))
  const [capture, definirCapture] = useState<string | null>(null)
  const [erreurs, definirErreurs] = useState<Record<string, string>>({})
  const [envoi, definirEnvoi] = useState(false)
  const [envoye, definirEnvoye] = useState<PaiementAbonnement | null>(null)
  const [copie, definirCopie] = useState(false)
  const champs = useRef<Record<string, HTMLInputElement | null>>({})
  const id = useId()

  const numeroChoisi = numeroDe(moyen)
  const nomMoyen = moyen === 'wave' ? 'Wave' : 'Orange Money'
  // Même règle que le serveur : pendant l'essai, un plan de même niveau commence après.
  const planEssai = donnees.plans.find((p) => p.code === etat.plan_essai)
  const apresEssai = etat.source === 'essai' && !!etat.essai_jusqu_au && !!planEssai && plan.ordre <= planEssai.ordre
  const aLaSuite = (etat.source === 'paye' || etat.source === 'grace') && plan.ordre <= etat.plan.ordre

  const copier = async () => {
    if (!numeroChoisi) return
    try {
      await navigator.clipboard.writeText(numeroChoisi.replace(/[^\d+]/g, ''))
      definirCopie(true)
      window.setTimeout(() => definirCopie(false), 2000)
    } catch { /* presse-papiers refusé : le numéro reste affiché en grand */ }
  }

  const envoyer = async (e: FormEvent) => {
    e.preventDefault()
    const manquants: Record<string, string> = {}
    if ((numero.match(/\d/g) || []).length < 7) manquants.numero_payeur = 'Indiquez le numéro de téléphone qui a envoyé l’argent.'
    if (reglages.reference_obligatoire && !reference.trim()) manquants.reference = 'Recopiez la référence du SMS : sans elle, nous ne pouvons pas retrouver votre paiement.'
    if (!Number(somme)) manquants.montant = 'Indiquez le montant envoyé.'
    definirErreurs(manquants)
    const premier = Object.keys(manquants)[0]
    if (premier) { champs.current[premier]?.focus(); return }

    definirEnvoi(true)
    try {
      const reponse = await Abonnement.declarer({
        plan: plan.code, periode, moyen, numero_payeur: numero.trim(), reference: reference.trim(), montant: Number(somme), capture,
      })
      definirEnvoye(reponse.paiement)
      definirEtape(3)
      void rafraichir()
    } catch (erreur) {
      const r = (erreur as { response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } } }).response
      if (r?.status === 422 && r.data?.errors) {
        const deServeur = Object.fromEntries(Object.entries(r.data.errors).map(([cle, messages]) => [cle, messages[0]]))
        definirErreurs(deServeur)
        if (deServeur.moyen) definirEtape(1)
        else champs.current[Object.keys(deServeur)[0]]?.focus()
      } else if (r?.data?.message) {
        definirErreurs({ general: r.data.message })
      } else {
        definirErreurs({ general: 'Pas de réseau : rien n’a été envoyé. Réessayez quand la connexion revient.' })
      }
    } finally { definirEnvoi(false) }
  }

  const aide = (cle: string) => (erreurs[cle] ? `${id}-${cle}-erreur` : undefined)

  return (
    <div className="plan-page">
      <ol className="plan-etapes" aria-label="Étapes du paiement">
        {ETAPES.map((libelle, i) => {
          const n = i + 1
          const faite = etape > n
          const courante = etape === n
          return (
            <li key={libelle} className={`plan-etape${courante ? ' plan-etape--courante' : ''}${faite ? ' plan-etape--faite' : ''}`} aria-current={courante ? 'step' : undefined}>
              <span className="plan-etape-rond" aria-hidden="true">{faite ? <Check size={16} strokeWidth={3} /> : n}</span>
              <span className="plan-etape-libelle">{libelle}</span>
            </li>
          )
        })}
      </ol>

      <section className="plan-recap" aria-label="Votre choix">
        <span className="plan-recap-texte">
          <span>Votre choix</span>
          <strong>{plan.nom} · {periode === 'an' ? '1 an' : '1 mois'}</strong>
          <span>{apresEssai ? `Commence à la fin de votre essai, le ${dateLongue(lendemain(etat.essai_jusqu_au!), false)}`
            : aLaSuite ? 'S’ajoute à la suite de votre plan actuel'
              : 'Actif dès la validation du paiement'}</span>
        </span>
        <span className="plan-recap-montant">{montant(prix)}</span>
      </section>

      {etape === 1 && (
        <section className="plan-etape-contenu" key="etape-1">
          <h2 className="plan-sous-titre">Payez avec votre téléphone</h2>
          <fieldset className="plan-moyens">
            <legend>Moyen de paiement</legend>
            {moyens.map((m) => {
              const dispo = !!numeroDe(m.id)
              return (
                <label key={m.id} className={`plan-moyen${moyen === m.id ? ' plan-moyen--choisi' : ''}${dispo ? '' : ' plan-moyen--indisponible'}`}>
                  <input type="radio" name={`${id}-moyen`} value={m.id} checked={moyen === m.id} disabled={!dispo} onChange={() => definirMoyen(m.id)} />
                  {m.logo && <img src={m.logo} alt="" width={40} height={40} />}
                  <span className="plan-moyen-texte">
                    <strong>{m.libelle}</strong>
                    <span>{dispo ? 'Paiement mobile' : 'Pas encore disponible'}</span>
                  </span>
                </label>
              )
            })}
            {erreurs.moyen && <p className="plan-erreur" role="alert">{erreurs.moyen}</p>}
          </fieldset>

          {numeroChoisi ? (
            <ol className="plan-instructions">
              <li><span className="plan-instruction-rang" aria-hidden="true">1</span><span>Ouvrez <strong>{nomMoyen}</strong> sur votre téléphone.</span></li>
              <li>
                <span className="plan-instruction-rang" aria-hidden="true">2</span>
                <span className="plan-instruction-bloc">
                  <span>Envoyez exactement <strong className="plan-fort">{montant(prix)}</strong> à ce numéro :</span>
                  <span className="plan-numero">
                    <span className="plan-numero-texte">
                      <strong>{numeroChoisi}</strong>
                      {reglages.nom_beneficiaire && <span>Au nom de {reglages.nom_beneficiaire}</span>}
                    </span>
                    <button type="button" className="plan-copier" onClick={copier} aria-live="polite">
                      <span className="plan-copier-contenu" key={copie ? 'oui' : 'non'}>
                        {copie ? <><Check size={16} strokeWidth={3} aria-hidden="true" /> Copié</> : <><Copy size={16} aria-hidden="true" /> Copier</>}
                      </span>
                    </button>
                  </span>
                </span>
              </li>
              <li><span className="plan-instruction-rang" aria-hidden="true">3</span><span>Gardez le SMS de confirmation : il contient la référence à recopier juste après.</span></li>
            </ol>
          ) : (
            <p className="plan-refus"><TriangleAlert size={20} aria-hidden="true" /><span>Aucun numéro de paiement n’est encore configuré. Écrivez à l’administrateur de SamaCommerce.</span></p>
          )}

          <button type="button" className="plan-cta" disabled={!numeroChoisi} onClick={() => definirEtape(2)}>J’ai payé, continuer</button>
          <button type="button" className="plan-lien" onClick={surRetour}>Changer de plan</button>
        </section>
      )}

      {etape === 2 && (
        <form className="plan-etape-contenu" key="etape-2" onSubmit={envoyer} noValidate>
          <div>
            <h2 className="plan-sous-titre">Recopiez les infos de votre SMS</h2>
            <p className="plan-accroche">Nous les comparons avec notre compte {nomMoyen} pour retrouver votre paiement.</p>
          </div>

          <div className="groupe-champ">
            <label htmlFor={`${id}-numero`}>Numéro qui a envoyé l’argent</label>
            <input id={`${id}-numero`} ref={(n) => { champs.current.numero_payeur = n }} type="tel" inputMode="tel" autoComplete="tel"
              placeholder="7X XXX XX XX" value={numero} onChange={(e) => definirNumero(e.target.value)}
              aria-invalid={!!erreurs.numero_payeur} aria-describedby={aide('numero_payeur')} />
            {erreurs.numero_payeur && <p className="plan-erreur" id={aide('numero_payeur')}>{erreurs.numero_payeur}</p>}
          </div>

          <div className="groupe-champ">
            <label htmlFor={`${id}-reference`}>Référence de la transaction</label>
            <input id={`${id}-reference`} ref={(n) => { champs.current.reference = n }} type="text" autoCapitalize="characters" autoComplete="off" spellCheck={false}
              value={reference} onChange={(e) => { definirReference(e.target.value); if (erreurs.reference) definirErreurs(({ reference: _ignoree, ...reste }) => reste) }}
              aria-invalid={!!erreurs.reference} aria-describedby={`${id}-reference-aide${erreurs.reference ? ' ' + aide('reference') : ''}`} />
            <p className="plan-aide" id={`${id}-reference-aide`}>Elle est écrite dans le SMS de confirmation de {nomMoyen}.</p>
            {erreurs.reference && <p className="plan-erreur" id={aide('reference')}>{erreurs.reference}</p>}
          </div>

          <div className="groupe-champ">
            <label htmlFor={`${id}-montant`}>Montant envoyé</label>
            <span className="plan-champ-montant">
              <input id={`${id}-montant`} ref={(n) => { champs.current.montant = n }} type="text" inputMode="numeric"
                value={somme} onChange={(e) => definirSomme(e.target.value.replace(/\D/g, ''))}
                aria-invalid={!!erreurs.montant} aria-describedby={aide('montant')} />
              <span aria-hidden="true">F</span>
            </span>
            {somme && Number(somme) !== prix && !erreurs.montant && (
              <p className="plan-aide">Le prix est de {montant(prix)}. Si vous avez envoyé un autre montant, indiquez-le tel quel : nous vérifierons.</p>
            )}
            {erreurs.montant && <p className="plan-erreur" id={aide('montant')}>{erreurs.montant}</p>}
          </div>

          {reglages.capture_autorisee && <CaptureRecu valeur={capture} surChange={definirCapture} />}

          {erreurs.general && <p className="plan-erreur" role="alert">{erreurs.general}</p>}

          <button type="submit" className="plan-cta" disabled={envoi}>
            {envoi ? 'Envoi…' : <><Send size={18} aria-hidden="true" /> Envoyer pour vérification</>}
          </button>
          <button type="button" className="plan-lien" onClick={() => definirEtape(1)}>Retour</button>
        </form>
      )}

      {etape === 3 && envoye && (
        <div className="plan-etape-contenu" key="etape-3">
          <SuiviVerification paiement={envoye} lienContact={reglages.lien_contact} />
          <button type="button" className="plan-cta" onClick={surRetour}>Retour à Mon plan</button>
        </div>
      )}
    </div>
  )
}

function lendemain(iso: string): string {
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1, j + 1))
  return d.toISOString().slice(0, 10)
}

function CaptureRecu({ valeur, surChange }: { valeur: string | null; surChange: (v: string | null) => void }) {
  const [erreur, definirErreur] = useState<string | null>(null)
  const [occupe, definirOccupe] = useState(false)
  const id = useId()

  const choisir = async (e: ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    definirOccupe(true); definirErreur(null)
    try {
      surChange(await compresserPhoto(fichier, RECU_COTE_MAX, RECU_OCTETS_MAX))
    } catch (err) {
      definirErreur(err instanceof ErreurPhoto ? err.message : 'Cette image n’a pas pu être lue. Essayez une autre capture.')
    } finally { definirOccupe(false) }
  }

  return (
    <div className="groupe-champ">
      <span className="plan-libelle" id={`${id}-libelle`}>Capture du SMS <span className="plan-facultatif">(facultatif)</span></span>
      {valeur ? (
        <span className="plan-capture-apercu">
          <img src={valeur} alt="Capture du SMS de paiement" />
          <button type="button" className="plan-lien" onClick={() => surChange(null)}><X size={16} aria-hidden="true" /> Retirer la photo</button>
        </span>
      ) : (
        <label className="plan-capture" aria-describedby={`${id}-libelle`}>
          <Upload size={20} aria-hidden="true" />
          <span>{occupe ? 'Préparation de la photo…' : 'Ajouter une photo du SMS'}</span>
          <input type="file" accept="image/*" className="lecteur-ecran-seul" onChange={choisir} disabled={occupe} />
        </label>
      )}
      {erreur && <p className="plan-erreur" role="alert">{erreur}</p>}
    </div>
  )
}

// ─── Suivi d'un paiement en vérification ─────────────────────────────────────

function SuiviVerification({ paiement, lienContact }: { paiement: PaiementAbonnement; lienContact: string | null }) {
  return (
    <section className="plan-suivi" aria-labelledby={`suivi-${paiement.id}`}>
      <span className="plan-suivi-icone" aria-hidden="true"><Clock size={28} /></span>
      <h2 id={`suivi-${paiement.id}`} className="plan-sous-titre">Paiement en vérification</h2>
      <p className="plan-accroche">Nous comparons votre déclaration avec notre compte {paiement.moyen_libelle}. Dès qu’il est validé, votre plan s’affiche ici.</p>

      <ol className="plan-frise">
        <li className="plan-frise--faite">
          <span className="plan-frise-rond" aria-hidden="true"><Check size={16} strokeWidth={3} /></span>
          <span><strong>Déclaration envoyée</strong><span>{quand(paiement.cree_le)}</span></span>
        </li>
        <li className="plan-frise--courante" aria-current="step">
          <span className="plan-frise-rond" aria-hidden="true"><Clock size={16} /></span>
          <span><strong>Vérification par SamaCommerce</strong><span>En cours</span></span>
        </li>
        <li>
          <span className="plan-frise-rond" aria-hidden="true" />
          <span><strong>Plan {paiement.plan_nom} activé</strong><span>Dès la validation</span></span>
        </li>
      </ol>

      <dl className="plan-recap-liste">
        <div><dt>Formule</dt><dd>{paiement.formule}</dd></div>
        <div><dt>Moyen</dt><dd>{paiement.moyen_libelle}</dd></div>
        {paiement.reference && <div><dt>Référence</dt><dd className="plan-reference">{paiement.reference}</dd></div>}
        <div><dt>Montant</dt><dd>{fcfa(paiement.montant_declare)}</dd></div>
      </dl>

      {lienContact && (
        <a className="plan-lien" href={lienContact} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={18} aria-hidden="true" /> Une question ? Écrivez-nous sur WhatsApp
        </a>
      )}
    </section>
  )
}

function ChargementPlan() {
  return (
    <div className="plan-page" aria-busy="true" aria-label="Chargement de votre plan">
      <div className="squelette" style={{ height: 86, borderRadius: 18 }} />
      <div className="squelette" style={{ height: 52, borderRadius: 16 }} />
      <div className="squelette" style={{ height: 320, borderRadius: 22 }} />
      <div className="squelette" style={{ height: 280, borderRadius: 22 }} />
    </div>
  )
}
