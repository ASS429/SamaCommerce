import { useEffect, useState, lazy, Suspense } from 'react'
import { Produits, identiteBoutique, fcfa, UNITE_AFFICHAGE, type Categorie, type Produit } from '../outils/api'
// Design 3.7 — html5-qrcode chargé en différé (uniquement à l'ouverture du scanner).
const ScannerCodeBarres = lazy(() => import('../composants/ScannerCodeBarres'))
import { demanderConfirmation } from '../outils/bulles'
import { vibration } from '../outils/vibrations'
import { ListeSquelette } from '../composants/Squelette'
import { iconeProduit, fondProduit } from '../outils/iconeProduit'
import Avatar from '../composants/Avatar'
import ChoixPhoto from '../composants/ChoixPhoto'
import { exporterClasseur } from '../outils/xlsx'
import { exporterPdf, montant } from '../outils/pdf'
import ErreurChargement from '../composants/ErreurChargement'
import { decrireErreur } from '../outils/erreursChargement'
import { useProduits, useCategories, useRafraichirCatalogue, CLES, LISTE_VIDE } from '../outils/requetes'
import { useQueryClient } from '@tanstack/react-query'

const CLE_TRI = 'samacommerce_tri_stock'

export default function Stock() {
  /* Produits et catégories viennent du cache partagé (outils/requetes) :
     revenir de Vendre ne les retélécharge plus. Voir le staleTime là-bas. */
  const requeteProduits = useProduits()
  const requeteCategories = useCategories()
  const clientRequetes = useQueryClient()
  const produits = requeteProduits.data ?? LISTE_VIDE
  const categories = requeteCategories.data ?? LISTE_VIDE
  const [filtre, definirFiltre] = useState<number | 'tous'>('tous')
  const [recherche, definirRecherche] = useState('')
  const [fenetreOuverte, definirFenetreOuverte] = useState(false)
  const [enEdition, definirEnEdition] = useState<Produit | null>(null)
  const [scan, definirScan] = useState(false)
  const chargement = requeteProduits.isPending
  /* react-query CONSERVE les dernières données valides quand un simple
     RAFRAÎCHISSEMENT échoue. Une requête ratée (API endormie une fois) laissait
     donc l'erreur enregistrée, et le grand bandeau s'affichait par-dessus une
     liste pourtant correcte — l'utilisateur croyait à une panne alors que ses
     produits étaient sous ses yeux.
     Règle : on n'alerte QUE si l'on n'a RIEN à montrer. Si des données sont
     affichées, l'échec devient un bandeau discret avec « Réessayer ». */
  const aDesDonnees = requeteProduits.data !== undefined
  const erreur = decrireErreur(requeteProduits.error ?? requeteCategories.error)
  const [tri, definirTri] = useState<string>(() => localStorage.getItem(CLE_TRI) || 'recents')

  const recharger = useRafraichirCatalogue()
  useEffect(() => { localStorage.setItem(CLE_TRI, tri) }, [tri])

  const nomCategorie = (id: number | null) => categories.find((c) => c.id === id)?.nom
  const emojiCategorie = (id: number | null) => categories.find((c) => c.id === id)?.emoji
  const filtres = produits
    .filter((p) => filtre === 'tous' || p.categorie_id === filtre)
    .filter((p) => p.nom.toLowerCase().includes(recherche.toLowerCase()) || (p.code_barres || '').includes(recherche))
    .sort((a, b) => {
      if (tri === 'nom') return a.nom.localeCompare(b.nom)
      if (tri === 'stock-croissant') return a.stock - b.stock
      if (tri === 'stock-decroissant') return b.stock - a.stock
      if (tri === 'prix-decroissant') return b.prix_vente - a.prix_vente
      return b.id - a.id // récents
    })

  const supprimer = async (p: Produit) => { if (await demanderConfirmation(`Supprimer « ${p.nom} » ?`, 'Supprimer')) { vibration.avertissement(); await Produits.supprimer(p.id); recharger() } }
  const ajusterStock = async (p: Produit, ecart: number) => {
    vibration.toucher()
    const suivant = Math.max(0, p.stock + ecart)
    // Retour immédiat : on corrige le cache partagé, pas un état local — sinon
    // Vendre continuerait d'afficher l'ancien stock.
    clientRequetes.setQueryData<Produit[]>(CLES.produits, (liste) =>
      (liste ?? []).map((x) => x.id === p.id ? { ...x, stock: suivant } : x))
    await Produits.modifier(p.id, { stock: suivant })
  }

  const classeStock = (s: number) => s <= 0 ? 'stock-critique' : s <= 5 ? 'stock-bas' : 'stock-ok'
  const classePilule = (s: number) => s <= 0 ? 'pilule-critique' : s <= 5 ? 'pilule-bas' : 'pilule-ok'

  /* Exports : le stock est le document que l'on montre au fournisseur ou au
     comptable. On exporte ce qui est À L'ÉCRAN (filtre et tri compris). */
  const lignesExport = () => filtres.map((p) => {
    const [libelle, facteur] = UNITE_AFFICHAGE[p.unite_base || 'piece'] || UNITE_AFFICHAGE.piece
    return { p, libelle, stockAffiche: p.stock / facteur }
  })
  const valeurStock = filtres.reduce((a, p) => a + Number(p.prix_achat) * p.stock, 0)

  const exporterExcel = () => exporterClasseur('stock-samacommerce', {
    onglet: 'Stock',
    titre: '📦 Inventaire du stock',
    sousTitre: `${identiteBoutique().nom} — ${filtres.length} référence(s) — édité le ${new Date().toLocaleDateString('fr-FR')}`,
    colonnes: [
      { entete: 'Produit', largeur: 30 }, { entete: 'Catégorie', largeur: 18 },
      { entete: 'Unité', largeur: 10 }, { entete: 'Stock', largeur: 12, type: 'nombre' },
      { entete: "Prix d'achat", largeur: 14, type: 'montant' }, { entete: 'Prix de vente', largeur: 14, type: 'montant' },
      { entete: 'Valeur stock', largeur: 15, type: 'montant' }, { entete: 'Code-barres', largeur: 18 },
    ],
    lignes: lignesExport().map(({ p, libelle, stockAffiche }) => [
      p.nom, nomCategorie(p.categorie_id) || 'Sans catégorie', libelle, stockAffiche,
      Number(p.prix_achat), Number(p.prix_vente), Number(p.prix_achat) * p.stock, p.code_barres || '',
    ]),
    totaux: ['TOTAL', '', '', null, null, null, valeurStock, ''],
  })

  const exporterListePdf = () => exporterPdf('stock-samacommerce', {
    titre: 'Stock',
    sousTitre: `${filtres.length} référence(s)${filtre !== 'tous' ? ` — ${nomCategorie(filtre as number) || ''}` : ''}`,
    boutique: identiteBoutique(),
    synthese: [
      { libelle: 'Références', valeur: String(filtres.length) },
      { libelle: 'Valeur du stock', valeur: montant(valeurStock), teinte: 'vert' },
      { libelle: 'Ruptures', valeur: String(filtres.filter((p) => p.stock <= 0).length), teinte: 'rouge' },
    ],
    colonnes: ['Produit', 'Catégorie', 'Stock', 'Achat', 'Vente'],
    lignes: lignesExport().map(({ p, libelle, stockAffiche }) => [
      p.nom, nomCategorie(p.categorie_id) || '—', `${stockAffiche} ${libelle}`, montant(Number(p.prix_achat)), montant(Number(p.prix_vente)),
    ]),
    pied: ['TOTAL', '', '', montant(valeurStock), ''],
    alignesADroite: [2, 3, 4],
  })

  return (
    <>
      <div className="page-entete">
        <h2>📦 Mon Stock</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="bouton-pdf" style={{ background: '#ECFDF5', color: 'var(--vert)' }} onClick={exporterExcel} disabled={filtres.length === 0}>📊 Excel</button>
          <button className="bouton-pdf" onClick={exporterListePdf} disabled={filtres.length === 0}>📄 PDF</button>
          <button className="bouton-principal" onClick={() => { definirEnEdition(null); definirFenetreOuverte(true) }}>+ Ajouter</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input className="barre-recherche" style={{ flex: 1 }} placeholder="🔍 Rechercher (nom ou code-barres)..." value={recherche} onChange={(e) => definirRecherche(e.target.value)} />
        <button className="bouton-principal" style={{ padding: '0 14px' }} onClick={() => definirScan(true)}>📷</button>
      </div>

      <div className="puces">
        <button className={`puce ${filtre === 'tous' ? 'actif' : ''}`} onClick={() => definirFiltre('tous')}>Tous</button>
        {categories.map((c) => (
          <button key={c.id} className={`puce ${filtre === c.id ? 'actif' : ''}`} onClick={() => definirFiltre(c.id)}>{c.emoji} {c.nom}</button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--attenue)' }}>Trier :</label>
        <select value={tri} onChange={(e) => definirTri(e.target.value)} style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--trait)', borderRadius: 11, background: 'var(--fond)', color: 'var(--encre)' }} aria-label="Trier les produits">
          <option value="recents">Plus récents</option>
          <option value="nom">Nom (A→Z)</option>
          <option value="stock-croissant">Stock (croissant)</option>
          <option value="stock-decroissant">Stock (décroissant)</option>
          <option value="prix-decroissant">Prix (décroissant)</option>
        </select>
      </div>

      {chargement && <ListeSquelette nombre={5} />}
      {!chargement && erreur && <ErreurChargement erreur={erreur} surReessai={recharger} compacte={aDesDonnees} />}
      {!chargement && !erreur && filtres.length === 0 && <div className="etat-vide"><div className="vide-icone">📦</div><div className="vide-texte">Aucun produit</div><div className="vide-sous-titre">Ajoutez votre premier produit</div></div>}

      {!chargement && filtres.map((p) => {
        const [libelle, facteur] = UNITE_AFFICHAGE[p.unite_base || 'piece'] || UNITE_AFFICHAGE.piece
        const stockAffiche = p.stock / facteur
        const texteStockAffiche = Number.isInteger(stockAffiche) ? String(stockAffiche) : stockAffiche.toFixed(2)
        const pesable = (p.unite_base || 'piece') !== 'piece'
        const texteStock = pesable ? `${texteStockAffiche} ${libelle}` : texteStockAffiche
        return (
        <div key={p.id} className={`produit-carte ${classeStock(stockAffiche)}`}>
          <div className="produit-carte-entete">
            <span className="produit-cat-pastille">{nomCategorie(p.categorie_id) || 'Sans catégorie'}</span>
            <span className={`produit-stock-pilule ${classePilule(stockAffiche)}`}>{texteStock} en stock</span>
          </div>
          <div className="produit-carte-corps produit-carte-corps--icone">
            {/* Photo du produit si le commerçant en a pris une, sinon le même
                pictogramme qu'au point de vente : l'article se reconnaît à
                l'identique dans tout l'outil. */}
            <Avatar photo={p.photo} icone={iconeProduit(p.nom, emojiCategorie(p.categorie_id))} nom={p.nom}
              taille={52} rayon={15} fond={fondProduit(p.nom)} className="produit-icone-vignette" />
            <div style={{ flex: 1, minWidth: 0 }}>
            <div className="produit-nom">{p.nom}{(p.conditionnements?.length ?? 0) > 0 && <span className="produit-cat-pastille" style={{ marginLeft: 6 }}>+ gros</span>}</div>
            {p.description && <div className="produit-description">{p.description}</div>}
            <div className="produit-prix">
              <span className="produit-prix-principal">{fcfa(p.prix_vente)}{pesable && <span style={{ fontSize: 12, fontWeight: 500 }}> /{libelle}</span>}</span>
              <span className="produit-prix-achat">achat {fcfa(p.prix_achat)}{pesable ? ` /${libelle}` : ''}</span>
              {p.prix_min != null && <span className="produit-prix-achat" style={{ color: 'var(--attention)' }}>plancher {fcfa(p.prix_min)}</span>}
            </div>
            </div>
          </div>
          <div className="produit-carte-actions">
            <div className="stock-reglage">
              <button className="stock-bouton moins" aria-label="Diminuer" onClick={() => ajusterStock(p, -facteur)}>−</button>
              <span className="stock-nombre">{texteStock}</span>
              <button className="stock-bouton plus" aria-label="Augmenter" onClick={() => ajusterStock(p, +facteur)}>+</button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="bouton-compact bouton-compact-modifier" onClick={() => { definirEnEdition(p); definirFenetreOuverte(true) }}>✏️ Modifier</button>
              <button className="bouton-compact bouton-compact-supprimer" onClick={() => supprimer(p)}>🗑️</button>
            </div>
          </div>
        </div>
        )
      })}

      {fenetreOuverte && <FenetreProduit produit={enEdition} categories={categories} surFermeture={() => definirFenetreOuverte(false)} surEnregistrement={() => { definirFenetreOuverte(false); recharger() }} />}
      {scan && <Suspense fallback={null}><ScannerCodeBarres surLecture={(code) => { definirRecherche(code); definirScan(false) }} surFermeture={() => definirScan(false)} /></Suspense>}
    </>
  )
}

function FenetreProduit({ produit, categories, surFermeture, surEnregistrement }: {
  produit: Produit | null; categories: Categorie[]; surFermeture: () => void; surEnregistrement: () => void
}) {
  const baseInitiale = produit?.unite_base ?? 'piece'
  const facteurInitial = (UNITE_AFFICHAGE[baseInitiale] || UNITE_AFFICHAGE.piece)[1]
  const [nom, definirNom] = useState(produit?.nom ?? '')
  const [categorieId, definirCategorieId] = useState(produit?.categorie_id?.toString() ?? '')
  const [uniteBase, definirUniteBase] = useState<string>(baseInitiale)
  const [prixAchat, definirPrixAchat] = useState(produit?.prix_achat?.toString() ?? '')
  const [prixVente, definirPrixVente] = useState(produit?.prix_vente?.toString() ?? '')
  const [stock, definirStock] = useState(produit ? String(produit.stock / facteurInitial) : '')
  const [prixMin, definirPrixMin] = useState(produit?.prix_min?.toString() ?? '')
  const [negociable, definirNegociable] = useState<string>(produit?.negociable === true ? 'oui' : produit?.negociable === false ? 'non' : 'herite')
  const [conditionnements, definirConditionnements] = useState<{ libelle: string; quantite: string; prix: string }[]>(
    produit?.conditionnements?.map((c) => ({ libelle: c.libelle, quantite: String(c.facteur / facteurInitial), prix: String(c.prix) })) ?? [],
  )
  const [description, definirDescription] = useState(produit?.description ?? '')
  const [codeBarres, definirCodeBarres] = useState(produit?.code_barres ?? '')
  const [photo, definirPhoto] = useState<string | null>(produit?.photo ?? null)
  const [scan, definirScan] = useState(false)
  const [envoi, definirEnvoi] = useState(false)

  const [libelleUnite, facteurUnite] = UNITE_AFFICHAGE[uniteBase] || UNITE_AFFICHAGE.piece

  const enregistrer = async () => {
    if (!nom.trim()) return alert('Le nom est requis')
    definirEnvoi(true)
    const charge = {
      nom: nom.trim(), categorie_id: categorieId ? Number(categorieId) : null, code_barres: codeBarres || null,
      prix_achat: Number(prixAchat) || 0, prix_vente: Number(prixVente) || 0,
      stock: Math.round((Number(stock) || 0) * facteurUnite),
      unite_base: uniteBase, prix_min: prixMin ? Number(prixMin) : null,
      negociable: negociable === 'oui' ? true : negociable === 'non' ? false : null,
      conditionnements: conditionnements.filter((c) => c.libelle.trim() && Number(c.quantite) > 0).map((c) => ({ libelle: c.libelle.trim(), facteur: Math.round(Number(c.quantite) * facteurUnite), prix: Number(c.prix) || 0 })),
      description: description || null,
      photo,
    }
    try { if (produit) await Produits.modifier(produit.id, charge as any); else await Produits.creer(charge as any); surEnregistrement() }
    catch (e: any) { alert(e?.response?.data?.erreur || 'Erreur') } finally { definirEnvoi(false) }
  }

  const ajouterConditionnement = () => definirConditionnements((c) => [...c, { libelle: '', quantite: '', prix: '' }])
  const modifierConditionnement = (i: number, champ: string, valeur: string) => definirConditionnements((c) => c.map((x, j) => j === i ? { ...x, [champ]: valeur } : x))

  return (
    <div className="fenetre-calque" onClick={surFermeture}>
      <div className="fenetre-boite" onClick={(e) => e.stopPropagation()}>
        <div className="fenetre-titre">{produit ? '✏️ Modifier le produit' : '📦 Nouveau produit'}</div>
        {/* Photo de l'article : c'est elle que le vendeur cherche des yeux au
            comptoir. Le pictogramme déduit du nom reste le repli. */}
        <ChoixPhoto valeur={photo} surChangement={definirPhoto} nom={nom} icone={iconeProduit(nom)} libelle="📷 Photo du produit (facultatif)" />
        <div className="groupe-champ"><label>Nom</label><input value={nom} onChange={(e) => definirNom(e.target.value)} placeholder="Nom du produit" /></div>
        <div className="groupe-champ"><label>Catégorie</label>
          <select value={categorieId} onChange={(e) => definirCategorieId(e.target.value)}>
            <option value="">Choisir une catégorie</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.nom}{c.negociable ? ' · négociable' : ''}</option>)}
          </select>
        </div>
        <div className="groupe-champ"><label>Mode de vente</label>
          <select value={uniteBase} onChange={(e) => definirUniteBase(e.target.value)}>
            <option value="piece">À la pièce</option>
            <option value="g">Au poids (kg, g…)</option>
            <option value="ml">Au volume (litre, ml…)</option>
          </select>
        </div>
        <div className="groupe-champ"><label>Prix d'achat (FCFA / {libelleUnite})</label><input type="number" inputMode="numeric" value={prixAchat} onChange={(e) => definirPrixAchat(e.target.value)} /></div>
        <div className="groupe-champ"><label>Prix de vente (FCFA / {libelleUnite})</label><input type="number" inputMode="numeric" value={prixVente} onChange={(e) => definirPrixVente(e.target.value)} /></div>
        <div className="groupe-champ"><label>Stock (en {libelleUnite})</label><input type="number" inputMode="decimal" value={stock} onChange={(e) => definirStock(e.target.value)} /></div>

        <div className="groupe-champ"><label>Négociation (marchandage)</label>
          <select value={negociable} onChange={(e) => definirNegociable(e.target.value)}>
            <option value="herite">Hériter de la catégorie</option>
            <option value="oui">Oui — prix négociable</option>
            <option value="non">Non — prix fixe</option>
          </select>
        </div>
        <div className="groupe-champ"><label>Prix plancher / {libelleUnite} (employés, optionnel)</label><input type="number" inputMode="numeric" value={prixMin} onChange={(e) => definirPrixMin(e.target.value)} placeholder="Vide = pas de plancher" /></div>

        <div className="groupe-champ">
          <label>Conditionnements de gros (optionnel)</label>
          {conditionnements.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input style={{ flex: 2 }} value={c.libelle} onChange={(e) => modifierConditionnement(i, 'libelle', e.target.value)} placeholder={`Sac, carton…`} />
              <input style={{ flex: 1 }} type="number" inputMode="decimal" value={c.quantite} onChange={(e) => modifierConditionnement(i, 'quantite', e.target.value)} placeholder={libelleUnite} title={`Contient combien de ${libelleUnite}`} />
              <input style={{ flex: 1 }} type="number" inputMode="numeric" value={c.prix} onChange={(e) => modifierConditionnement(i, 'prix', e.target.value)} placeholder="Prix" />
              <button type="button" className="bouton-compact bouton-compact-supprimer" onClick={() => definirConditionnements((liste) => liste.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button type="button" className="pastille-douce" onClick={ajouterConditionnement}>＋ Ajouter un conditionnement</button>
        </div>

        <div className="groupe-champ"><label>Code-barres (optionnel)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ flex: 1 }} value={codeBarres} onChange={(e) => definirCodeBarres(e.target.value)} placeholder="Scanner ou saisir" />
            <button type="button" className="bouton-principal" style={{ padding: '0 14px' }} onClick={() => definirScan(true)}>📷</button>
          </div>
        </div>
        <div className="groupe-champ"><label>Description (optionnel)</label><textarea value={description} onChange={(e) => definirDescription(e.target.value)} /></div>
        <div className="fenetre-actions">
          <button className="bouton-annuler" onClick={surFermeture}>Annuler</button>
          <button className="bouton-valider" onClick={enregistrer} disabled={envoi}>{produit ? 'Mettre à jour' : 'Ajouter'}</button>
        </div>
      </div>
      {scan && <Suspense fallback={null}><ScannerCodeBarres surLecture={(code) => { definirCodeBarres(code); definirScan(false) }} surFermeture={() => definirScan(false)} /></Suspense>}
    </div>
  )
}
