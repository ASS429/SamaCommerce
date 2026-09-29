import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend } from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { Ventes, Statistiques, identiteBoutique, fcfa, type Vente } from '../outils/api'
import { exporterPdf, montant } from '../outils/pdf'
import { exporterClasseur } from '../outils/xlsx'
import { iconeProduit } from '../outils/iconeProduit'
import { libellePaiement } from '../outils/paiements'
import ErreurChargement from '../composants/ErreurChargement'
import { useErreurChargement } from '../outils/erreursChargement'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend)

/** Couleurs de l'anneau des paiements, reprises telles quelles par la légende. */
const COULEURS_PAIEMENT = ['#10B981', '#3B82F6', '#F59E0B', '#A855F7', '#EC4899']

type Periode = 'jour' | 'semaine' | 'mois' | 'tout'

/** Libellés courts de l'interrupteur segmenté (quatre cases sur 320 px). */
const PERIODE_COURT: Record<Periode, string> = { jour: 'Jour', semaine: 'Semaine', mois: 'Mois', tout: 'Tout' }

export default function Rapports() {
  const [ventes, definirVentes] = useState<Vente[]>([])
  const [parJour, definirParJour] = useState<any[]>([])
  const [paiements, definirPaiements] = useState<any[]>([])
  const [meilleurs, definirMeilleurs] = useState<any[]>([])
  const [marge, definirMarge] = useState<any[]>([])
  const [rotation, definirRotation] = useState<any[]>([])
  const [clients, definirClients] = useState<any[]>([])
  const [marchandage, definirMarchandage] = useState<any>(null)
  const [periode, definirPeriode] = useState<Periode>('tout')
  const [chargement, definirChargement] = useState(true)
  const { erreur, surveiller, effacer } = useErreurChargement()
  const [historique, definirHistorique] = useState<Vente[]>([])
  const [pageHistorique, definirPageHistorique] = useState(0)
  const [dernierePage, definirDernierePage] = useState(1)
  const [chargementHistorique, definirChargementHistorique] = useState(false)
  const sentinelle = useRef<HTMLDivElement>(null)

  const chargerSuite = useCallback(async () => {
    if (chargementHistorique) return
    const suivante = pageHistorique + 1
    if (pageHistorique > 0 && suivante > dernierePage) return
    definirChargementHistorique(true)
    try { const p = await Ventes.page(suivante, 15); definirHistorique((h) => [...h, ...p.data]); definirPageHistorique(p.current_page); definirDernierePage(p.last_page) }
    finally { definirChargementHistorique(false) }
  }, [chargementHistorique, pageHistorique, dernierePage])

  useEffect(() => { chargerSuite() /* page 1 au montage */ }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const element = sentinelle.current; if (!element) return
    const observateur = new IntersectionObserver((e) => { if (e[0].isIntersecting) chargerSuite() }, { rootMargin: '120px' })
    observateur.observe(element); return () => observateur.disconnect()
  }, [chargerSuite])

  const charger = () => {
    effacer()
    // `chargement` sert à afficher des cadres qui « respirent » plutôt que des
    // 0 F trompeurs : voir un chiffre d'affaires à zéro fait paniquer.
    Promise.all([
      surveiller(Ventes.lister().then(definirVentes)),
      surveiller(Statistiques.ventesParJour().then(definirParJour)),
      surveiller(Statistiques.paiements().then(definirPaiements)),
      surveiller(Statistiques.meilleursProduits().then(definirMeilleurs)),
    ]).finally(() => definirChargement(false))
    Statistiques.margeCategorie().then(definirMarge).catch(() => {}); Statistiques.rotationStock().then(definirRotation).catch(() => {}); Statistiques.meilleursClients().then(definirClients).catch(() => {})
    Statistiques.marchandage().then(definirMarchandage).catch(() => {})
  }
  useEffect(() => { charger() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const debutDe = (p: Periode) => { const d = new Date(); if (p === 'jour') d.setHours(0,0,0,0); else if (p === 'semaine') d.setDate(d.getDate()-7); else if (p === 'mois') d.setMonth(d.getMonth()-1); else return new Date(0); return d }
  const sommePeriode = (p: Periode) => ventes.filter((v) => new Date(v.cree_le) >= debutDe(p) && v.paye).reduce((a, v) => a + Number(v.total), 0)

  const indicateurs = useMemo(() => {
    const dansPeriode = ventes.filter((v) => new Date(v.cree_le) >= debutDe(periode))
    const encaisse = dansPeriode.filter((v) => v.paye).reduce((a, v) => a + Number(v.total), 0)
    const attente = dansPeriode.filter((v) => !v.paye).reduce((a, v) => a + Number(v.total), 0)
    const credits = ventes.filter((v) => v.moyen_paiement === 'credit')
    const rembourses = credits.filter((v) => v.paye).reduce((a, v) => a + Number(v.total), 0)
    const impayes = credits.filter((v) => !v.paye).reduce((a, v) => a + Number(v.total), 0)
    return { encaisse, attente, credits: impayes, taux: rembourses + impayes > 0 ? (rembourses / (rembourses + impayes)) * 100 : 0 }
  }, [ventes, periode])

  const LIBELLE_PERIODE: Record<Periode, string> = {
    jour: "Aujourd'hui", semaine: 'Cette semaine', mois: 'Ce mois', tout: 'Depuis le début',
  }

  const exporterChiffresPdf = () => exporterPdf('chiffres-samacommerce', {
    titre: 'Chiffres',
    sousTitre: `Période : ${LIBELLE_PERIODE[periode]}`,
    boutique: identiteBoutique(),
    synthese: [
      { libelle: 'CA encaissé', valeur: montant(indicateurs.encaisse), teinte: 'vert' },
      { libelle: 'En attente', valeur: montant(indicateurs.attente), teinte: 'orange' },
      { libelle: 'Crédits impayés', valeur: montant(indicateurs.credits), teinte: 'rouge' },
      { libelle: 'Taux de remboursement', valeur: `${indicateurs.taux.toFixed(0)} %` },
    ],
    colonnes: ['Produit', 'Quantité', 'Montant'],
    lignes: meilleurs.map((m) => [m.produit, String(m.total_quantite), montant(Number(m.total_montant))]),
    pied: ['TOTAL', String(meilleurs.reduce((a, m) => a + Number(m.total_quantite), 0)), montant(meilleurs.reduce((a, m) => a + Number(m.total_montant), 0))],
    alignesADroite: [1, 2],
    note: 'Classement des produits les plus vendus sur la période retenue.',
  })

  const exporterChiffresExcel = () => exporterClasseur('chiffres-samacommerce', {
    onglet: 'Chiffres',
    titre: '📈 Chiffres de la boutique',
    sousTitre: `${identiteBoutique().nom} — ${LIBELLE_PERIODE[periode]} — édité le ${new Date().toLocaleDateString('fr-FR')}`,
    colonnes: [
      { entete: 'Produit', largeur: 32 },
      { entete: 'Quantité vendue', largeur: 16, type: 'nombre' },
      { entete: 'Montant', largeur: 16, type: 'montant' },
    ],
    lignes: meilleurs.map((m) => [m.produit, Number(m.total_quantite), Number(m.total_montant)]),
    totaux: ['TOTAL', meilleurs.reduce((a, m) => a + Number(m.total_quantite), 0), meilleurs.reduce((a, m) => a + Number(m.total_montant), 0)],
  })

  return (
    <>
      {erreur && <ErreurChargement erreur={erreur} surReessai={charger} compacte />}
      <div className="page-entete">
        <h2>📈 Chiffres</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="bouton-pdf" style={{ background: '#ECFDF5', color: 'var(--vert)' }} onClick={exporterChiffresExcel} disabled={meilleurs.length === 0}>📊 Excel</button>
          <button className="bouton-pdf" onClick={exporterChiffresPdf}>📄 PDF</button>
        </div>
      </div>

      {/* La période se choisit d'un doigt. La liste déroulante précédente
          cachait le choix courant derrière un menu système, et le tableau des
          quatre périodes répétait ce que la sélection affiche déjà. */}
      <div className="segments">
        {(['jour', 'semaine', 'mois', 'tout'] as Periode[]).map((p) => (
          <button key={p} className={`segment ${periode === p ? 'allume' : ''}`} onClick={() => definirPeriode(p)} aria-pressed={periode === p}>
            {PERIODE_COURT[p]}
          </button>
        ))}
      </div>

      <div className="kpi-rangee">
        <div className="kpi" style={{ background: 'var(--panneau-vert)' }}>
          <div className="kpi-libelle">💰 Encaissé</div>
          <div className="kpi-valeur">{chargement ? <span className="pulsation">…</span> : fcfa(indicateurs.encaisse)}</div>
          <div className="kpi-detail">{LIBELLE_PERIODE[periode]}</div>
        </div>
        {marchandage && marchandage.nb > 0 ? (
          <div className="kpi" style={{ background: 'var(--panneau-violet)' }}>
            <div className="kpi-libelle">💎 Marge réelle</div>
            <div className="kpi-valeur">{fcfa(marchandage.marge)}</div>
            <div className="kpi-detail">≈ {marchandage.taux_marge} % du prix</div>
          </div>
        ) : (
          <div className="kpi" style={{ background: 'var(--panneau-violet)' }}>
            <div className="kpi-libelle">📊 Crédits remboursés</div>
            <div className="kpi-valeur">{chargement ? <span className="pulsation">…</span> : `${indicateurs.taux.toFixed(0)} %`}</div>
            <div className="kpi-detail">{fcfa(indicateurs.credits)} restent dus</div>
          </div>
        )}
      </div>

      <div className="grille-mesures">
        <div className="mesure"><div className="mesure-libelle">⏳ En attente</div><div className="mesure-valeur" style={{ color: 'var(--orange)' }}>{fcfa(indicateurs.attente)}</div></div>
        <div className="mesure"><div className="mesure-libelle">💳 Crédits en cours</div><div className="mesure-valeur" style={{ color: 'var(--rouge)' }}>{fcfa(indicateurs.credits)}</div></div>
        <div className="mesure"><div className="mesure-libelle">📅 Aujourd'hui</div><div className="mesure-valeur" style={{ color: 'var(--vert)' }}>{fcfa(sommePeriode('jour'))}</div></div>
        <div className="mesure"><div className="mesure-libelle">💰 Depuis le début</div><div className="mesure-valeur" style={{ color: 'var(--bleu)' }}>{fcfa(sommePeriode('tout'))}</div></div>
      </div>

      <div className="carte"><div className="carte-titre">📊 Ventes par jour</div>
        <Line data={{ labels: parJour.map((r) => r.date), datasets: [{ label: 'Montant', data: parJour.map((r) => Number(r.total_montant)), borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,.15)', tension: 0.3, fill: true }] }} options={{ plugins: { legend: { display: false } } }} />
      </div>
      {/* Un histogramme dont on ne peut pas lire les étiquettes d'axe sur un
          téléphone ne dit rien. Des barres horizontales portent le nom, le
          pictogramme et la quantité sur la même ligne. */}
      <div className="carte"><div className="carte-titre">🔥 Top produits</div>
        {meilleurs.length === 0 ? <div className="vide-sous-titre">Pas encore de ventes</div> : (
          <div className="liste-barres">
            {meilleurs.slice(0, 6).map((m, i) => {
              const max = Math.max(1, ...meilleurs.map((x) => Number(x.total_quantite)))
              return (
                <div key={m.produit} className={`ligne-barre rang-${Math.min(i + 1, 3)}`}>
                  <div className="barre-entete">
                    <span className="barre-icone" aria-hidden="true">{['🥇', '🥈', '🥉'][i] || iconeProduit(m.produit)}</span>
                    <span className="barre-nom">{m.produit}</span>
                    <span className="barre-valeur">{m.total_quantite}</span>
                  </div>
                  <div className="barre-piste"><div className="barre-remplissage" style={{ width: `${(Number(m.total_quantite) / max) * 100}%` }} /></div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <div className="carte"><div className="carte-titre">💳 Paiements</div>
        {paiements.length === 0 ? <div className="vide-sous-titre">Pas encore de ventes</div> : (
          <>
            <div style={{ maxWidth: 260, margin: '0 auto' }}>
              <Doughnut data={{
                labels: paiements.map((p) => libellePaiement(p.moyen_paiement)),
                datasets: [{ data: paiements.map((p) => Number(p.total_montant)), backgroundColor: COULEURS_PAIEMENT, borderWidth: 0 }],
              }} options={{ plugins: { legend: { display: false } }, cutout: '62%' }} />
            </div>
            {/* Légende écrite : les parts d'un anneau se comparent mal à l'œil,
                et la couleur seule ne dit pas laquelle est laquelle. */}
            <div className="liste-barres" style={{ marginTop: 14 }}>
              {(() => {
                const somme = paiements.reduce((a, p) => a + Number(p.total_montant), 0) || 1
                return paiements.map((p, i) => (
                  <div key={p.moyen_paiement} className="barre-entete">
                    <span className="barre-icone" aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 4, background: COULEURS_PAIEMENT[i % COULEURS_PAIEMENT.length] }} />
                    <span className="barre-nom">{libellePaiement(p.moyen_paiement)}</span>
                    <span className="barre-valeur">{Math.round((Number(p.total_montant) / somme) * 100)} %</span>
                  </div>
                ))
              })()}
            </div>
          </>
        )}
      </div>

      {marchandage && marchandage.nb > 0 && (
        <div className="carte"><div className="carte-titre">💬 Marchandage & marge réelle</div>
          <div className="grille-mesures">
            <div className="mesure"><div className="mesure-libelle">💰 Marge réelle</div><div className="mesure-valeur" style={{ color: 'var(--vert)' }}>{fcfa(marchandage.marge)}</div></div>
            <div className="mesure"><div className="mesure-libelle">📊 Taux de marge</div><div className="mesure-valeur" style={{ color: 'var(--bleu)' }}>{marchandage.taux_marge} %</div></div>
            <div className="mesure"><div className="mesure-libelle">🏷️ Remises consenties</div><div className="mesure-valeur" style={{ color: 'var(--accent)' }}>{fcfa(marchandage.remise_totale)}</div></div>
            <div className="mesure"><div className="mesure-libelle">🧾 Ventes</div><div className="mesure-valeur">{marchandage.nb}</div></div>
          </div>
          {marchandage.par_vendeur?.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="tableau-historique" style={{ marginTop: 6 }}>
                <thead><tr><th>Vendeur</th><th>Ventes</th><th>CA</th><th>Marge</th><th>Remise</th></tr></thead>
                <tbody>
                  {marchandage.par_vendeur.map((v: any, i: number) => (
                    <tr key={i}><td>{v.vendeur}</td><td>{v.nb}</td><td>{fcfa(Number(v.ca))}</td><td style={{ color: 'var(--vert)', fontWeight: 700 }}>{fcfa(Number(v.marge))}</td><td style={{ color: 'var(--accent)' }}>{fcfa(Number(v.remise))}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="carte"><div className="carte-titre">💎 Marge par catégorie</div>
        {marge.length === 0 ? <div className="vide-sous-titre">Pas encore de données</div>
          : <Bar data={{ labels: marge.map((m) => m.categorie), datasets: [{ label: 'Marge', data: marge.map((m) => Number(m.marge)), backgroundColor: '#10B981' }, { label: 'CA', data: marge.map((m) => Number(m.ca)), backgroundColor: '#A78BFA' }] }} options={{ plugins: { legend: { display: true } } }} />}
      </div>

      <div className="carte" style={{ overflowX: 'auto' }}><div className="carte-titre">🔄 Rotation des stocks</div>
        <table className="tableau-historique">
          <thead><tr><th>Produit</th><th>Vendus</th><th>Stock</th><th>Rotation</th></tr></thead>
          <tbody>
            {rotation.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--attenue)', padding: 14 }}>Aucune donnée</td></tr>}
            {rotation.map((r, i) => {
              const vendus = Number(r.vendus), stock = Number(r.stock)
              const ratio = stock > 0 ? vendus / stock : vendus
              const etiquette = ratio >= 1 ? { texte: 'Rapide', couleur: 'var(--vert)' } : ratio >= 0.3 ? { texte: 'Moyenne', couleur: 'var(--orange)' } : { texte: 'Lente', couleur: 'var(--rouge)' }
              return <tr key={i}><td>{r.produit}</td><td>{vendus}</td><td>{stock}</td><td style={{ color: etiquette.couleur, fontWeight: 700 }}>{etiquette.texte}</td></tr>
            })}
          </tbody>
        </table>
      </div>

      <div className="carte" style={{ overflowX: 'auto' }}><div className="carte-titre">🧾 Historique des ventes ({historique.length}{dernierePage > 1 ? ` / ${dernierePage * 15}~` : ''})</div>
        <table className="tableau-historique">
          <thead><tr><th>Date</th><th>Produit</th><th>Qté</th><th>Montant</th><th>Paiement</th></tr></thead>
          <tbody>
            {historique.map((v) => (
              <tr key={v.id}>
                <td>{(v.cree_le || '').slice(0, 10)}</td>
                <td>{v.nom_produit || '—'}</td>
                <td>{v.quantite}</td>
                <td>{fcfa(Number(v.total))}</td>
                <td>{v.paye ? v.moyen_paiement : <span style={{ color: 'var(--rouge)' }}>crédit</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div ref={sentinelle} style={{ textAlign: 'center', padding: 10, color: 'var(--attenue)', fontSize: 12.5 }}>
          {chargementHistorique ? '⟳ Chargement…' : pageHistorique < dernierePage ? <button className="pastille-douce" onClick={chargerSuite}>Charger plus</button> : 'Fin de l’historique'}
        </div>
      </div>

      <div className="carte"><div className="carte-titre">🏆 Meilleurs clients</div>
        {clients.length === 0 ? <div className="vide-sous-titre">Aucun client avec achats</div>
          : clients.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--trait-doux)' }}>
              <span className="police-titre" style={{ fontWeight: 800, color: 'var(--marque)', width: 22 }}>{i + 1}</span>
              <div style={{ flex: 1 }}><div className="police-titre" style={{ fontWeight: 700, fontSize: 14 }}>{c.client}</div><div style={{ fontSize: 11.5, color: 'var(--attenue)' }}>{c.nb_achats} achat(s)</div></div>
              <span className="police-titre" style={{ fontWeight: 800, color: 'var(--vert)' }}>{fcfa(Number(c.total))}</span>
            </div>
          ))}
      </div>
    </>
  )
}
