/* Tableau de bord : ce qui demande une action d'abord (paiements à vérifier,
 * échéances proches), puis l'argent, les comptes et la santé du système. */

import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CircleCheck, Search, Store, Wallet } from 'lucide-react'
import { Admin, fcfa, type TableauDeBordAdmin } from '../../outils/api'
import { quand } from '../../outils/abonnement'
import { ChargementVue, EnTeteVue, ErreurVue, LogoMoyen, Pastille, Vide } from './communs'
import { aller, CLES_ADMIN, depuis, initiale, majuscule, moisCourt, moisLong, montantCourt, pluriel, texteEcart, type Ton } from './outilsAdmin'

const ORDRE_PLANS = ['gratuit', 'essai', 'essentiel', 'pro', 'entreprise']

export default function VueTableauDeBord() {
  const tableau = useQuery({ queryKey: CLES_ADMIN.tableau, queryFn: Admin.tableauDeBord })
  // Les noms des plans se règlent dans « Plans et tarifs » : on les lit là.
  const plans = useQuery({ queryKey: CLES_ADMIN.plans, queryFn: Admin.plans })

  if (tableau.isPending) return <ChargementVue blocs={[132, 300, 240]} />
  if (tableau.isError) {
    return (
      <div className="adm-contenu">
        <EnTeteVue titre="Tableau de bord" />
        <ErreurVue erreur={tableau.error} surReessai={() => tableau.refetch()} />
      </div>
    )
  }

  const d = tableau.data
  const c = d.chiffres
  const moisCourant = d.revenus[d.revenus.length - 1]?.mois ?? new Date().toISOString().slice(0, 7)
  const nomPlan = (code: string) => plans.data?.plans.find((p) => p.code === code)?.nom ?? majuscule(code)

  return (
    <div className="adm-contenu">
      <EnTeteVue titre="Tableau de bord" soustitre={majuscule(moisLong(moisCourant))} actions={<RechercheGlobale />} />

      <section className="adm-chiffres" aria-label="Chiffres clés">
        <div className="adm-chiffre">
          <span className="adm-chiffre-libelle">Revenu mensuel récurrent</span>
          <span className="adm-chiffre-valeur">{fcfa(c.revenu_mensuel_recurrent)}</span>
          <span className="adm-chiffre-pied">{pluriel(c.abonnes_payants, 'abonné payant', 'abonnés payants')}</span>
        </div>
        <div className="adm-chiffre">
          <span className="adm-chiffre-libelle">Encaissé en {moisLong(moisCourant, false)}</span>
          <span className="adm-chiffre-valeur">{fcfa(c.encaisse_mois)}</span>
          <span className="adm-chiffre-pied">{pluriel(c.paiements_valides_mois, 'paiement validé', 'paiements validés')}</span>
        </div>
        {c.a_verifier > 0 ? (
          <button type="button" className="adm-chiffre adm-chiffre--action" onClick={() => aller('paiements')}>
            <span className="adm-chiffre-libelle">Paiements à vérifier</span>
            <span className="adm-chiffre-valeur">{c.a_verifier}</span>
            <span className="adm-chiffre-pied">Vérifier maintenant<ArrowRight size={16} aria-hidden="true" /></span>
          </button>
        ) : (
          <div className="adm-chiffre">
            <span className="adm-chiffre-libelle">Paiements à vérifier</span>
            <span className="adm-chiffre-valeur">0</span>
            <span className="adm-chiffre-pied adm-chiffre-pied--ok"><CircleCheck size={16} aria-hidden="true" />Rien en attente</span>
          </div>
        )}
        <button type="button" className="adm-chiffre" onClick={() => aller('commercants', { filtre: 'bientot' })}>
          <span className="adm-chiffre-libelle">Expirent sous 7 jours</span>
          <span className="adm-chiffre-valeur">{c.expirent_sous_7_jours}</span>
          {c.expirent_sous_7_jours > 0
            ? <span className="adm-chiffre-pied adm-chiffre-pied--attention">Voir et relancer<ArrowRight size={16} aria-hidden="true" /></span>
            : <span className="adm-chiffre-pied">Aucune échéance proche</span>}
        </button>
      </section>

      <div className="adm-tdb-haut">
        <Revenus revenus={d.revenus} />
        <APrioriser paiements={d.a_verifier} />
      </div>

      <div className="adm-grille-3">
        <section className="adm-carte" aria-labelledby="titre-repartition">
          <div className="adm-carte-entete">
            <h2 id="titre-repartition" className="adm-h2">Commerçants par plan</h2>
            <span className="adm-legende">{pluriel(c.commercants, 'compte', 'comptes')}</span>
          </div>
          <ul className="adm-repartition">
            {Object.entries(d.repartition)
              .sort(([a], [b]) => rang(a) - rang(b))
              .map(([code, nombre]) => (
                <li key={code}>
                  <span className="adm-repartition-ligne">
                    <span>{code === 'essai' ? 'En essai' : nomPlan(code)}</span>
                    <span>{nombre}</span>
                  </span>
                  <span className="adm-jauge" aria-hidden="true">
                    <span className={`adm-jauge--${code}`} style={{ width: `${c.commercants ? (nombre / c.commercants) * 100 : 0}%` }} />
                  </span>
                </li>
              ))}
          </ul>
          <p className="adm-legende">{texteConversion(d.conversion_essais)}</p>
        </section>

        <Sante sante={d.sante} />

        <section className="adm-carte" aria-labelledby="titre-inscriptions">
          <div className="adm-carte-entete">
            <h2 id="titre-inscriptions" className="adm-h2">Inscriptions récentes</h2>
            <button type="button" className="adm-lien" onClick={() => aller('commercants')}>Tout voir</button>
          </div>
          {d.inscriptions.length === 0 ? (
            <Vide icone={<Store size={28} aria-hidden="true" />} titre="Aucune inscription" texte="Les nouveaux commerçants apparaîtront ici." />
          ) : (
            <ul className="adm-petite-liste">
              {d.inscriptions.map((i) => (
                <li key={i.id}>
                  <button type="button" className="adm-petite-ligne adm-petite-ligne--nue" onClick={() => aller('commercants', { id: i.id })}>
                    <span className="adm-avatar" aria-hidden="true">{initiale(i.nom_commerce)}</span>
                    <span className="adm-ligne-texte">
                      <span className="adm-ligne-titre">{i.nom_commerce}</span>
                      <span className="adm-ligne-sous">{quand(i.cree_le)}</span>
                    </span>
                    <PastilleInscription inscription={i} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function PastilleInscription({ inscription: i }: { inscription: TableauDeBordAdmin['inscriptions'][number] }) {
  if (i.source === 'essai') return <Pastille ton="info">Essai · {i.essai_jours_restants ?? 0} j</Pastille>
  if (i.source === 'paye') return <Pastille ton="ok">{i.plan_nom}</Pastille>
  if (i.source === 'grace') return <Pastille ton="danger">Expiré</Pastille>
  return <Pastille ton="neutre">{i.plan_nom}</Pastille>
}

const rang = (code: string) => {
  const i = ORDRE_PLANS.indexOf(code)
  return i === -1 ? ORDRE_PLANS.length : i
}

function texteConversion(c: TableauDeBordAdmin['conversion_essais']): string {
  const mois = moisLong(c.mois, false)
  if (c.termines === 0) return `Aucun essai ne s’est terminé en ${mois}.`
  return `Essais terminés en ${mois} : ${c.convertis} sur ${c.termines} ${c.convertis > 1 ? 'sont passés' : 'est passé'} à un plan payant.`
}

/** La recherche mène à la liste des commerçants, déjà filtrée. */
function RechercheGlobale() {
  const [texte, definirTexte] = useState('')
  const envoyer = (e: FormEvent) => {
    e.preventDefault()
    if (texte.trim()) aller('commercants', { q: texte.trim() })
  }
  return (
    <form role="search" className="adm-recherche adm-recherche--entete" onSubmit={envoyer}>
      <Search size={18} aria-hidden="true" />
      <input type="search" value={texte} onChange={(e) => definirTexte(e.target.value)} placeholder="Commerçant, téléphone, référence…"
        aria-label="Rechercher un commerçant par nom, téléphone ou référence de paiement" enterKeyHint="search" />
    </form>
  )
}

function Revenus({ revenus }: { revenus: TableauDeBordAdmin['revenus'] }) {
  const max = Math.max(0, ...revenus.map((r) => r.total))
  const resume = revenus.map((r) => `${moisLong(r.mois, false)} ${fcfa(r.total)}`).join(', ')
  return (
    <section className="adm-carte" aria-labelledby="titre-revenus">
      <div className="adm-carte-entete">
        <h2 id="titre-revenus" className="adm-h2">Revenus encaissés</h2>
        <span className="adm-legende">6 derniers mois, paiements validés</span>
      </div>
      {max === 0 ? (
        <Vide icone={<Wallet size={28} aria-hidden="true" />} titre="Aucun paiement validé sur 6 mois" texte="Les revenus apparaîtront ici dès la première validation." />
      ) : (
        <div className="adm-barres" role="img" aria-label={`Revenus encaissés : ${resume}`}>
          {revenus.map((r, i) => (
            <div key={r.mois} className={`adm-barre${i === revenus.length - 1 ? ' adm-barre--courante' : ''}`}>
              <div className="adm-barre-zone">
                <span className="adm-barre-valeur">{r.total > 0 ? montantCourt(r.total) : ''}</span>
                <span className="adm-barre-trait" style={{ height: Math.max(4, Math.round((r.total / max) * 170)), animationDelay: `${i * 40}ms` }} />
              </div>
              <span className="adm-barre-mois">{moisCourt(r.mois)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function APrioriser({ paiements }: { paiements: TableauDeBordAdmin['a_verifier'] }) {
  return (
    <section className="adm-carte adm-tdb-priorite" aria-labelledby="titre-priorite">
      <div className="adm-carte-entete">
        <h2 id="titre-priorite" className="adm-h2">À vérifier en priorité</h2>
        <span className="adm-legende">Plus anciens d’abord</span>
      </div>
      {paiements.length === 0 ? (
        <Vide ton="ok" icone={<CircleCheck size={28} aria-hidden="true" />} titre="Tout est vérifié" texte="Les prochaines déclarations arriveront ici." />
      ) : (
        <>
          <ul className="adm-petite-liste">
            {paiements.slice(0, 4).map((p) => (
              <li key={p.id}>
                <button type="button" className="adm-petite-ligne" onClick={() => aller('paiements', { id: p.id })}>
                  <LogoMoyen moyen={p.moyen} taille={36} />
                  <span className="adm-ligne-texte">
                    <span className="adm-ligne-titre">{p.commerce}</span>
                    <span className="adm-ligne-sous">
                      {p.ecart !== 0 ? <span className="adm-texte-attention">{texteEcart(p.ecart)}</span> : p.formule}
                      {' · '}{depuis(p.cree_le)}
                    </span>
                  </span>
                  <span className="adm-ligne-montant">{fcfa(p.montant_declare)}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="adm-bouton adm-bouton--doux" onClick={() => aller('paiements')}>
            Ouvrir la file de vérification
          </button>
        </>
      )}
    </section>
  )
}

function Sante({ sante }: { sante: TableauDeBordAdmin['sante'] }) {
  // Le réveil passe toutes les 10 minutes : au-delà de 20, il s'est arrêté.
  const reveilRecent = !!sante.reveil.dernier && Date.now() - new Date(sante.reveil.dernier).getTime() < 20 * 60_000
  const latence = sante.api.latence_ms < 1 ? 'moins de 1 ms'
    : sante.api.latence_ms < 1000 ? `${sante.api.latence_ms} ms`
      : `${(sante.api.latence_ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`
  const sauvegarde = sante.sauvegarde
  const lignes: { nom: string; detail: string; ton: Ton; etat: string }[] = [
    sante.api.ok
      ? { nom: 'API et base de données', detail: `Répond en ${latence}`, ton: 'ok', etat: 'En ligne' }
      : { nom: 'API et base de données', detail: 'La base de données ne répond pas', ton: 'danger', etat: 'En panne' },
    { nom: 'Service IA', detail: 'Réapprovisionnement et score de crédit', ton: sante.ia.ok ? 'ok' : 'attention', etat: sante.ia.ok ? 'En ligne' : 'Hors ligne' },
    sauvegarde === null
      ? { nom: 'Sauvegarde de nuit', detail: 'Suivie sur le serveur en ligne seulement', ton: 'neutre', etat: 'Inconnue' }
      : sauvegarde.ok
        ? { nom: 'Sauvegarde de nuit', detail: `Réussie ${quand(sauvegarde.le).toLowerCase()}, chiffrée`, ton: 'ok', etat: 'Réussie' }
        : { nom: 'Sauvegarde de nuit', detail: `Dernière exécution : ${sauvegarde.etat}`, ton: 'danger', etat: 'Échec' },
    { nom: 'Réveil automatique', detail: sante.reveil.dernier ? `Dernier passage ${depuis(sante.reveil.dernier)}` : 'Aucun passage enregistré', ton: reveilRecent ? 'ok' : 'attention', etat: reveilRecent ? 'Actif' : 'Silencieux' },
  ]
  return (
    <section className="adm-carte" aria-labelledby="titre-sante">
      <h2 id="titre-sante" className="adm-h2">Santé du système</h2>
      <ul className="adm-sante">
        {lignes.map((l) => (
          <li key={l.nom}>
            <span className={`adm-sante-point adm-sante-point--${l.ton}`} aria-hidden="true" />
            <span className="adm-sante-texte"><strong>{l.nom}</strong>{l.detail}</span>
            <Pastille ton={l.ton}>{l.etat}</Pastille>
          </li>
        ))}
      </ul>
    </section>
  )
}
