import { useEffect, useMemo, useState } from 'react'
import { Ventes, Clients, Ia, identiteBoutique, dateFr, fcfa, type ClientPourVente, type Vente, type ScoreCredit } from '../outils/api'
import { ListeSquelette } from '../composants/Squelette'
import AnneauScore from '../composants/AnneauScore'
import ChoixPaiement from '../composants/ChoixPaiement'
import { exporterPdf, montant } from '../outils/pdf'
import { exporterClasseur } from '../outils/xlsx'
import { iconeProduit, fondProduit } from '../outils/iconeProduit'
import { messageRappelCredit, ouvrirWhatsapp, lienAppel } from '../outils/whatsapp'
import ErreurChargement from '../composants/ErreurChargement'
import { useErreurChargement } from '../outils/erreursChargement'
import { useProduits, LISTE_VIDE } from '../outils/requetes'

const RISQUE = {
  vert: { couleur: 'var(--vert)', fond: '#ECFDF5', texte: 'Risque faible' },
  orange: { couleur: 'var(--attention)', fond: '#FFF7ED', texte: 'Risque moyen' },
  rouge: { couleur: 'var(--danger)', fond: '#FEF2F2', texte: 'Risque élevé' },
}

export default function Credits() {
  const [ventes, definirVentes] = useState<Vente[]>([])
  const produits = useProduits().data ?? LISTE_VIDE
  const [client, definirClient] = useState(''); const [telephone, definirTelephone] = useState('')
  const [produitId, definirProduitId] = useState(''); const [quantite, definirQuantite] = useState('1'); const [echeance, definirEcheance] = useState('')
  const [envoi, definirEnvoi] = useState(false)
  const [chargement, definirChargement] = useState(true)
  const [score, definirScore] = useState<ScoreCredit | null>(null)
  const { erreur, surveiller, effacer } = useErreurChargement()

  const charger = () => {
    effacer()
    surveiller(Ventes.lister().then((liste) => definirVentes(liste.filter((v) => v.moyen_paiement === 'credit')))).finally(() => definirChargement(false))
  }
  useEffect(charger, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* Un crédit se fait TOUJOURS à quelqu'un d'identifié : soit un client déjà
     enregistré, soit un nouveau dont la fiche est créée à l'enregistrement.
     Sans cela, l'historique et le score se calculent sur un nom écrit à la
     main — et « Awa », « awa » et « Awa N. » deviennent trois personnes. */
  const [listeClients, definirListeClients] = useState<ClientPourVente[]>([])
  const [clientId, definirClientId] = useState('')            // '' = nouveau client
  useEffect(() => { Clients.pourVente().then(definirListeClients).catch(() => {}) }, [])

  const choisirClient = (valeur: string) => {
    definirClientId(valeur)
    const c = listeClients.find((x) => String(x.id) === valeur)
    definirClient(c ? c.nom : '')
    definirTelephone(c?.telephone || '')
  }

  const resume = useMemo(() => {
    const impayes = ventes.filter((v) => !v.paye)
    const aujourdhui = new Date(new Date().toDateString())
    return {
      enCours: impayes.reduce((a, v) => a + Number(v.total), 0),
      rembourses: ventes.filter((v) => v.paye).reduce((a, v) => a + Number(v.total), 0),
      nb: impayes.length,
      // Combien de personnes me doivent de l'argent, et combien ont dépassé la
      // date : ce sont les deux chiffres qui décident d'une relance.
      clients: new Set(impayes.map((v) => v.client_id ?? v.nom_client ?? v.id)).size,
      retard: impayes.filter((v) => !!v.date_echeance && new Date(v.date_echeance) < aujourdhui).length,
    }
  }, [ventes])

  const montantEstime = useMemo(() => {
    const p = produits.find((x) => String(x.id) === produitId)
    return p ? Math.round(Number(p.prix_vente)) * (Number(quantite) || 1) : 0
  }, [produits, produitId, quantite])

  // Module B (IA) — score du risque de crédit, calculé quand client + produit sont saisis
  useEffect(() => {
    if (!client.trim() || !produitId || montantEstime <= 0) { definirScore(null); return }
    const minuterie = setTimeout(() => {
      Ia.scoreCredit({ montant: montantEstime, date_echeance: echeance || null, client_id: clientId ? Number(clientId) : null, nom_client: client.trim() })
        .then(definirScore).catch(() => definirScore(null))
    }, 450)
    return () => clearTimeout(minuterie)
  }, [client, clientId, produitId, montantEstime, echeance])

  const valider = async (e: React.FormEvent) => {
    e.preventDefault(); if (!produitId) return alert('Choisir un produit'); definirEnvoi(true)
    if (!client.trim()) { definirEnvoi(false); return alert('Choisissez un client (ou saisissez un nouveau nom)') }
    try {
      await Ventes.creer({
        produit_id: Number(produitId), quantite: Number(quantite) || 1, moyen_paiement: 'credit',
        client_id: clientId ? Number(clientId) : null,
        nom_client: client || null, telephone_client: telephone || null, date_echeance: echeance || null,
      })
      definirClientId(''); definirClient(''); definirTelephone(''); definirProduitId(''); definirQuantite('1'); definirEcheance('')
      Clients.pourVente().then(definirListeClients).catch(() => {}) // la fiche vient peut-être d'être créée
      charger()
    }
    catch (e: any) { alert(e?.response?.data?.erreur || 'Erreur') } finally { definirEnvoi(false) }
  }
  // Remboursement : on choisit le moyen de paiement dans une liste illustrée
  // (auparavant il fallait taper « especes / wave / orange » au clavier).
  const [enRemboursement, definirEnRemboursement] = useState<Vente | null>(null)
  const confirmerRemboursement = async (moyen: string) => {
    const v = enRemboursement
    definirEnRemboursement(null)
    if (!v) return
    await Ventes.modifier(v.id, { paye: true, moyen_reglement: moyen })
    charger()
  }

  const exporterCreditsPdf = () => exporterPdf('credits-samacommerce', {
    titre: 'Crédits',
    sousTitre: `${ventes.length} crédit(s) enregistré(s)`,
    boutique: identiteBoutique(),
    synthese: [
      { libelle: 'En cours', valeur: montant(resume.enCours), teinte: 'rouge' },
      { libelle: 'Remboursé', valeur: montant(resume.rembourses), teinte: 'vert' },
      { libelle: 'Impayés', valeur: String(resume.nb), teinte: 'orange' },
    ],
    colonnes: ['Date', 'Client', 'Produit', 'Montant', 'Échéance', 'Statut'],
    lignes: ventes.map((v) => [
      (v.cree_le || '').slice(0, 10), v.nom_client || '—', v.nom_produit || '—',
      montant(Number(v.total)), dateFr(v.date_echeance), v.paye ? 'Remboursé' : 'Impayé',
    ]),
    pied: ['TOTAL', '', '', montant(ventes.reduce((a, v) => a + Number(v.total), 0)), '', ''],
    alignesADroite: [3],
    note: 'Un crédit impayé après son échéance doit être relancé : bouton « Rappel » dans l\'application.',
  })

  const exporterCreditsExcel = () => exporterClasseur('credits-samacommerce', {
    onglet: 'Crédits',
    titre: '📝 Crédits clients',
    sousTitre: `${identiteBoutique().nom} — édité le ${new Date().toLocaleDateString('fr-FR')}`,
    colonnes: [
      { entete: 'Date', largeur: 12 }, { entete: 'Client', largeur: 22 }, { entete: 'Téléphone', largeur: 16 },
      { entete: 'Produit', largeur: 26 }, { entete: 'Montant', largeur: 14, type: 'montant' },
      { entete: 'Échéance', largeur: 12 }, { entete: 'Statut', largeur: 14 },
    ],
    lignes: ventes.map((v) => [
      (v.cree_le || '').slice(0, 10), v.nom_client || '', v.telephone_client || '',
      v.nom_produit || '', Number(v.total), dateFr(v.date_echeance), v.paye ? 'Remboursé' : 'Impayé',
    ]),
    totaux: ['TOTAL', '', '', '', ventes.reduce((a, v) => a + Number(v.total), 0), '', ''],
  })

  /** Relance WhatsApp d'un crédit précis (montant, produit et échéance inclus). */
  const rappel = (v: Vente) => ouvrirWhatsapp(v.telephone_client, messageRappelCredit(identiteBoutique(), {
    client: v.nom_client || 'cher client',
    montant: Number(v.total),
    echeance: v.date_echeance,
    produit: v.nom_produit,
  }))

  return (
    <>
      {enRemboursement && (
        <ChoixPaiement
          titre="💰 Remboursement reçu"
          montant={Number(enRemboursement.total)}
          surChoix={confirmerRemboursement}
          surFermeture={() => definirEnRemboursement(null)}
        />
      )}
      <div className="page-entete"><h2>📝 Crédits</h2></div>

      {/* Le montant qu'on me doit est LA réponse attendue en ouvrant l'écran :
          il est seul, en grand, sur fond violet. Le reste (nombre de clients,
          retards) le qualifie en dessous. */}
      <div className="panneau">
        <div className="panneau-haut">
          <div style={{ minWidth: 0 }}>
            <div className="panneau-libelle">💸 Total dû par mes clients</div>
            <div className="panneau-valeur">{fcfa(resume.enCours)}</div>
          </div>
          <div className="panneau-haut-actions">
            <button className="panneau-bouton" onClick={exporterCreditsExcel} disabled={ventes.length === 0} title="Exporter en Excel">📊</button>
            <button className="panneau-bouton" onClick={exporterCreditsPdf} disabled={ventes.length === 0} title="Exporter en PDF">📄</button>
          </div>
        </div>
        <div className="panneau-chiffres">
          <div className="panneau-chiffre"><b>{resume.clients}</b><span>👤 clients</span></div>
          <div className="panneau-chiffre"><b>{resume.retard}</b><span>⏰ en retard</span></div>
          <div className="panneau-chiffre"><b>{fcfa(resume.rembourses)}</b><span>✅ remboursé</span></div>
        </div>
      </div>

      <form className="carte" onSubmit={valider}>
        <div className="carte-titre">➕ Nouvelle vente à crédit</div>
        <div className="groupe-champ"><label>👤 Client</label>
          <select value={clientId} onChange={(e) => choisirClient(e.target.value)}>
            <option value="">➕ Nouveau client</option>
            {listeClients.map((c) => <option key={c.id} value={c.id}>👤 {c.nom}{c.telephone ? ` — ${c.telephone}` : ''}</option>)}
          </select>
        </div>
        {!clientId && (
          <>
            <div className="groupe-champ"><label>Nom du nouveau client</label><input value={client} onChange={(e) => definirClient(e.target.value)} placeholder="Ex. Awa Ndiaye" /></div>
            <div className="groupe-champ"><label>📞 Téléphone</label><input type="tel" inputMode="tel" value={telephone} onChange={(e) => definirTelephone(e.target.value)} placeholder="77 123 45 67" /></div>
            <div style={{ fontSize: 12, color: 'var(--attenue)', margin: '-6px 0 12px' }}>Sa fiche client sera créée automatiquement.</div>
          </>
        )}
        <div className="groupe-champ"><label>Produit</label>
          <select value={produitId} onChange={(e) => definirProduitId(e.target.value)}>
            <option value="">Choisir un produit</option>
            {produits.map((p) => <option key={p.id} value={p.id}>{iconeProduit(p.nom)} {p.nom} — {fcfa(p.prix_vente)} (stock {p.stock})</option>)}
          </select>
        </div>
        <div className="groupe-champ"><label>Quantité</label><input type="number" min={1} value={quantite} onChange={(e) => definirQuantite(e.target.value)} /></div>
        <div className="groupe-champ"><label>Échéance</label><input type="date" value={echeance} onChange={(e) => definirEcheance(e.target.value)} /></div>

        {score && (
          <div className="score-carte" style={{ background: RISQUE[score.risque].fond, border: `1px solid ${RISQUE[score.risque].couleur}33` }}>
            <AnneauScore score={score.score} couleur={RISQUE[score.risque].couleur} libelle={RISQUE[score.risque].texte} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: RISQUE[score.risque].couleur, marginBottom: 4 }}>🤖 {RISQUE[score.risque].texte}</div>
              {score.raisons.map((r, i) => <div key={i} style={{ fontSize: 11.5, color: 'var(--attenue)' }}>• {r}</div>)}
              <div style={{ fontSize: 10.5, color: 'var(--attenue-2)', marginTop: 4 }}>Montant estimé : {fcfa(montantEstime)} · {score.methode === 'modele' ? 'modèle IA' : 'estimation'}</div>
            </div>
          </div>
        )}

        <button className="bouton-valider" style={{ width: '100%' }} disabled={envoi}>💾 Enregistrer à crédit</button>
      </form>

      <div className="section-libelle">📜 Historique des crédits</div>

      {chargement && <ListeSquelette nombre={4} />}
      {!chargement && erreur && <ErreurChargement erreur={erreur} surReessai={charger} />}
      {!chargement && !erreur && ventes.length === 0 && (
        <div className="etat-vide">
          <div className="vide-icone">📝</div>
          <div className="vide-texte">Aucun crédit</div>
          <div className="vide-sous-titre">Les ventes à crédit apparaîtront ici, avec leur échéance</div>
        </div>
      )}

      {/* Une ligne de tableau à 7 colonnes est illisible sur téléphone. Ici,
          une fiche par crédit : image du produit, montant, et l'état porté par
          la couleur — vert remboursé, rouge en retard, ambre en cours. */}
      {!chargement && ventes.map((v) => {
        const enRetard = !v.paye && !!v.date_echeance && new Date(v.date_echeance) < new Date(new Date().toDateString())
        const appel = lienAppel(v.telephone_client)
        return (
          <div key={v.id} className={`carte fiche ${enRetard ? 'fiche-en-retard' : ''}`}>
            <div className="fiche-entete">
              <span className="produit-icone" style={{ width: 44, height: 44, fontSize: 22, borderRadius: 14, background: fondProduit(v.nom_produit) }} aria-hidden="true">
                {iconeProduit(v.nom_produit)}
              </span>
              <div className="fiche-identite">
                <div className="fiche-nom">{v.nom_client || 'Client'}</div>
                <div className="fiche-sous-titre">📦 {v.nom_produit || '—'} · 📅 {(v.cree_le || '').slice(0, 10)}</div>
                {v.date_echeance && <div className="fiche-sous-titre">{enRetard ? '⏰' : '🗓️'} Échéance {dateFr(v.date_echeance)}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="produit-prix-principal" style={{ color: v.paye ? 'var(--vert)' : 'var(--rouge)' }}>{fcfa(Number(v.total))}</div>
                <span className={`produit-stock-pilule ${v.paye ? 'pilule-ok' : enRetard ? 'pilule-critique' : 'pilule-bas'}`}>
                  {v.paye ? '✅ Remboursé' : enRetard ? '⏰ En retard' : '⏳ En cours'}
                </span>
              </div>
            </div>

            {!v.paye && (
              <div className="fiche-actions">
                <button className="fa-bouton fa-ok" onClick={() => definirEnRemboursement(v)}>💰 Il a payé</button>
                {v.telephone_client && <button className="fa-bouton fa-whatsapp" onClick={() => rappel(v)}>🔔 Rappel WhatsApp</button>}
                {appel && <a className="fa-bouton fa-appeler" href={appel}>📞 Appeler</a>}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
