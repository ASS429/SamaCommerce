/* Paramètres : règles d'abonnement, numéros où les commerçants paient,
 * rappels d'échéance, sécurité du compte administrateur.
 *
 * Les numéros de paiement ne sont écrits nulle part dans le code : ils se
 * saisissent ici, et Mon plan les montre aux commerçants. */

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, Monitor, Smartphone, TriangleAlert } from 'lucide-react'
import { Admin, Appareils, fcfa, type CodePlan, type PlanPublic, type ReglagesAbonnement } from '../../outils/api'
import { basculerVerificationDeuxEtapes } from '../../outils/doubleFacteur'
import { bulle, demanderConfirmation } from '../../outils/bulles'
import { LISTE_VIDE } from '../../outils/requetes'
import { ChargementVue, EnTeteVue, ErreurVue, Interrupteur, LogoMoyen, Pastille, Squelette } from './communs'
import { CLES_ADMIN, depuis, messageErreur } from './outilsAdmin'

type Brouillon = Omit<ReglagesAbonnement, 'rappels_possibles'>
const JETONS = ['{prénom}', '{plan}', '{date}', '{montant}']
const MESSAGE_PAR_DEFAUT = 'Bonjour {prénom}, votre plan {plan} SamaCommerce expire le {date}.'
const EXEMPLE: Record<string, string> = { '{prénom}': 'Awa', '{nom}': 'Awa', '{plan}': 'Pro', '{date}': '28 octobre 2026', '{montant}': '5 000 F' }

function sansPossibles(r: ReglagesAbonnement): Brouillon {
  const { rappels_possibles: _ignore, ...reste } = r
  return reste
}

