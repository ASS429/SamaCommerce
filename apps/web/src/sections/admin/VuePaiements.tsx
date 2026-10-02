/* Paiements à vérifier : la file des déclarations, et pour chacune ce qu'il
 * faut comparer avec l'historique Wave ou Orange Money avant de valider.
 *
 * Valider exige la case « J'ai retrouvé ce paiement » (l'API la refuse
 * sinon). Chaque décision s'annule tant qu'on n'est pas passé à la suite. */

import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, CircleCheck, CircleX, ImageIcon, Info, MessageCircle, Sparkles, TriangleAlert, Undo2 } from 'lucide-react'
import { Admin, fcfa, type PaiementAdmin } from '../../outils/api'
import { dateLongue, quand } from '../../outils/abonnement'
import { bulle } from '../../outils/bulles'
import { LISTE_VIDE } from '../../outils/requetes'
import { EnTeteVue, ErreurVue, LogoMoyen, Pastille, Squelette, Vide } from './communs'
import { aller, CLES_ADMIN, depuis, initiale, jourCourt, messageErreur, nomCommercant, texteEcart, useEcranLarge, useRafraichirAdmin } from './outilsAdmin'

type Onglet = 'en_attente' | 'valide' | 'refuse'
const ONGLETS: { id: Onglet; libelle: string }[] = [
  { id: 'en_attente', libelle: 'À vérifier' },
  { id: 'valide', libelle: 'Validés' },
  { id: 'refuse', libelle: 'Refusés' },
]
const MOTIFS = ['Paiement introuvable', 'Montant incorrect', 'Référence déjà utilisée', 'Autre motif']

