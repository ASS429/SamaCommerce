/* Finances : l'argent des abonnements, compte par compte, et ses mouvements
 * du mois. Chaque entrée vient d'un paiement validé ; un retrait ou un
 * transfert ne peut pas dépasser le solde du compte (l'API le refuse). */

import { useState, type FormEvent } from 'react'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronLeft, ChevronRight, Download, Landmark, Wallet } from 'lucide-react'
import { Admin, fcfa, type CompteFinances, type Finances, type MouvementFinances } from '../../outils/api'
import { bulle } from '../../outils/bulles'
import { exporterClasseur } from '../../outils/xlsx'
import { ChargementVue, EnTeteVue, ErreurVue, LogoMoyen, Vide } from './communs'
import { aller, CLES_ADMIN, deMois, jourCourt, majuscule, messageErreur, moisLong, useRafraichirAdmin } from './outilsAdmin'

type Filtre = 'tous' | 'entrees' | 'sorties'
type Compte = CompteFinances['moyen']
const LIBELLES_COMPTES: Record<string, string> = { wave: 'Wave', orange: 'Orange Money', especes: 'Espèces' }

const moisDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
function decaler(mois: string, pas: number): string {
  const [a, m] = mois.split('-').map(Number)
  return moisDe(new Date(a, m - 1 + pas, 1))
}

/** « +5 000 F », « −20 000 F » ; un transfert reste entre vos comptes, sans signe. */
function montantSigne(m: MouvementFinances): string {
  if (m.type === 'transfert') return fcfa(m.montant)
  return `${m.montant < 0 ? '−' : '+'}${fcfa(Math.abs(m.montant))}`
}