export default function VueParametres({ doubleFacteur, surDoubleFacteur }: { doubleFacteur: boolean; surDoubleFacteur: (actif: boolean) => void }) {
  const client = useQueryClient()
  const reglages = useQuery({ queryKey: CLES_ADMIN.reglages, queryFn: Admin.reglages })
  const plans = useQuery({ queryKey: CLES_ADMIN.plans, queryFn: Admin.plans })
  const [brouillon, definirBrouillon] = useState<Brouillon | null>(null)
  const [erreurs, definirErreurs] = useState<Record<string, string>>({})

  const initial = reglages.data ? sansPossibles(reglages.data) : null
  const valeur = brouillon ?? initial
  const modifie = !!brouillon && !!initial && JSON.stringify(brouillon) !== JSON.stringify(initial)

  // Fermer l'onglet avec des changements non enregistrés : le navigateur demande.
  useEffect(() => {
    if (!modifie) return
    const retenir = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', retenir)
    return () => window.removeEventListener('beforeunload', retenir)
  }, [modifie])

  const enregistrer = useMutation({
    mutationFn: (charge: Brouillon) => Admin.modifierReglages(charge),
    onSuccess: (r) => {
      client.setQueryData(CLES_ADMIN.reglages, r.reglages)
      client.invalidateQueries({ queryKey: CLES_ADMIN.plans }) // prix annuels recalculés
      definirBrouillon(null); definirErreurs({})
      bulle('Paramètres enregistrés.')
    },
    onError: (e) => {
      const champs = (e as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors
      if (champs) definirErreurs(Object.fromEntries(Object.entries(champs).map(([cle, messages]) => [cle.split('.')[0], messages[0]])))
      bulle(champs ? 'Vérifiez les champs signalés.' : messageErreur(e), 'erreur', { duree: 6000 })
    },
  })

  if (reglages.isPending) return <ChargementVue blocs={[300, 360, 280, 240]} />
  if (reglages.isError || !valeur) {
    return <div className="adm-contenu"><EnTeteVue titre="Paramètres" /><ErreurVue erreur={reglages.error} surReessai={() => reglages.refetch()} /></div>
  }

  const changer = <C extends keyof Brouillon>(champ: C, v: Brouillon[C]) => {
    definirBrouillon({ ...valeur, [champ]: v })
    if (erreurs[champ]) definirErreurs(({ [champ]: _retire, ...reste }) => reste)
  }
  const nombre = (texte: string) => Math.max(0, Number.parseInt(texte, 10) || 0)
  const payants = (plans.data?.plans ?? LISTE_VIDE).filter((p) => p.code !== 'gratuit')
  const erreur = (champ: string) => erreurs[champ] && <span className="adm-champ-erreur" role="alert">{erreurs[champ]}</span>

  return (
    <div className="adm-contenu adm-contenu--etroit">
      <EnTeteVue titre="Paramètres" soustitre="Les règles d’abonnement, les numéros où les commerçants paient et la sécurité de votre compte." />

      <section className="adm-carte" aria-labelledby="reglages-abonnements">
        <h2 id="reglages-abonnements" className="adm-h2">Abonnements</h2>
        <div className="adm-champ">
          <label htmlFor="essai-jours">Essai offert à l’inscription</label>
          <div className="adm-champ-unite">
            <input id="essai-jours" type="number" inputMode="numeric" min={0} max={365} value={valeur.duree_essai_jours}
              aria-invalid={!!erreurs.duree_essai_jours} onChange={(e) => changer('duree_essai_jours', nombre(e.target.value))} />
            <span>jours du plan</span>
            <select aria-label="Plan offert pendant l’essai" value={valeur.plan_essai} onChange={(e) => changer('plan_essai', e.target.value as CodePlan)}>
              {payants.length === 0 && <option value={valeur.plan_essai}>{valeur.plan_essai}</option>}
              {payants.map((p) => <option key={p.code} value={p.code}>{p.nom}</option>)}
            </select>
          </div>
          <span className="adm-champ-aide">Mettez 0 pour ne pas offrir d’essai.</span>
          {erreur('duree_essai_jours')}{erreur('plan_essai')}
        </div>
        <div className="adm-champ">
          <label htmlFor="grace-jours">Délai de grâce après l’expiration</label>
          <div className="adm-champ-unite">
            <input id="grace-jours" type="number" inputMode="numeric" min={0} max={60} value={valeur.delai_grace_jours}
              aria-invalid={!!erreurs.delai_grace_jours} onChange={(e) => changer('delai_grace_jours', nombre(e.target.value))} />
            <span>jours</span>
          </div>
          <span className="adm-champ-aide">
            Pendant ce délai, tout fonctionne et le commerçant voit un rappel. Ensuite, le compte repasse au plan Gratuit : aucune donnée n’est
            supprimée et les ventes continuent ; seuls les ajouts au-delà des limites sont bloqués.
          </span>
          {erreur('delai_grace_jours')}
        </div>
        <div className="adm-champ">
          <label htmlFor="mois-offerts">Remise sur le paiement à l’année</label>
          <div className="adm-champ-unite">
            <input id="mois-offerts" type="number" inputMode="numeric" min={0} max={11} value={valeur.mois_offerts_annuel}
              aria-invalid={!!erreurs.mois_offerts_annuel} onChange={(e) => changer('mois_offerts_annuel', Math.min(11, nombre(e.target.value)))} />
            <span>mois offerts</span>
          </div>
          <span className="adm-champ-aide">{texteRemise(payants, valeur.mois_offerts_annuel)}</span>
          {erreur('mois_offerts_annuel')}
        </div>
      </section>

      <section className="adm-carte" aria-labelledby="reglages-paiement">
        <h2 id="reglages-paiement" className="adm-h2">Où les commerçants paient</h2>
        {!valeur.numero_wave && !valeur.numero_orange && (
          <p className="adm-controle adm-controle--attention">
            <TriangleAlert size={18} aria-hidden="true" />
            <span>Aucun numéro renseigné : les commerçants ne peuvent pas encore payer leur plan depuis l’application.</span>
          </p>
        )}
        <div className="adm-formulaire-ligne">
          <div className="adm-champ">
            <label htmlFor="numero-wave" className="adm-champ-libelle-logo"><LogoMoyen moyen="wave" taille={24} />Numéro Wave</label>
            <input id="numero-wave" type="tel" inputMode="tel" autoComplete="off" value={valeur.numero_wave ?? ''} placeholder="Ex. : 77 000 00 00"
              aria-invalid={!!erreurs.numero_wave} onChange={(e) => changer('numero_wave', e.target.value || null)} />
            {erreur('numero_wave')}
          </div>
          <div className="adm-champ">
            <label htmlFor="numero-orange" className="adm-champ-libelle-logo"><LogoMoyen moyen="orange" taille={24} />Numéro Orange Money</label>
            <input id="numero-orange" type="tel" inputMode="tel" autoComplete="off" value={valeur.numero_orange ?? ''} placeholder="Ex. : 77 000 00 00"
              aria-invalid={!!erreurs.numero_orange} onChange={(e) => changer('numero_orange', e.target.value || null)} />
            {erreur('numero_orange')}
          </div>
        </div>
        <div className="adm-champ">
          <label htmlFor="beneficiaire">Nom du bénéficiaire</label>
          <input id="beneficiaire" value={valeur.nom_beneficiaire ?? ''} maxLength={120} autoComplete="off" placeholder="Le nom affiché par Wave et Orange Money"
            onChange={(e) => changer('nom_beneficiaire', e.target.value || null)} />
          <span className="adm-champ-aide">Tel qu’il s’affiche chez le commerçant au moment d’envoyer l’argent : il vérifie ainsi qu’il paie le bon compte.</span>
          {erreur('nom_beneficiaire')}
        </div>
        <div className="adm-champ">
          <label htmlFor="numero-contact">Numéro WhatsApp pour vous joindre</label>
          <input id="numero-contact" type="tel" inputMode="tel" autoComplete="off" value={valeur.numero_contact ?? ''} placeholder="Avec l’indicatif, ex. : +221 77 000 00 00"
            aria-invalid={!!erreurs.numero_contact} onChange={(e) => changer('numero_contact', e.target.value || null)} />
          <span className="adm-champ-aide">Les commerçants vous écrivent à ce numéro depuis Mon plan, pour le plan Entreprise ou une question.</span>
          {erreur('numero_contact')}
        </div>
        <div className="adm-interrupteur-ligne">
          <span>
            <strong>Référence de transaction obligatoire</strong>
            <span className="adm-champ-aide">Sans référence, la déclaration ne peut pas être envoyée.</span>
          </span>
          <Interrupteur actif={valeur.reference_obligatoire} libelle="Référence de transaction obligatoire" surChangement={(v) => changer('reference_obligatoire', v)} />
        </div>
        <div className="adm-interrupteur-ligne">
          <span>
            <strong>Capture du reçu</strong>
            <span className="adm-champ-aide">Le commerçant peut joindre une photo de son SMS de confirmation.</span>
          </span>
          <Interrupteur actif={valeur.capture_autorisee} libelle="Capture du reçu" surChangement={(v) => changer('capture_autorisee', v)} />
        </div>
      </section>

      <Rappels valeur={valeur} possibles={reglages.data.rappels_possibles} erreurs={erreurs} surChanger={changer} />

      <Securite doubleFacteur={doubleFacteur} surDoubleFacteur={surDoubleFacteur} />

      {modifie && (
        <div className="adm-barre-enregistrer" role="region" aria-label="Modifications non enregistrées">
          <span>Modifications non enregistrées</span>
          <div className="adm-actions">
            <button type="button" className="adm-bouton adm-bouton--contour" disabled={enregistrer.isPending} onClick={() => { definirBrouillon(null); definirErreurs({}) }}>Annuler</button>
            <button type="button" className="adm-bouton" disabled={enregistrer.isPending} onClick={() => brouillon && enregistrer.mutate(brouillon)}>
              {enregistrer.isPending ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** « Essentiel : 25 000 F par an au lieu de 30 000 F. Pro : 50 000 F au lieu de 60 000 F. » */
function texteRemise(payants: PlanPublic[], moisOfferts: number): string {
  const enLigne = payants.filter((p) => !p.sur_devis && p.prix_mensuel > 0)
  if (moisOfferts === 0) return 'Sans remise : l’année coûte douze mois.'
  if (enLigne.length === 0) return `${moisOfferts} mois offerts sur un paiement à l’année.`
  return enLigne.map((p, i) => `${p.nom} : ${fcfa(p.prix_mensuel * (12 - moisOfferts))}${i === 0 ? ' par an' : ''} au lieu de ${fcfa(p.prix_mensuel * 12)}.`).join(' ')
}

function Rappels({ valeur, possibles, erreurs, surChanger }: {
  valeur: Brouillon
  possibles: Record<string, string>
  erreurs: Record<string, string>
  surChanger: <C extends keyof Brouillon>(champ: C, v: Brouillon[C]) => void
}) {
  const zone = useRef<HTMLTextAreaElement>(null)
  const actifs = valeur.rappels ?? []
  const message = valeur.message_relance ?? ''
  const basculer = (cle: string, coche: boolean) => surChanger('rappels', coche ? [...actifs, cle] : actifs.filter((r) => r !== cle))
  const inserer = (jeton: string) => {
    const element = zone.current
    const debut = element?.selectionStart ?? message.length
    const fin = element?.selectionEnd ?? message.length
    surChanger('message_relance', message.slice(0, debut) + jeton + message.slice(fin))
    requestAnimationFrame(() => {
      element?.focus()
      element?.setSelectionRange(debut + jeton.length, debut + jeton.length)
    })
  }
  const apercu = (message || MESSAGE_PAR_DEFAUT).replace(/\{(prénom|nom|plan|date|montant)\}/g, (j) => EXEMPLE[j] ?? j)

  return (
    <section className="adm-carte" aria-labelledby="reglages-rappels">
      <h2 id="reglages-rappels" className="adm-h2">Rappels d’échéance</h2>
      <fieldset className="adm-groupe">
        <legend>Prévenir le commerçant</legend>
        <div className="adm-cases">
          {Object.entries(possibles).map(([cle, libelle]) => (
            <label key={cle}><input type="checkbox" checked={actifs.includes(cle)} onChange={(e) => basculer(cle, e.target.checked)} />{libelle}</label>
          ))}
        </div>
      </fieldset>
      <span className="adm-champ-aide">
        Par e-mail, les rappels partent tout seuls. Par WhatsApp, le message est préparé : vous l’envoyez en un clic depuis la fiche du commerçant.
      </span>
      <div className="adm-champ">
        <label htmlFor="message-relance">Message WhatsApp</label>
        <textarea id="message-relance" ref={zone} maxLength={600} value={message} placeholder={MESSAGE_PAR_DEFAUT}
          aria-invalid={!!erreurs.message_relance} aria-describedby="jetons-relance apercu-relance"
          onChange={(e) => surChanger('message_relance', e.target.value || null)} />
        <span id="jetons-relance" className="adm-jetons">
          Champs remplis automatiquement :
          {JETONS.map((j) => <button key={j} type="button" onClick={() => inserer(j)} aria-label={`Insérer ${j}`}>{j}</button>)}
        </span>
        <p id="apercu-relance" className="adm-apercu"><strong>Aperçu</strong>{apercu}</p>
        {erreurs.message_relance && <span className="adm-champ-erreur" role="alert">{erreurs.message_relance}</span>}
      </div>
    </section>
  )
}

function Securite({ doubleFacteur, surDoubleFacteur }: { doubleFacteur: boolean; surDoubleFacteur: (actif: boolean) => void }) {
  const client = useQueryClient()
  const [bascule, definirBascule] = useState(false)
  const appareils = useQuery({ queryKey: CLES_ADMIN.appareils, queryFn: Appareils.lister })
  const deconnecter = useMutation({
    mutationFn: Appareils.deconnecterAutres,
    onSuccess: (r) => { bulle(r.message); client.invalidateQueries({ queryKey: CLES_ADMIN.appareils }) },
    onError: (e) => bulle(messageErreur(e), 'erreur'),
  })
  const autres = (appareils.data ?? LISTE_VIDE).filter((a) => !a.actuel).length

  const basculerDoubleFacteur = async () => {
    definirBascule(true)
    try { surDoubleFacteur(await basculerVerificationDeuxEtapes(doubleFacteur)) } finally { definirBascule(false) }
  }
  const confirmerDeconnexion = async () => {
    if (await demanderConfirmation(`Déconnecter ${autres > 1 ? `les ${autres} autres appareils` : 'l’autre appareil'} ? Il faudra s’y reconnecter avec le mot de passe.`, 'Déconnecter')) deconnecter.mutate()
  }

  return (
    <section className="adm-carte" aria-labelledby="reglages-securite">
      <h2 id="reglages-securite" className="adm-h2">Sécurité du compte administrateur</h2>
      <div className="adm-interrupteur-ligne adm-interrupteur-ligne--premier">
        <span>
          <strong>Vérification en 2 étapes</strong>
          <span className="adm-champ-aide">À chaque connexion, un code est envoyé à l’adresse e-mail de l’administrateur.</span>
        </span>
        <Interrupteur actif={doubleFacteur} desactive={bascule} libelle="Vérification en 2 étapes" surChangement={basculerDoubleFacteur} />
      </div>
      <div className="adm-pile">
        <h3 className="adm-h3">Appareils connectés</h3>
        {appareils.isPending ? (
          <Squelette hauteur={120} />
        ) : appareils.isError ? (
          <ErreurVue erreur={appareils.error} surReessai={() => appareils.refetch()} compacte />
        ) : (
          <ul className="adm-petite-liste adm-petite-liste--encadree">
            {appareils.data.map((a) => (
              <li key={a.id}>
                <span className="adm-rond adm-rond--sortie" aria-hidden="true">{a.type === 'telephone' ? <Smartphone size={16} /> : <Monitor size={16} />}</span>
                <span className="adm-ligne-texte">
                  <span className="adm-ligne-titre">{a.type === 'telephone' ? 'Téléphone' : a.type === 'ordinateur' ? 'Ordinateur' : 'Appareil'}</span>
                  <span className="adm-ligne-sous">
                    {a.actuel ? 'Actif maintenant' : a.derniere_utilisation ? `Actif ${depuis(a.derniere_utilisation)}` : `Connecté ${depuis(a.connecte_le)}`}
                  </span>
                </span>
                {a.actuel && <Pastille ton="violet">Cet appareil</Pastille>}
              </li>
            ))}
          </ul>
        )}
        <div className="adm-actions">
          <button type="button" className="adm-bouton adm-bouton--danger" disabled={autres === 0 || deconnecter.isPending} onClick={confirmerDeconnexion}>
            <LogOut size={18} aria-hidden="true" />Déconnecter les autres appareils
          </button>
        </div>
      </div>
    </section>
  )
}
