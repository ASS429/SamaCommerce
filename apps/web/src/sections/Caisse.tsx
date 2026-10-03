import { useEffect, useState } from 'react'
import { Caisse as ApiCaisse, fcfa, identiteBoutique } from '../outils/api'
import { demanderConfirmation } from '../outils/bulles'
import SceneCloture from '../composants/SceneCloture'
import { exporterPdf, montant } from '../outils/pdf'
import { exporterClasseur } from '../outils/xlsx'
import { ListeSquelette } from '../composants/Squelette'
import ErreurChargement from '../composants/ErreurChargement'
import { useErreurChargement } from '../outils/erreursChargement'

export default function Caisse() {
  const [jour, definirJour] = useState<any>(null)
  const [historique, definirHistorique] = useState<any[]>([])
  const [semaine, definirSemaine] = useState<any[]>([])
  const [cloture, definirCloture] = useState(false)
  const [scene, definirScene] = useState<any>(null) // Design 3.4 — séquence de clôture
  const { erreur, surveiller, effacer } = useErreurChargement()

  const charger = () => {
    effacer()
    surveiller(ApiCaisse.aujourdhui().then(definirJour))
    surveiller(ApiCaisse.historique().then(definirHistorique))
    surveiller(ApiCaisse.semaine().then(definirSemaine))
  }
  useEffect(() => { charger() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Somme d'une colonne de l'historique (ligne de totaux des exports). */
  const sommeHistorique = (cle: string) => historique.reduce((a, h) => a + Number(h[cle] || 0), 0)

  const cloturer = async () => {
    if (!await demanderConfirmation('Clôturer la caisse pour aujourd\'hui ?')) return
    definirCloture(true)
    try {
      const instantane = { ...jour }
      await ApiCaisse.cloturer()
      definirScene(instantane) // déclenche la séquence de fin de journée
      charger()
    } finally { definirCloture(false) }
  }

  /* Le PDF de caisse est LE document de fin de journée : on le montre au
     patron, on le classe, parfois on le porte à la banque. */
  const exporterCaissePdf = () => exporterPdf('caisse-samacommerce', {
    titre: 'Caisse',
    sousTitre: `Journée du ${new Date().toLocaleDateString('fr-FR')}`,
    boutique: identiteBoutique(),
    synthese: [
      { libelle: 'Espèces', valeur: montant(jour.especes), teinte: 'vert' },
      { libelle: 'Wave', valeur: montant(jour.wave) },
      { libelle: 'Orange Money', valeur: montant(jour.orange), teinte: 'orange' },
      { libelle: 'Net du jour', valeur: montant(jour.net), teinte: 'marque' },
    ],
    colonnes: ['Date', 'Espèces', 'Wave', 'Orange', 'Net'],
    lignes: historique.map((h) => [(h.date || '').slice(0, 10), montant(Number(h.total_especes)), montant(Number(h.total_wave)), montant(Number(h.total_orange)), montant(Number(h.total_net))]),
    pied: ['TOTAL', montant(sommeHistorique('total_especes')), montant(sommeHistorique('total_wave')), montant(sommeHistorique('total_orange')), montant(sommeHistorique('total_net'))],
    alignesADroite: [1, 2, 3, 4],
    note: 'Historique des clôtures de caisse enregistrées.',
  })

  const exporterCaisseExcel = () => exporterClasseur('caisse-samacommerce', {
    onglet: 'Caisse',
    titre: '💰 Clôtures de caisse',
    sousTitre: `${identiteBoutique().nom} — édité le ${new Date().toLocaleDateString('fr-FR')}`,
    colonnes: [
      { entete: 'Date', largeur: 14 },
      { entete: 'Espèces', largeur: 14, type: 'montant' }, { entete: 'Wave', largeur: 14, type: 'montant' },
      { entete: 'Orange', largeur: 14, type: 'montant' }, { entete: 'Net', largeur: 14, type: 'montant' },
    ],
    lignes: historique.map((h) => [(h.date || '').slice(0, 10), Number(h.total_especes), Number(h.total_wave), Number(h.total_orange), Number(h.total_net)]),
    totaux: ['TOTAL', sommeHistorique('total_especes'), sommeHistorique('total_wave'), sommeHistorique('total_orange'), sommeHistorique('total_net')],
  })

  // Écran de chargement : des cadres qui « respirent » plutôt qu'un mot seul.
  if (!jour) {
    return (
      <>
        <div className="page-entete"><h2>💰 Caisse du jour</h2></div>
        {erreur && <ErreurChargement erreur={erreur} surReessai={charger} />}
        {!erreur && (<>
        <div className="grille-stats">
          {[0, 1, 2, 3].map((i) => <div className="stat" key={i}><div className="squelette" style={{ height: 22, width: '70%' }} /><div className="squelette" style={{ height: 11, width: '50%', marginTop: 6 }} /></div>)}
        </div>
        <ListeSquelette nombre={3} />
        </>)}
      </>
    )
  }
  const maxSemaine = Math.max(1, ...semaine.map((j) => Number(j.total_encaisse)))

  return (
    <>
      {scene && <SceneCloture jour={scene} surFermeture={() => definirScene(null)} />}
      <div className="page-entete"><h2>💰 Caisse du jour</h2></div>

      {/* Le net du jour et le geste de clôture sont réunis : c'est une seule
          question (« combien j'ai fait, je ferme ? »), elle tient sur un
          panneau. Auparavant le chiffre et le bouton étaient séparés par
          quatre encadrés. */}
      <div className="panneau panneau-sarcelle">
        <div className="panneau-haut">
          <div style={{ minWidth: 0 }}>
            <div className="panneau-libelle">🔒 Clôture · {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</div>
            <div className="panneau-valeur">{fcfa(jour.net)}</div>
            <div className="panneau-sous-titre">Net de la journée · {jour.nb_ventes} vente(s)</div>
          </div>
          <div className="panneau-haut-actions">
            <button className="panneau-bouton" onClick={exporterCaisseExcel} disabled={historique.length === 0} title="Exporter en Excel">📊</button>
            <button className="panneau-bouton" onClick={exporterCaissePdf} title="Exporter en PDF">📄</button>
          </div>
        </div>
        <div className="panneau-chiffres">
          <div className="panneau-chiffre"><b>{fcfa(jour.especes)}</b><span>💵 espèces</span></div>
          <div className="panneau-chiffre"><b>{fcfa(jour.wave)}</b><span>📱 Wave</span></div>
          <div className="panneau-chiffre"><b>{fcfa(jour.orange)}</b><span>📞 Orange</span></div>
        </div>
        <button className="panneau-appel" data-guide="caisse-cloturer" onClick={cloturer} disabled={cloture}>
          {cloture ? 'Clôture en cours…' : '🔒 Clôturer la journée'}
        </button>
      </div>

      {Number(jour.credits) > 0 && (
        <div className="bande-compteurs">
          <div className="compteur compteur-violet"><b>{fcfa(jour.credits)}</b><span>📝 vendu à crédit</span></div>
          <div className="compteur compteur-vert"><b>{fcfa(jour.net)}</b><span>💰 encaissé</span></div>
          <div className="compteur compteur-bleu"><b>{jour.nb_ventes}</b><span>🧾 ventes</span></div>
        </div>
      )}

      <div className="carte" style={{ marginTop: 16 }}>
        <div className="carte-titre">📅 7 derniers jours</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, padding: '8px 0' }}>
          {semaine.map((j, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: '100%', background: 'var(--principal)', borderRadius: 6, height: `${(Number(j.total_encaisse) / maxSemaine) * 90}px`, minHeight: 2 }} />
              <span style={{ fontSize: 9, color: 'var(--attenue)' }}>{(j.date || '').slice(8, 10)}/{(j.date || '').slice(5, 7)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="carte" style={{ overflowX: 'auto' }}>
        <div className="carte-titre">🗂️ Clôtures récentes</div>
        <table className="tableau-historique">
          <thead><tr><th>Date</th><th>Espèces</th><th>Wave</th><th>Orange</th><th>Net</th></tr></thead>
          <tbody>
            {historique.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--attenue)', padding: 16 }}>Aucune clôture</td></tr>}
            {historique.map((h) => (
              <tr key={h.id}>
                <td>{(h.date || '').slice(0, 10)}</td>
                <td>{fcfa(Number(h.total_especes))}</td>
                <td>{fcfa(Number(h.total_wave))}</td>
                <td>{fcfa(Number(h.total_orange))}</td>
                <td style={{ fontWeight: 700, color: 'var(--vert)' }}>{fcfa(Number(h.total_net))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
