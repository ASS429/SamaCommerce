import { useEffect, useMemo, useState } from 'react'
import { Ventes, identiteBoutique, fcfa } from '../outils/api'
import { exporterClasseur } from '../outils/xlsx'
import { exporterPdf, montant } from '../outils/pdf'
import { ListeSquelette } from '../composants/Squelette'
import { iconeProduit, fondProduit } from '../outils/iconeProduit'
import Avatar from '../composants/Avatar'
import ErreurChargement from '../composants/ErreurChargement'
import { useErreurChargement } from '../outils/erreursChargement'
import { useProduits, LISTE_VIDE } from '../outils/requetes'

export default function Inventaire() {
  // Catalogue partagé : déjà en mémoire si l'on vient de Stock ou de Vendre.
  const produits = useProduits().data ?? LISTE_VIDE
  // Quantité vendue par produit, calculée par le serveur (et non plus en
  // téléchargeant tout l'historique des ventes).
  const [vendues, definirVendues] = useState<Record<number, number>>({})
  const [recherche, definirRecherche] = useState('')
  const [chargement, definirChargement] = useState(true)
  const { erreur, surveiller, effacer } = useErreurChargement()

  const charger = () => {
    effacer()
    Promise.all([
      surveiller(Ventes.quantitesParProduit().then((lignes) => definirVendues(Object.fromEntries(lignes.map((l) => [l.produit_id, l.quantite]))))),
    ]).finally(() => definirChargement(false))
  }
  useEffect(() => { charger() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const lignes = useMemo(() => produits.filter((p) => p.nom.toLowerCase().includes(recherche.toLowerCase())).map((p) => {
    const vendus = vendues[p.id] || 0
    const benefice = (Number(p.prix_vente) - Number(p.prix_achat)) * vendus
    const marge = Number(p.prix_vente) > 0 ? ((Number(p.prix_vente) - Number(p.prix_achat)) / Number(p.prix_vente)) * 100 : 0
    return { p, vendus, benefice, marge }
  }), [produits, vendues, recherche])

  const totaux = useMemo(() => ({
    valeur: produits.reduce((a, p) => a + Number(p.prix_achat) * p.stock, 0),
    benefice: lignes.reduce((a, l) => a + l.benefice, 0),
    produits: produits.length,
    vendus: Object.values(vendues).reduce((a, b) => a + b, 0),
  }), [produits, lignes, vendues])

  /* Le produit qui rapporte le plus PAR VENTE. C'est l'information qu'un
     commerçant cherche dans un inventaire : sur quoi pousser. Elle était
     noyée dans une colonne « marge » de plus. */
  const meilleure = useMemo(() => {
    const eligibles = lignes.filter((l) => Number(l.p.prix_vente) > 0 && Number(l.p.prix_achat) > 0)
    if (eligibles.length === 0) return null
    return eligibles.reduce((meilleure, l) => (l.marge > meilleure.marge ? l : meilleure))
  }, [lignes])

  const sousTitre = `${identiteBoutique().nom} — ${lignes.length} référence(s) — édité le ${new Date().toLocaleDateString('fr-FR')}`

  const exporterExcel = () => exporterClasseur('inventaire-samacommerce', {
    onglet: 'Inventaire',
    titre: '📋 Inventaire & marges',
    sousTitre,
    colonnes: [
      { entete: 'Produit', largeur: 32 },
      { entete: "Prix d'achat", largeur: 14, type: 'montant' },
      { entete: 'Prix de vente', largeur: 14, type: 'montant' },
      { entete: 'Stock', largeur: 10, type: 'nombre' },
      { entete: 'Vendus', largeur: 10, type: 'nombre' },
      { entete: 'Valeur stock', largeur: 15, type: 'montant' },
      { entete: 'Bénéfice', largeur: 14, type: 'montant' },
      { entete: 'Marge', largeur: 10, type: 'pourcentage' },
    ],
    lignes: lignes.map(({ p, vendus, benefice, marge }) => [
      p.nom, Number(p.prix_achat), Number(p.prix_vente), p.stock, vendus,
      Number(p.prix_achat) * p.stock, Math.round(benefice), Number(marge.toFixed(1)),
    ]),
    totaux: ['TOTAL', null, null, null, totaux.vendus, totaux.valeur, Math.round(totaux.benefice), null],
  })

  const exporterInventairePdf = () => exporterPdf('inventaire-samacommerce', {
    titre: 'Inventaire',
    sousTitre,
    boutique: identiteBoutique(),
    synthese: [
      { libelle: 'Valeur du stock', valeur: montant(totaux.valeur) },
      { libelle: 'Bénéfice réalisé', valeur: montant(totaux.benefice), teinte: 'vert' },
      { libelle: 'Articles vendus', valeur: String(totaux.vendus), teinte: 'orange' },
    ],
    colonnes: ['Produit', 'Achat', 'Vente', 'Stock', 'Vendus', 'Bénéfice', 'Marge'],
    lignes: lignes.map(({ p, vendus, benefice, marge }) => [
      p.nom, montant(Number(p.prix_achat)), montant(Number(p.prix_vente)), String(p.stock), String(vendus), montant(benefice), `${marge.toFixed(0)} %`,
    ]),
    pied: ['TOTAL', '', '', '', String(totaux.vendus), montant(totaux.benefice), ''],
    alignesADroite: [1, 2, 3, 4, 5, 6],
  })

  return (
    <>
      <div className="page-entete">
        <h2>📋 Inventaire</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="bouton-pdf" style={{ background: '#ECFDF5', color: 'var(--vert)' }} onClick={exporterExcel} disabled={lignes.length === 0}>📊 Excel</button>
          <button className="bouton-pdf" onClick={exporterInventairePdf} disabled={lignes.length === 0}>📄 PDF</button>
        </div>
      </div>

      <div className="grille-stats">
        <div className="stat stat-bleu"><div className="stat-valeur">{chargement ? '—' : fcfa(totaux.valeur)}</div><div className="stat-libelle">📦 Valeur du stock</div></div>
        <div className="stat stat-vert"><div className="stat-valeur">{chargement ? '—' : fcfa(totaux.benefice)}</div><div className="stat-libelle">💰 Bénéfice réalisé</div></div>
        <div className="stat stat-violet"><div className="stat-valeur">{chargement ? '—' : totaux.produits}</div><div className="stat-libelle">🏷️ Produits</div></div>
        <div className="stat stat-jaune"><div className="stat-valeur">{chargement ? '—' : totaux.vendus}</div><div className="stat-libelle">🛒 Articles vendus</div></div>
      </div>

      {!chargement && meilleure && (
        <div className="bandeau-couleur">
          <span className="bandeau-icone" aria-hidden="true">🏆</span>
          <span style={{ minWidth: 0 }}>
            <span className="bandeau-titre" style={{ display: 'block' }}>Meilleure marge : {meilleure.p.nom}</span>
            <span className="bandeau-sous-titre" style={{ display: 'block' }}>
              {fcfa(Number(meilleure.p.prix_achat))} → {fcfa(Number(meilleure.p.prix_vente))} l'unité
            </span>
          </span>
          <span className="case-code" style={{ marginLeft: 'auto', minWidth: 58, fontSize: 16 }}>+{meilleure.marge.toFixed(0)} %</span>
        </div>
      )}

      <input className="barre-recherche" placeholder="🔍 Rechercher un produit..." value={recherche} onChange={(e) => definirRecherche(e.target.value)} />

      {chargement && <ListeSquelette nombre={5} />}
      {!chargement && erreur && <ErreurChargement erreur={erreur} surReessai={charger} />}
      {!chargement && !erreur && lignes.length === 0 && (
        <div className="etat-vide">
          <div className="vide-icone">📋</div>
          <div className="vide-texte">{produits.length === 0 ? 'Rien à inventorier' : 'Aucun résultat'}</div>
          <div className="vide-sous-titre">{produits.length === 0 ? 'Ajoutez des produits au stock pour voir vos marges' : 'Essayez un autre nom'}</div>
        </div>
      )}

      {/* Sur téléphone la lecture se fait en cartes : un tableau à 7 colonnes
          impose un défilement horizontal illisible. Le pictogramme du produit
          rend chaque ligne identifiable sans lire son nom. */}
      {!chargement && lignes.map(({ p, vendus, benefice, marge }) => (
        <div key={p.id} className="carte ligne-inventaire">
          <Avatar photo={p.photo} icone={iconeProduit(p.nom)} nom={p.nom} taille={42} rayon={13} fond={fondProduit(p.nom)} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="fiche-nom">{p.nom}</div>
            <div className="fiche-sous-titre">🏷️ {fcfa(Number(p.prix_achat))} → {fcfa(Number(p.prix_vente))} · 🛒 {vendus} vendu(s)</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="police-titre" style={{ fontWeight: 800, color: benefice >= 0 ? 'var(--vert)' : 'var(--rouge)' }}>{fcfa(benefice)}</div>
            <span className={`produit-stock-pilule ${p.stock <= 0 ? 'pilule-critique' : p.stock <= 5 ? 'pilule-bas' : 'pilule-ok'}`}>
              📦 {p.stock} · {marge.toFixed(0)} %
            </span>
          </div>
        </div>
      ))}
    </>
  )
}