export default function VueFinances({ params }: { params: URLSearchParams }) {
  const actuel = moisDe(new Date())
  const demande = params.get('mois') ?? ''
  const mois = /^\d{4}-\d{2}$/.test(demande) && demande <= actuel ? demande : actuel
  const finances = useQuery({ queryKey: CLES_ADMIN.finances(mois), queryFn: () => Admin.finances(mois), placeholderData: keepPreviousData })
  const [formulaire, definirFormulaire] = useState<'retrait' | 'transfert' | null>(null)
  const [filtre, definirFiltre] = useState<Filtre>('tous')

  if (finances.isPending) return <ChargementVue blocs={[150, 360]} />
  // Une relecture qui échoue garde les chiffres déjà affichés.
  const f = finances.data
  if (!f) {
    return <div className="adm-contenu"><EnTeteVue titre="Finances" /><ErreurVue erreur={finances.error} surReessai={() => finances.refetch()} /></div>
  }

  const courant = mois === actuel
  const nomMois = moisLong(mois, false)
  const changerMois = (pas: number) => { const cible = decaler(mois, pas); aller('finances', { mois: cible === actuel ? null : cible }, true) }
  const basculer = (cible: 'retrait' | 'transfert') => definirFormulaire(formulaire === cible ? null : cible)

  const mouvements = f.mouvements.filter((m) => filtre === 'tous' || (filtre === 'entrees' ? m.type === 'entree' : m.type !== 'entree'))
  const exporter = () => exporterClasseur(`finances-samacommerce-${f.mois}`, {
    onglet: 'Finances',
    titre: `Abonnements, ${moisLong(f.mois)}`,
    sousTitre: `Édité le ${new Date().toLocaleDateString('fr-FR')}`,
    colonnes: [
      { entete: 'Date', largeur: 12 }, { entete: 'Mouvement', largeur: 34 }, { entete: 'Détail', largeur: 38 },
      { entete: 'Compte', largeur: 16 }, { entete: 'Montant', largeur: 14, type: 'montant' },
    ],
    lignes: f.mouvements.map((m) => [m.date.slice(0, 10), m.libelle, m.detail, LIBELLES_COMPTES[m.compte] ?? m.compte, m.type === 'transfert' ? 0 : m.montant]),
    totaux: ['TOTAL', '', '', '', f.mouvements.reduce((s, m) => s + (m.type === 'transfert' ? 0 : m.montant), 0)],
  })

  return (
    <div className="adm-contenu">
      <EnTeteVue
        titre="Finances"
        soustitre="L’argent des abonnements, compte par compte. Chaque entrée vient d’un paiement que vous avez validé."
        actions={
          <>
            <button type="button" className="adm-bouton adm-bouton--contour" aria-expanded={formulaire === 'transfert'} onClick={() => basculer('transfert')}>
              <ArrowLeftRight size={18} aria-hidden="true" />Transférer entre comptes
            </button>
            <button type="button" className="adm-bouton" aria-expanded={formulaire === 'retrait'} onClick={() => basculer('retrait')}>
              <Landmark size={18} aria-hidden="true" />Enregistrer un retrait
            </button>
          </>
        }
      />

      {formulaire === 'retrait' && <FormulaireRetrait comptes={f.comptes} surFini={() => definirFormulaire(null)} />}
      {formulaire === 'transfert' && <FormulaireTransfert comptes={f.comptes} surFini={() => definirFormulaire(null)} />}

      <section className="adm-comptes" aria-label="Comptes">
        <div className="adm-compte-carte adm-compte-carte--total">
          <span className="adm-legende">Disponible au total</span>
          <span className="adm-compte-solde">{fcfa(f.total)}</span>
          <span className="adm-legende">En {nomMois} : {fcfa(f.encaisse_mois)} encaissés, {fcfa(f.retire_mois)} retirés</span>
        </div>
        {f.comptes.map((c) => (
          <div key={c.moyen} className="adm-compte-carte">
            <span className="adm-compte-entete"><LogoMoyen moyen={c.moyen} taille={32} />{c.libelle}</span>
            <span className="adm-compte-solde">{fcfa(c.solde)}</span>
            <span className="adm-compte-flux">
              <span>+{fcfa(c.entrees_mois)} {courant ? 'ce mois' : `en ${nomMois}`}</span>
              <span>{c.sorties_mois > 0 ? `−${fcfa(c.sorties_mois)} retirés` : 'Aucun retrait'}</span>
            </span>
          </div>
        ))}
      </section>

      <section className="adm-carte" aria-labelledby="titre-mouvements">
        <div className="adm-carte-entete">
          <h2 id="titre-mouvements" className="adm-h2">Mouvements {deMois(mois)}</h2>
          <div className="adm-mois">
            <button type="button" className="adm-bouton adm-bouton--contour" onClick={() => changerMois(-1)} aria-label="Mois précédent">
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <span aria-live="polite">{majuscule(moisLong(mois))}</span>
            <button type="button" className="adm-bouton adm-bouton--contour" onClick={() => changerMois(1)} disabled={courant} aria-label="Mois suivant">
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="adm-rangee adm-rangee--entre">
          <div className="adm-segments" role="group" aria-label="Type de mouvement">
            {([['tous', 'Tous'], ['entrees', 'Entrées'], ['sorties', 'Sorties']] as [Filtre, string][]).map(([id, libelle]) => (
              <button key={id} type="button" aria-pressed={filtre === id} onClick={() => definirFiltre(id)}>{libelle}</button>
            ))}
          </div>
          <button type="button" className="adm-bouton adm-bouton--contour" onClick={exporter} disabled={f.mouvements.length === 0}>
            <Download size={18} aria-hidden="true" />Exporter
          </button>
        </div>
        {mouvements.length === 0 ? (
          <Vide icone={<Wallet size={28} aria-hidden="true" />} titre={`Aucun mouvement en ${nomMois}`}
            texte={filtre === 'tous' ? 'Les paiements validés, retraits et transferts du mois apparaîtront ici.' : 'Changez de filtre pour voir les autres mouvements.'} />
        ) : (
          <ul className="adm-mouvements" aria-busy={finances.isFetching}>
            {mouvements.map((m, i) => (
              <li key={`${m.date}-${i}`} className="adm-mouvement">
                <span className="adm-mouvement-date">{jourCourt(m.date)}</span>
                <span className="adm-mouvement-libelle">
                  <span className={`adm-rond adm-rond--${m.type === 'entree' ? 'entree' : 'sortie'}`} aria-hidden="true">
                    {m.type === 'entree' ? <ArrowDownLeft size={16} /> : m.type === 'retrait' ? <ArrowUpRight size={16} /> : <ArrowLeftRight size={16} />}
                  </span>
                  <span><strong>{m.libelle}</strong><small>{m.detail}</small></span>
                </span>
                <span className="adm-mouvement-compte">{LIBELLES_COMPTES[m.compte] ?? m.compte}</span>
                <span className={`adm-mouvement-montant${m.type === 'entree' ? ' adm-mouvement-montant--plus' : ''}`}>{montantSigne(m)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

const compteLePlusGarni = (comptes: CompteFinances[]): Compte => [...comptes].sort((a, b) => b.solde - a.solde)[0]?.moyen ?? 'wave'

function FormulaireRetrait({ comptes, surFini }: { comptes: Finances['comptes']; surFini: () => void }) {
  const rafraichir = useRafraichirAdmin()
  const [compte, definirCompte] = useState<Compte>(() => compteLePlusGarni(comptes))
  const [montant, definirMontant] = useState('')
  const [erreur, definirErreur] = useState('')
  const solde = comptes.find((c) => c.moyen === compte)?.solde ?? 0
  const n = Number(montant)
  const tropGros = montant !== '' && n > solde
  const valide = Number.isInteger(n) && n >= 1 && !tropGros

  const retirer = useMutation({
    mutationFn: () => Admin.retirer(n, compte),
    onSuccess: () => { bulle(`Retrait de ${fcfa(n)} enregistré.`); rafraichir(); surFini() },
    onError: (e) => definirErreur(messageErreur(e)),
  })
  const envoyer = (e: FormEvent) => { e.preventDefault(); if (valide) retirer.mutate() }

  return (
    <form className="adm-formulaire" onSubmit={envoyer} aria-labelledby="titre-retrait">
      <h2 id="titre-retrait" className="adm-h2">Enregistrer un retrait</h2>
      <div className="adm-formulaire-ligne">
        <div className="adm-champ">
          <label htmlFor="retrait-compte">Compte</label>
          <select id="retrait-compte" value={compte} onChange={(e) => { definirCompte(e.target.value as Compte); definirErreur('') }}>
            {comptes.map((c) => <option key={c.moyen} value={c.moyen}>{c.libelle} ({fcfa(c.solde)})</option>)}
          </select>
        </div>
        <div className="adm-champ">
          <label htmlFor="retrait-montant">Montant (F)</label>
          <input id="retrait-montant" type="number" inputMode="numeric" min={1} max={solde} value={montant} aria-invalid={tropGros}
            aria-describedby="retrait-aide" onChange={(e) => { definirMontant(e.target.value); definirErreur('') }} />
          {tropGros && <span className="adm-champ-erreur" role="alert">Le compte {LIBELLES_COMPTES[compte]} n’a que {fcfa(solde)}.</span>}
        </div>
      </div>
      <span id="retrait-aide" className="adm-champ-aide">Notez ici l’argent que vous sortez du compte : le solde affiché reste juste.</span>
      {erreur && <span className="adm-champ-erreur" role="alert">{erreur}</span>}
      <div className="adm-actions">
        <button type="submit" className="adm-bouton" disabled={!valide || retirer.isPending}>{retirer.isPending ? 'Enregistrement…' : 'Enregistrer le retrait'}</button>
        <button type="button" className="adm-bouton adm-bouton--contour" onClick={surFini}>Annuler</button>
      </div>
    </form>
  )
}

function FormulaireTransfert({ comptes, surFini }: { comptes: Finances['comptes']; surFini: () => void }) {
  const rafraichir = useRafraichirAdmin()
  const [source, definirSource] = useState<Compte>(() => compteLePlusGarni(comptes))
  const [destination, definirDestination] = useState<Compte>(() => comptes.find((c) => c.moyen !== compteLePlusGarni(comptes))?.moyen ?? 'especes')
  const [montant, definirMontant] = useState('')
  const [erreur, definirErreur] = useState('')
  const solde = comptes.find((c) => c.moyen === source)?.solde ?? 0
  const n = Number(montant)
  const tropGros = montant !== '' && n > solde
  const valide = source !== destination && Number.isInteger(n) && n >= 1 && !tropGros

  const transferer = useMutation({
    mutationFn: () => Admin.transferer(source, destination, n),
    onSuccess: () => { bulle(`Transfert de ${fcfa(n)} enregistré.`); rafraichir(); surFini() },
    onError: (e) => definirErreur(messageErreur(e)),
  })
  const envoyer = (e: FormEvent) => { e.preventDefault(); if (valide) transferer.mutate() }
  const changerSource = (cible: Compte) => {
    definirSource(cible)
    if (cible === destination) definirDestination(comptes.find((c) => c.moyen !== cible)?.moyen ?? destination)
    definirErreur('')
  }

  return (
    <form className="adm-formulaire" onSubmit={envoyer} aria-labelledby="titre-transfert">
      <h2 id="titre-transfert" className="adm-h2">Transférer entre comptes</h2>
      <div className="adm-formulaire-ligne">
        <div className="adm-champ">
          <label htmlFor="transfert-source">Depuis</label>
          <select id="transfert-source" value={source} onChange={(e) => changerSource(e.target.value as Compte)}>
            {comptes.map((c) => <option key={c.moyen} value={c.moyen}>{c.libelle} ({fcfa(c.solde)})</option>)}
          </select>
        </div>
        <div className="adm-champ">
          <label htmlFor="transfert-destination">Vers</label>
          <select id="transfert-destination" value={destination} onChange={(e) => definirDestination(e.target.value as Compte)}>
            {comptes.filter((c) => c.moyen !== source).map((c) => <option key={c.moyen} value={c.moyen}>{c.libelle}</option>)}
          </select>
        </div>
        <div className="adm-champ">
          <label htmlFor="transfert-montant">Montant (F)</label>
          <input id="transfert-montant" type="number" inputMode="numeric" min={1} max={solde} value={montant} aria-invalid={tropGros}
            onChange={(e) => { definirMontant(e.target.value); definirErreur('') }} />
          {tropGros && <span className="adm-champ-erreur" role="alert">Le compte {LIBELLES_COMPTES[source]} n’a que {fcfa(solde)}.</span>}
        </div>
      </div>
      <span className="adm-champ-aide">Par exemple, des espèces déposées sur votre compte Wave. Le total ne change pas.</span>
      {erreur && <span className="adm-champ-erreur" role="alert">{erreur}</span>}
      <div className="adm-actions">
        <button type="submit" className="adm-bouton" disabled={!valide || transferer.isPending}>{transferer.isPending ? 'Enregistrement…' : 'Transférer'}</button>
        <button type="button" className="adm-bouton adm-bouton--contour" onClick={surFini}>Annuler</button>
      </div>
    </form>
  )
}
