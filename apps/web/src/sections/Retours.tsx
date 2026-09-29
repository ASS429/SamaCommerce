import { useEffect, useState } from 'react'
import { Retours as ApiRetours, Ventes, fcfa, type Vente } from '../outils/api'
import { bulle } from '../outils/bulles'
import { ListeSquelette } from '../composants/Squelette'
import { iconeProduit, fondProduit } from '../outils/iconeProduit'
import ErreurChargement from '../composants/ErreurChargement'
import { useErreurChargement } from '../outils/erreursChargement'

/* Moyen de remboursement : quatre images plutôt qu'une liste déroulante. */
const REMBOURSEMENTS: { valeur: string; icone: string; libelle: string }[] = [
  { valeur: 'avoir', icone: '🎟️', libelle: 'Avoir' },
  { valeur: 'especes', icone: '💵', libelle: 'Espèces' },
  { valeur: 'wave', icone: '📲', libelle: 'Wave' },
  { valeur: 'orange', icone: '📞', libelle: 'Orange' },
]

export default function Retours() {
  const [liste, definirListe] = useState<any[]>([])
  const [chiffres, definirChiffres] = useState<any>(null)
  const [ventes, definirVentes] = useState<Vente[]>([])
  const [fenetreOuverte, definirFenetreOuverte] = useState(false)
  const [chargement, definirChargement] = useState(true)
  const { erreur, surveiller, effacer } = useErreurChargement()

  const charger = () => {
    effacer()
    surveiller(ApiRetours.lister().then(definirListe)).finally(() => definirChargement(false))
    ApiRetours.statistiques().then(definirChiffres).catch(() => {})
    Ventes.lister().then((v) => definirVentes(v.filter((x) => x.quantite > 0 && x.moyen_paiement !== 'retour'))).catch(() => {})
  }
  useEffect(() => { charger() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="page-entete"><h2>↩️ Retours</h2><button className="bouton-principal" onClick={() => definirFenetreOuverte(true)}>+ Nouveau retour</button></div>

      {/* Les compteurs restent visibles pendant le chargement : un cadre vide
          donne l'impression que l'application a planté. */}
      <div className="bande-compteurs">
        <div className="compteur compteur-violet"><b>{chiffres ? chiffres.nb_retours : '—'}</b><span>↩️ retours</span></div>
        <div className="compteur compteur-rouge"><b>{chiffres ? fcfa(chiffres.total_rembourse) : '—'}</b><span>💰 remboursé</span></div>
        <div className="compteur compteur-bleu"><b>{chiffres ? fcfa(chiffres.rembourse_jour) : '—'}</b><span>📅 aujourd'hui{chiffres ? ` (${chiffres.retours_jour})` : ''}</span></div>
      </div>

      <div className="section-libelle">📜 Historique des retours</div>

      {chargement && <ListeSquelette nombre={3} />}
      {!chargement && erreur && <ErreurChargement erreur={erreur} surReessai={charger} />}
      {!chargement && !erreur && liste.length === 0 && (
        <div className="etat-vide">
          <div className="vide-icone">↩️</div>
          <div className="vide-texte">Aucun retour</div>
          <div className="vide-sous-titre">Tant mieux : vos clients gardent ce qu'ils achètent 🎉</div>
        </div>
      )}

      {!chargement && liste.map((r) => (
        <div key={r.id} className="carte fiche">
          <div className="fiche-entete">
            <span className="produit-icone" style={{ width: 44, height: 44, fontSize: 22, borderRadius: 14, background: fondProduit(r.nom_produit) }} aria-hidden="true">
              {iconeProduit(r.nom_produit)}
            </span>
            <div className="fiche-identite">
              <div className="fiche-nom">{r.nom_produit}</div>
              <div className="fiche-sous-titre">📅 {(r.cree_le || '').slice(0, 10)} · ↩️ × {r.quantite}</div>
              {r.motif && <div className="fiche-sous-titre">📝 {r.motif}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="produit-prix-principal" style={{ color: 'var(--rouge)' }}>−{fcfa(Number(r.montant_rembourse))}</div>
              <span className="produit-stock-pilule pilule-bas">
                {(REMBOURSEMENTS.find((m) => m.valeur === r.moyen_remboursement)?.icone) || '💰'} {(REMBOURSEMENTS.find((m) => m.valeur === r.moyen_remboursement)?.libelle) || r.moyen_remboursement || 'Avoir'}
              </span>
            </div>
          </div>
        </div>
      ))}

      {fenetreOuverte && <FenetreRetour ventes={ventes} surFermeture={() => definirFenetreOuverte(false)} surEnregistrement={() => { definirFenetreOuverte(false); charger() }} />}
    </>
  )
}

function FenetreRetour({ ventes, surFermeture, surEnregistrement }: { ventes: Vente[]; surFermeture: () => void; surEnregistrement: () => void }) {
  const [venteId, definirVenteId] = useState('')
  const [quantite, definirQuantite] = useState('1')
  const [motif, definirMotif] = useState('')
  const [moyen, definirMoyen] = useState('avoir')
  const [envoi, definirEnvoi] = useState(false)

  const enregistrer = async () => {
    if (!venteId) return alert('Choisir une vente')
    definirEnvoi(true)
    try { const d = await ApiRetours.creer(Number(venteId), Number(quantite) || 1, motif || undefined, moyen); bulle(d.message, 'succes'); surEnregistrement() }
    catch (e: any) { alert(e?.response?.data?.erreur || 'Erreur') } finally { definirEnvoi(false) }
  }

  const vente = ventes.find((v) => String(v.id) === venteId)

  return (
    <div className="fenetre-calque" onClick={surFermeture}>
      <div className="fenetre-boite" onClick={(e) => e.stopPropagation()}>
        <div className="fenetre-titre">↩️ Nouveau retour</div>
        <div className="groupe-champ"><label>🛒 Vente concernée</label>
          <select value={venteId} onChange={(e) => definirVenteId(e.target.value)}>
            <option value="">Choisir une vente</option>
            {ventes.map((v) => <option key={v.id} value={v.id}>{iconeProduit(v.nom_produit)} {v.nom_produit} × {v.quantite} · {fcfa(Number(v.total))} · {(v.cree_le || '').slice(0, 10)}</option>)}
          </select>
        </div>
        {vente && (
          <div className="ligne-article">
            <span className="produit-icone" style={{ width: 34, height: 34, fontSize: 18, borderRadius: 11, background: fondProduit(vente.nom_produit) }} aria-hidden="true">{iconeProduit(vente.nom_produit)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="police-titre" style={{ fontWeight: 700, fontSize: 13.5 }}>{vente.nom_produit}</div>
              <div style={{ fontSize: 12, color: 'var(--attenue)' }}>vendu {fcfa(Number(vente.total))}</div>
            </div>
          </div>
        )}
        <div className="groupe-champ"><label>🔢 Quantité retournée</label><input type="number" min={1} value={quantite} onChange={(e) => definirQuantite(e.target.value)} /></div>
        <div className="groupe-champ"><label>📝 Motif</label><input value={motif} onChange={(e) => definirMotif(e.target.value)} placeholder="Défectueux, erreur..." /></div>
        <div className="groupe-champ"><label>💰 Remboursement</label></div>
        <div className="choix-rangee">
          {REMBOURSEMENTS.map((m) => (
            <button key={m.valeur} type="button" className={`choix-option ${moyen === m.valeur ? 'choisi' : ''}`} onClick={() => definirMoyen(m.valeur)} aria-pressed={moyen === m.valeur}>
              <span className="choix-icone">{m.icone}</span><span>{m.libelle}</span>
            </button>
          ))}
        </div>
        <div className="fenetre-actions"><button className="bouton-annuler" onClick={surFermeture}>Annuler</button><button className="bouton-valider" onClick={enregistrer} disabled={envoi}>Valider le retour</button></div>
      </div>
    </div>
  )
}