export default function VuePaiements({ params }: { params: URLSearchParams }) {
  const brut = params.get('onglet')
  const onglet: Onglet = brut === 'valide' || brut === 'refuse' ? brut : 'en_attente'
  const idChoisi = Number(params.get('id')) || null
  const large = useEcranLarge()

  const liste = useQuery({ queryKey: CLES_ADMIN.paiements(onglet), queryFn: () => Admin.paiements(onglet) })
  const file = useQuery({ queryKey: CLES_ADMIN.paiements('en_attente'), queryFn: () => Admin.paiements('en_attente') })
  const paiements = liste.data?.paiements ?? LISTE_VIDE
  const enAttente = file.data?.paiements ?? LISTE_VIDE
  const nbAttente = file.data?.compteurs.en_attente ?? 0

  // La décision qu'on vient de prendre reste affichée (pour l'annuler) même
  // quand le paiement a quitté la file.
  const [decision, definirDecision] = useState<PaiementAdmin | null>(null)
  const dansLaListe = paiements.find((p) => p.id === idChoisi)
  const decisionCourante = decision && decision.id === idChoisi ? decision : null
  const seul = useQuery({
    queryKey: CLES_ADMIN.paiement(idChoisi ?? 0),
    queryFn: () => Admin.paiement(idChoisi as number),
    enabled: !!idChoisi && !dansLaListe && !decisionCourante && liste.isSuccess,
  })
  const choisi = decisionCourante ?? dansLaListe ?? seul.data ?? null

  // Sur ordinateur, la file s'ouvre sur le paiement le plus ancien.
  useEffect(() => {
    if (large && !idChoisi && onglet === 'en_attente' && paiements.length > 0) aller('paiements', { id: paiements[0].id }, true)
  }, [large, idChoisi, onglet, paiements])

  const changerOnglet = (cible: Onglet) => { definirDecision(null); aller('paiements', { onglet: cible === 'en_attente' ? null : cible }, true) }
  const ouvrir = (id: number) => aller('paiements', { onglet: onglet === 'en_attente' ? null : onglet, id })
  const fermer = () => aller('paiements', { onglet: onglet === 'en_attente' ? null : onglet }, true)
  const suivant = choisi ? enAttente.find((p) => p.id !== choisi.id) ?? null : null
  const allerAuSuivant = suivant ? () => { definirDecision(null); aller('paiements', { id: suivant.id }) } : null

  return (
    <div className="adm-contenu">
      <EnTeteVue
        titre="Paiements à vérifier"
        soustitre="Comparez chaque déclaration avec l’historique de votre compte Wave ou Orange Money. Le plan ne s’active qu’après votre validation."
      />

      <div className="adm-segments" role="group" aria-label="Statut des paiements">
        {ONGLETS.map((o) => (
          <button key={o.id} type="button" aria-pressed={onglet === o.id} onClick={() => changerOnglet(o.id)}>
            {o.libelle}
            {o.id === 'en_attente' && nbAttente > 0 && <span className="adm-segments-compte">{nbAttente}</span>}
          </button>
        ))}
      </div>

      {liste.isPending ? (
        <div className="adm-maitre-detail" aria-busy="true">
          <div className="adm-maitre">{[0, 1, 2].map((i) => <Squelette key={i} hauteur={92} />)}</div>
          {large && <div className="adm-detail"><Squelette hauteur={520} /></div>}
        </div>
      ) : liste.isError ? (
        <ErreurVue erreur={liste.error} surReessai={() => liste.refetch()} />
      ) : paiements.length === 0 && !choisi ? (
        onglet === 'en_attente'
          ? <Vide ton="ok" icone={<CircleCheck size={32} aria-hidden="true" />} titre="Tout est vérifié" texte="Les prochaines déclarations arriveront ici." />
          : <Vide icone={<Info size={28} aria-hidden="true" />} titre={onglet === 'valide' ? 'Aucun paiement validé' : 'Aucun paiement refusé'} texte={onglet === 'valide' ? 'Les paiements que vous validez apparaîtront ici, avec leur reçu.' : 'Les refus et leur motif apparaîtront ici.'} />
      ) : (
        <div className="adm-maitre-detail">
          <ul className="adm-maitre" aria-label="Paiements">
            {paiements.length === 0 && (
              <li><Vide ton="ok" icone={<CircleCheck size={28} aria-hidden="true" />} titre="File vide" texte="Plus rien à vérifier pour l’instant." /></li>
            )}
            {paiements.map((p) => (
              <li key={p.id}><LignePaiement paiement={p} choisi={p.id === idChoisi} surOuvrir={() => ouvrir(p.id)} /></li>
            ))}
          </ul>
          <div className={`adm-detail${choisi ? ' adm-detail--ouvert' : ''}`}>
            {choisi ? (
              <VoletPaiement key={choisi.id} paiement={choisi} surDecision={definirDecision} surSuivant={allerAuSuivant} surFermer={fermer}
                surAnnule={(p) => { definirDecision(null); aller('paiements', { id: p.id }, true) }} />
            ) : idChoisi && seul.isPending ? (
              <Squelette hauteur={520} />
            ) : large ? (
              <Vide icone={<Info size={28} aria-hidden="true" />} titre="Choisissez un paiement" texte="Son détail et les contrôles s’affichent ici." />
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function LignePaiement({ paiement: p, choisi, surOuvrir }: { paiement: PaiementAdmin; choisi: boolean; surOuvrir: () => void }) {
  return (
    <button type="button" className="adm-ligne" aria-pressed={choisi} onClick={surOuvrir}>
      <span className="adm-ligne-haut">
        <LogoMoyen moyen={p.moyen} />
        <span className="adm-ligne-texte">
          <span className="adm-ligne-titre">{nomCommercant(p.commercant)}</span>
          <span className="adm-ligne-sous">{p.formule} · {p.moyen_libelle}</span>
        </span>
        <span className="adm-ligne-droite">
          <span className="adm-ligne-montant">{fcfa(p.montant_declare)}</span>
          <span className="adm-ligne-sous">
            {p.statut === 'en_attente' ? depuis(p.cree_le) : `${p.statut === 'valide' ? 'Validé' : 'Refusé'} le ${jourCourt(p.decide_le)}`}
          </span>
        </span>
      </span>
      {p.statut === 'en_attente' && (p.controles.ecart !== 0 || p.controles.reference_reutilisee) && (
        <span className="adm-ligne-bas">
          {p.controles.ecart !== 0 && <Pastille ton="attention">{texteEcart(p.controles.ecart)}</Pastille>}
          {p.controles.reference_reutilisee && <Pastille ton="danger">Référence déjà utilisée</Pastille>}
        </span>
      )}
      {p.statut === 'valide' && p.numero_recu && <span className="adm-ligne-bas"><Pastille ton="ok">Reçu {p.numero_recu}</Pastille></span>}
      {p.statut === 'refuse' && p.motif_refus && <span className="adm-ligne-bas"><Pastille ton="danger">{p.motif_refus}</Pastille></span>}
    </button>
  )
}

function VoletPaiement({ paiement: p, surDecision, surSuivant, surFermer, surAnnule }: {
  paiement: PaiementAdmin
  surDecision: (p: PaiementAdmin) => void
  surSuivant: (() => void) | null
  surFermer: () => void
  surAnnule: (p: PaiementAdmin) => void
}) {
  const rafraichir = useRafraichirAdmin()
  const [verifie, definirVerifie] = useState(false)
  const [refusOuvert, definirRefusOuvert] = useState(false)
  const [motif, definirMotif] = useState(() => p.controles.reference_reutilisee ? 'Référence déjà utilisée' : p.controles.ecart !== 0 ? 'Montant incorrect' : 'Paiement introuvable')
  const [precision, definirPrecision] = useState('')
  const [voirCapture, definirVoirCapture] = useState(false)
  const capture = useQuery({ queryKey: CLES_ADMIN.paiement(p.id), queryFn: () => Admin.paiement(p.id), enabled: voirCapture && p.a_capture })

  const signalerErreur = (e: unknown) => bulle(messageErreur(e), 'erreur', { duree: 6000 })
  const valider = useMutation({ mutationFn: () => Admin.valider(p.id), onSuccess: (r) => { surDecision(r.paiement); rafraichir() }, onError: signalerErreur })
  const refuser = useMutation({ mutationFn: (texte: string) => Admin.refuser(p.id, texte), onSuccess: (r) => { surDecision(r.paiement); rafraichir() }, onError: signalerErreur })
  const annuler = useMutation({
    mutationFn: () => Admin.annuler(p.id),
    onSuccess: (r) => { bulle(r.message, 'info'); rafraichir(); surAnnule(r.paiement) },
    onError: signalerErreur,
  })

  const nom = nomCommercant(p.commercant)
  const motifFinal = motif === 'Autre motif' ? precision.trim() : motif
  const occupe = valider.isPending || refuser.isPending || annuler.isPending

  return (
    <article className="adm-volet" aria-labelledby={`titre-paiement-${p.id}`}>
      <button type="button" className="adm-bouton adm-bouton--contour adm-volet-retour" onClick={surFermer}>
        <ArrowLeft size={18} aria-hidden="true" />Retour à la liste
      </button>

      <div className="adm-volet-entete">
        <div className="adm-volet-identite">
          <span className="adm-avatar adm-avatar--grand" aria-hidden="true">{initiale(nom)}</span>
          <div>
            <h2 id={`titre-paiement-${p.id}`} className="adm-volet-titre">{nom}</h2>
            <span className="adm-volet-sous">{p.commercant.identifiant} · inscrit {depuis(p.commercant.cree_le)}</span>
            <span className="adm-volet-sous">Plan actuel : {p.commercant.plan_actuel}</span>
          </div>
        </div>
        {p.commercant.lien_whatsapp && (
          <a className="adm-bouton adm-bouton--contour" href={p.commercant.lien_whatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={18} aria-hidden="true" />Écrire sur WhatsApp
          </a>
        )}
      </div>

      <dl className="adm-dl">
        <div><dt>Formule demandée</dt><dd>{p.formule}</dd></div>
        <div><dt>Montant attendu</dt><dd>{fcfa(p.montant_attendu)}</dd></div>
        <div><dt>Montant déclaré</dt><dd>{fcfa(p.montant_declare)}</dd></div>
        <div><dt>Payé avec</dt><dd>{p.moyen_libelle}{p.numero_payeur ? ` · ${p.numero_payeur}` : ''}</dd></div>
        {p.reference && <div><dt>Référence de transaction</dt><dd className="adm-reference">{p.reference}</dd></div>}
        <div><dt>Déclaré</dt><dd>{quand(p.cree_le)}</dd></div>
      </dl>

      {p.a_capture && (
        <div className="adm-capture">
          {!voirCapture ? (
            <button type="button" className="adm-lien" onClick={() => definirVoirCapture(true)}>
              <ImageIcon size={16} aria-hidden="true" />Voir la photo du SMS jointe
            </button>
          ) : capture.isPending ? (
            <Squelette hauteur={240} largeur={280} />
          ) : capture.data?.capture ? (
            <img src={capture.data.capture} alt={`Photo du SMS de confirmation jointe par ${nom}`} />
          ) : (
            <span className="adm-legende">La photo n’a pas pu être chargée.</span>
          )}
        </div>
      )}

      {p.statut === 'en_attente' && (
        <>
          <section className="adm-pile" aria-labelledby={`controles-${p.id}`}>
            <h3 id={`controles-${p.id}`} className="adm-h3">Contrôles automatiques</h3>
            <ul className="adm-controles">
              {p.controles.montant_conforme
                ? <Controle ton="ok">Le montant correspond au prix du plan.</Controle>
                : <Controle ton="attention">{texteEcart(p.controles.ecart)} : {fcfa(p.montant_declare)} déclarés pour {fcfa(p.montant_attendu)} attendus.</Controle>}
              {!p.reference
                ? <Controle ton="info">Aucune référence fournie : retrouvez le paiement par le montant et le numéro.</Controle>
                : p.controles.reference_reutilisee
                  ? <Controle ton="danger">Cette référence a déjà servi pour un autre paiement.</Controle>
                  : <Controle ton="ok">Cette référence n’a jamais été utilisée.</Controle>}
              {!p.commercant.telephone
                ? <Controle ton="info">Le compte n’a pas de numéro enregistré : vérifiez bien l’expéditeur.</Controle>
                : p.controles.numero_du_compte
                  ? <Controle ton="ok">Le paiement vient du numéro du compte.</Controle>
                  : <Controle ton="attention">Payé depuis un autre numéro que celui du compte : vérifiez bien l’expéditeur.</Controle>}
            </ul>
          </section>

          {p.effet && (
            <div className="adm-effet">
              <Sparkles size={20} aria-hidden="true" />
              <span>
                <strong>Si vous validez : {p.effet.texte}</strong>
                <span>{p.effet.explication}</span>
              </span>
            </div>
          )}

          {!refusOuvert ? (
            <>
              <label className="adm-case">
                <input type="checkbox" checked={verifie} onChange={(e) => definirVerifie(e.target.checked)} />
                <span>J’ai retrouvé ce paiement dans mon application {p.moyen_libelle} : même montant, même numéro, même heure.</span>
              </label>
              <div className="adm-actions adm-actions--etirees">
                <button type="button" className="adm-bouton adm-bouton--ok adm-bouton--large" disabled={!verifie || occupe} onClick={() => valider.mutate()}>
                  <CircleCheck size={18} aria-hidden="true" />{valider.isPending ? 'Validation…' : 'Valider et activer le plan'}
                </button>
                <button type="button" className="adm-bouton adm-bouton--danger adm-bouton--large" disabled={occupe} onClick={() => definirRefusOuvert(true)}>
                  <CircleX size={18} aria-hidden="true" />Refuser
                </button>
              </div>
              {!verifie && <p className="adm-champ-aide">Cochez la case après avoir vérifié : le bouton Valider s’activera.</p>}
            </>
          ) : (
            <fieldset className="adm-motifs">
              <legend>Motif du refus</legend>
              {MOTIFS.map((m) => (
                <label key={m}>
                  <input type="radio" name={`motif-${p.id}`} checked={motif === m} onChange={() => definirMotif(m)} />{m}
                </label>
              ))}
              {motif === 'Autre motif' && (
                <div className="adm-champ">
                  <label htmlFor={`precision-${p.id}`}>Motif à envoyer</label>
                  <input id={`precision-${p.id}`} value={precision} maxLength={120} onChange={(e) => definirPrecision(e.target.value)}
                    placeholder="Ex. : le SMS montre un autre bénéficiaire" autoFocus />
                </div>
              )}
              <span className="adm-champ-aide">Le commerçant voit ce motif et peut corriger sa déclaration.</span>
              <div className="adm-actions">
                <button type="button" className="adm-bouton adm-bouton--danger-plein" disabled={!motifFinal || occupe} onClick={() => refuser.mutate(motifFinal)}>
                  {refuser.isPending ? 'Envoi…' : 'Confirmer le refus'}
                </button>
                <button type="button" className="adm-bouton adm-bouton--contour" disabled={occupe} onClick={() => definirRefusOuvert(false)}>Annuler</button>
              </div>
            </fieldset>
          )}
        </>
      )}

      {p.statut === 'valide' && (
        <div className="adm-encadre adm-encadre--ok" role="status">
          <strong><CircleCheck size={20} aria-hidden="true" />Paiement validé</strong>
          <span>
            {p.plan_nom} actif {p.debut_le ? `du ${dateLongue(p.debut_le, false)} ` : ''}jusqu’au {dateLongue(p.fin_le)}.
            {p.numero_recu ? ` Reçu ${p.numero_recu}, visible par le commerçant dans Mon plan.` : ''}
          </span>
          <Suite surSuivant={surSuivant} occupe={occupe} libelleAnnuler="Annuler la validation" surAnnuler={p.origine === 'declaration' ? () => annuler.mutate() : null} />
        </div>
      )}

      {p.statut === 'refuse' && (
        <div className="adm-encadre adm-encadre--danger" role="status">
          <strong><CircleX size={20} aria-hidden="true" />Paiement refusé</strong>
          <span>Motif envoyé au commerçant : {p.motif_refus}. Son plan actuel ne change pas.</span>
          <Suite surSuivant={surSuivant} occupe={occupe} libelleAnnuler="Annuler le refus" surAnnuler={p.origine === 'declaration' ? () => annuler.mutate() : null} />
        </div>
      )}
    </article>
  )
}

function Controle({ ton, children }: { ton: 'ok' | 'attention' | 'danger' | 'info'; children: ReactNode }) {
  const Icone = ton === 'ok' ? CircleCheck : ton === 'info' ? Info : TriangleAlert
  return (
    <li className={`adm-controle adm-controle--${ton}`}>
      <Icone size={18} aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

/** Après une décision : passer au suivant, ou revenir dessus. Un geste de
 *  l'administrateur (espèces, jours offerts) ne s'annule pas d'ici. */
function Suite({ surSuivant, occupe, libelleAnnuler, surAnnuler }: { surSuivant: (() => void) | null; occupe: boolean; libelleAnnuler: string; surAnnuler: (() => void) | null }) {
  if (!surSuivant && !surAnnuler) return null
  return (
    <div className="adm-actions">
      {surSuivant && (
        <button type="button" className="adm-bouton" onClick={surSuivant}>
          Paiement suivant<ArrowRight size={18} aria-hidden="true" />
        </button>
      )}
      {surAnnuler && (
        <button type="button" className="adm-bouton adm-bouton--contour" disabled={occupe} onClick={surAnnuler}>
          <Undo2 size={18} aria-hidden="true" />{libelleAnnuler}
        </button>
      )}
    </div>
  )
}
