import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { Clients, Produits, Ventes, Ia, identiteBoutique, fcfa, lireUtilisateur, infosAffichage, type Categorie, type ClientPourVente, type ScoreCredit, type Produit } from '../outils/api'
import { impressionAutoActive } from '../outils/modules'
import AnneauScore from '../composants/AnneauScore'
// Le scanner (html5-qrcode, ~370 Ko) n'est chargé qu'à l'ouverture de la caméra.
const ScannerCodeBarres = lazy(() => import('../composants/ScannerCodeBarres'))

/** Client rattaché à la vente : fiche existante, nouveau nom, ou personne. */
type ClientVente = { id: number | null; nom: string; telephone: string | null }
/** Données d'une vente à crédit. */
type DonneesCredit = { client_id: number | null; nom_client: string; telephone_client: string | null; date_echeance: string }
import { demanderSaisie, bulle } from '../outils/bulles'
import { vibration } from '../outils/vibrations'
import { GrilleSquelette } from '../composants/Squelette'
import FenetreRecu from '../composants/FenetreRecu'
import { pluieDeConfettis } from '../outils/celebrer'
import { mettreEnFile, uuid, type VenteEnAttente } from '../outils/fileHorsLigne'
import { iconeProduit, fondProduit } from '../outils/iconeProduit'
import { envolVersPanier } from '../outils/envolVersPanier'
import Avatar from '../composants/Avatar'
import { ouvrirWhatsapp, messageRecu } from '../outils/whatsapp'
import {
  type LignePanier, facteurLigne, nombreLigne, totalLigne, totalReferenceLigne, coutLigne, libelleLigne, prixParAffichage, texteQuantite, totalPanier,
} from '../outils/panier'
import ErreurChargement from '../composants/ErreurChargement'
import { decrireErreur } from '../outils/erreursChargement'
import { useProduits, useCategories, useRafraichirCatalogue, LISTE_VIDE } from '../outils/requetes'

export default function Vente() {
  /* Catalogue partagé avec Stock (outils/requetes) : l'aller-retour Vendre <->
     Stock, la boucle la plus fréquente du comptoir, ne recharge plus rien. */
  const requeteProduits = useProduits()
  const requeteCategories = useCategories()
  const produits = requeteProduits.data ?? LISTE_VIDE
  const categories = requeteCategories.data ?? LISTE_VIDE
  const [categorieActive, definirCategorieActive] = useState<number | 'tous'>('tous')
  const [recherche, definirRecherche] = useState('')
  const [panier, definirPanier] = useState<LignePanier[]>([])
  const [paiementOuvert, definirPaiementOuvert] = useState(false)
  const [creditOuvert, definirCreditOuvert] = useState(false)
  const [derniereVente, definirDerniereVente] = useState<LignePanier[] | null>(null)
  const [dernierMoyen, definirDernierMoyen] = useState<string | null>(null)
  const [recuOuvert, definirRecuOuvert] = useState(false)
  const [ajoutOuvert, definirAjoutOuvert] = useState(false)
  const chargement = requeteProduits.isPending
  /* Même piège que dans Stock, en PIRE ici : l'erreur REMPLAÇAIT la grille,
     donc un rafraîchissement raté rendait le catalogue invisible au comptoir
     alors qu'il était chargé. react-query garde les dernières données valides —
     on les affiche, et l'échec se signale par un bandeau discret au-dessus. */
  const aDesDonnees = requeteProduits.data !== undefined
  const erreur = decrireErreur(requeteProduits.error ?? requeteCategories.error)
  const [client, definirClient] = useState<ClientVente | null>(null)
  const [choixClientOuvert, definirChoixClientOuvert] = useState(false)
  const [clients, definirClients] = useState<ClientPourVente[]>([])
  const [scan, definirScan] = useState(false)

  /* Rappelé après CHAQUE vente : un stock périmé au comptoir ferait vendre
     un article qui n'existe plus. */
  const recharger = useRafraichirCatalogue()
  // Fichier clients allégé : sert à rattacher la vente à un habitué.
  useEffect(() => { Clients.pourVente().then(definirClients).catch(() => {}) }, [])

  /* Scan au comptoir : le code-barres identifie le produit à coup sûr, même
     quand deux articles se ressemblent. S'il est inconnu, on retombe sur la
     recherche textuelle plutôt que de ne rien faire. */
  const surLecture = (code: string) => {
    definirScan(false)
    const trouve = produits.find((p) => (p.code_barres || '') === code)
    if (trouve) { ajouterAuPanier(trouve); bulle(`${trouve.nom} ajouté 🛒`, 'succes') }
    else { definirRecherche(code); bulle('Code inconnu — produit non trouvé', 'erreur') }
  }

  const estEmploye = !!lireUtilisateur()?.est_employe
  const negociableDe = (p: Produit) => p.negociable ?? categories.find((c) => c.id === p.categorie_id)?.negociable ?? false
  /** Emoji de la catégorie : sert de repli quand le nom n'est pas reconnu. */
  const emojiCategorie = (p: Produit) => categories.find((c) => c.id === p.categorie_id)?.emoji

  const visibles = (categorieActive === 'tous' ? produits : produits.filter((p) => p.categorie_id === categorieActive))
    .filter((p) => p.nom.toLowerCase().includes(recherche.toLowerCase()) || (p.code_barres || '').includes(recherche))
  const total = useMemo(() => totalPanier(panier), [panier])

  const ajouterAuPanier = (p: Produit, e?: React.MouseEvent) => {
    if (p.stock <= 0) return alert('Stock épuisé')
    vibration.toucher()
    envolVersPanier((e?.currentTarget as HTMLElement) ?? null, '.carte-titre') // 3.4 — ajout balistique
    definirPanier((liste) => {
      const existante = liste.find((l) => l.produit.id === p.id && l.conditionnement === null)
      if (existante) return liste.map((l) => l === existante ? { ...l, quantiteBase: l.quantiteBase + infosAffichage(p)[1] } : l)
      return [...liste, { produit: p, conditionnement: null, quantiteBase: infosAffichage(p)[1], prixReel: Math.round(Number(p.prix_vente)) }]
    })
  }
  const modifierLigne = (indice: number, modification: Partial<LignePanier>) => definirPanier((liste) => liste.map((l, i) => i === indice ? { ...l, ...modification } : l))
  const retirerLigne = (indice: number) => definirPanier((liste) => liste.filter((_, i) => i !== indice))

  /** Champs client envoyés avec chaque ligne de vente. */
  const champsClient = (credit?: DonneesCredit) => ({
    client_id: credit?.client_id ?? client?.id ?? null,
    nom_client: credit?.nom_client ?? client?.nom ?? null,
    telephone_client: credit?.telephone_client ?? client?.telephone ?? null,
  })

  // T11 — enregistre le panier dans la file hors ligne (IndexedDB).
  const mettreEnFileHorsLigne = async (moyen: string, credit?: DonneesCredit) => {
    for (const ligne of panier) {
      const vente: VenteEnAttente = {
        uuid_appareil: uuid(),
        produit_id: ligne.produit.id,
        conditionnement_id: ligne.conditionnement?.id ?? null,
        quantite_base: ligne.quantiteBase,
        prix_reel: ligne.prixReel,
        moyen_paiement: moyen,
        ...champsClient(credit),
        cree_le: new Date().toISOString(),
        libelle: `${ligne.produit.nom} ${texteQuantite(ligne)} — ${fcfa(totalLigne(ligne))}`,
        ...(credit ?? {}),
      }
      await mettreEnFile(vente)
    }
    vibration.reussite()
    definirDerniereVente(panier); definirDernierMoyen(moyen); definirPanier([]); definirPaiementOuvert(false); definirCreditOuvert(false)
    bulle('📴 Vente enregistrée hors-ligne — sera synchronisée au retour du réseau', 'info')
  }

  const finaliser = async (moyen: string, credit?: DonneesCredit) => {
    // Hors ligne d'emblée → file d'attente locale (aucune vente perdue).
    if (!navigator.onLine) return mettreEnFileHorsLigne(moyen, credit)
    try {
      for (const ligne of panier) {
        await Ventes.creer({ produit_id: ligne.produit.id, conditionnement_id: ligne.conditionnement?.id ?? null, quantite_base: ligne.quantiteBase, prix_reel: ligne.prixReel, moyen_paiement: moyen, ...champsClient(credit), date_echeance: credit?.date_echeance ?? null })
      }
      vibration.reussite()
      pluieDeConfettis() // Design 3.4 — célébration d'encaissement
      definirDerniereVente(panier); definirDernierMoyen(moyen); definirPanier([]); definirPaiementOuvert(false); definirCreditOuvert(false); recharger()
      /* Impression automatique (option) : le reçu s'ouvre et part à
         l'imprimante sans un geste de plus — utile aux boutiques équipées,
         invisible pour les autres. */
      if (impressionAutoActive()) {
        definirRecuOuvert(true)
        setTimeout(() => window.print(), 350)
      }
    } catch (e: any) {
      // Erreur RÉSEAU (pas de réponse du serveur) → on bascule en file hors ligne.
      if (!e?.response) return mettreEnFileHorsLigne(moyen, credit)
      definirPaiementOuvert(false); definirCreditOuvert(false)
      bulle(e?.response?.data?.erreur || 'Erreur lors de la vente', 'erreur')
    }
  }

  /* Reçu WhatsApp : gabarit commun (outils/whatsapp.ts) — en-tête boutique avec
     son numéro, lignes pictogrammées, total en gras, moyen de paiement. Le
     numéro du client est normalisé au format international, sinon WhatsApp
     répond « numéro invalide » et le commerçant croit l'application cassée. */
  const recuWhatsapp = async () => {
    if (!derniereVente) return
    const telephone = await demanderSaisie('Numéro WhatsApp du client (ex: 77 123 45 67) :', '')
    if (!telephone) return
    ouvrirWhatsapp(telephone, messageRecu(identiteBoutique(), {
      lignes: derniereVente.map((l) => ({ libelle: `${l.produit.nom} ${texteQuantite(l)}`, total: totalLigne(l) })),
      total: derniereVente.reduce((s, l) => s + totalLigne(l), 0),
      paiement: dernierMoyen,
    }))
  }

  return (
    <>
      <div className="page-entete"><h2>💳 Vendre</h2></div>

      <div className="vente-disposition">
        <div className="vente-col-principale">
          <div className="section-libelle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Choisir produits
            <button className="pastille-douce" style={{ background: 'var(--marque-teinte)', color: 'var(--marque-fonce)' }} onClick={() => definirAjoutOuvert(true)}>＋ Produit</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="barre-recherche" style={{ flex: 1 }} placeholder="🔍 Chercher un produit" value={recherche} onChange={(e) => definirRecherche(e.target.value)} />
            {/* Scanner : ajoute directement l'article au panier. */}
            <button className="bouton-principal" style={{ padding: '0 14px' }} aria-label="Scanner un code-barres" onClick={() => definirScan(true)}>📷</button>
          </div>
          {erreur && aDesDonnees && <ErreurChargement erreur={erreur} surReessai={recharger} compacte />}
          <div className="puces">
            <button className={`puce ${categorieActive === 'tous' ? 'actif' : ''}`} onClick={() => definirCategorieActive('tous')}>Tous</button>
            {categories.map((c) => <button key={c.id} className={`puce ${categorieActive === c.id ? 'actif' : ''}`} onClick={() => definirCategorieActive(c.id)}>{c.emoji} {c.nom}</button>)}
          </div>
          {chargement
            ? <GrilleSquelette nombre={6} />
            : erreur && !aDesDonnees
              ? <ErreurChargement erreur={erreur} surReessai={recharger} />
            : visibles.length === 0
              ? <div className="etat-vide"><div className="vide-icone">🔍</div><div className="vide-sous-titre">Aucun produit trouvé</div></div>
              : (
                <div className="vente-grille">
                  {visibles.map((p) => {
                    const [libelle, facteur] = infosAffichage(p)
                    const pesable = (p.unite_base || 'piece') !== 'piece'
                    const stockAffiche = p.stock / facteur
                    return (
                    <button key={p.id} className="vente-carte" disabled={p.stock <= 0} onClick={(e) => ajouterAuPanier(p, e)}
                      title={`${p.nom} — ${fcfa(p.prix_vente)}`}>
                      {/* Le pictogramme domine : on reconnaît la marchandise sans lire. */}
                      <Avatar photo={p.photo} icone={iconeProduit(p.nom, emojiCategorie(p))} nom={p.nom}
                        taille={62} rayon={18} fond={fondProduit(p.nom)} className="v-icone-vignette" />
                      <span className="v-corps">
                        <span className="v-nom">{p.nom}</span>
                        <span className="v-prix">{fcfa(p.prix_vente)}{pesable && <small> /{libelle}</small>}</span>
                      </span>
                      {/* Pastille de stock : la COULEUR porte l'information, le
                          nombre la précise. Rouge = il n'y en a presque plus. */}
                      <span className={`v-stock ${stockAffiche <= 0 ? 'est-epuise' : stockAffiche <= 5 ? 'est-bas' : 'est-ok'}`}>
                        {p.stock <= 0 ? '✕' : Number.isInteger(stockAffiche) ? stockAffiche : stockAffiche.toFixed(1)}
                      </span>
                      {negociableDe(p) && <span className="v-etiquette" title="Prix négociable">💬</span>}
                    </button>
                    )
                  })}
                </div>
              )}
        </div>

        <div className="vente-col-cote">
          {/* Client de la vente : facultatif au comptant, il donne l'historique
              d'achat et rend le score de crédit fiable. */}
          <button className={`puce-client ${client ? 'allume' : ''}`} onClick={() => definirChoixClientOuvert(true)}>
            <span className="puce-client-icone">{client ? '👤' : '🙋'}</span>
            <span className="puce-client-corps">
              <b>{client ? client.nom : 'Client de passage'}</b>
              <small>{client ? (client.telephone || 'Touchez pour changer') : 'Touchez pour choisir un client'}</small>
            </span>
            <span className="puce-client-aller">›</span>
          </button>

          <div className="carte" style={{ marginTop: 0 }}>
            <div className="carte-titre">🛒 Panier {panier.length > 0 && <span className="produit-cat-pastille" style={{ marginLeft: 'auto' }}>{panier.length}</span>}</div>
            {panier.length === 0
              ? <div className="etat-vide" style={{ padding: '16px' }}><div className="vide-icone">🛒</div><div className="vide-sous-titre">Votre panier est vide</div></div>
              : panier.map((l, indice) => (
                <LigneDuPanier key={indice} ligne={l} negociable={negociableDe(l.produit)} estEmploye={estEmploye} surModification={(m) => modifierLigne(indice, m)} surRetrait={() => retirerLigne(indice)} />
              ))}
          </div>

          {derniereVente && (
            <button className="bouton-valider" style={{ width: '100%', marginBottom: 10 }} onClick={() => definirRecuOuvert(true)}>🧾 Voir le reçu</button>
          )}

          <div className="vente-collante">
            <div className="barre-total"><span className="barre-total-libelle">TOTAL</span><span className="barre-total-montant">{fcfa(total)}</span></div>
            <button className="bouton-encaisser" disabled={panier.length === 0} style={{ opacity: panier.length === 0 ? 0.5 : 1 }} onClick={() => definirPaiementOuvert(true)}>💰 ENCAISSER</button>
          </div>
        </div>
      </div>

      {ajoutOuvert && <FenetreProduitRapide categories={categories} surFermeture={() => definirAjoutOuvert(false)} surCreation={() => { definirAjoutOuvert(false); recharger() }} />}
      {recuOuvert && derniereVente && <FenetreRecu lignes={derniereVente.map((l) => ({ nom: `${l.produit.nom} ${texteQuantite(l)}`, quantite: 1, prix: totalLigne(l) }))} surFermeture={() => definirRecuOuvert(false)} surWhatsapp={recuWhatsapp} />}
      {paiementOuvert && <FenetrePaiement total={total} surFermeture={() => definirPaiementOuvert(false)} surPaiement={(m) => finaliser(m)} surCredit={() => { definirPaiementOuvert(false); definirCreditOuvert(true) }} />}
      {creditOuvert && (
        <FenetreCredit
          total={total}
          client={client}
          clients={clients}
          surChoixClient={() => { definirCreditOuvert(false); definirChoixClientOuvert(true) }}
          surFermeture={() => definirCreditOuvert(false)}
          surValidation={(donnees) => finaliser('credit', donnees)}
        />
      )}
      {choixClientOuvert && (
        <ChoixClient
          clients={clients}
          actuel={client}
          surFermeture={() => definirChoixClientOuvert(false)}
          surChoix={(c) => { definirClient(c); definirChoixClientOuvert(false) }}
        />
      )}
      {scan && <Suspense fallback={null}><ScannerCodeBarres surLecture={surLecture} surFermeture={() => definirScan(false)} /></Suspense>}
    </>
  )
}

function LigneDuPanier({ ligne, negociable, estEmploye, surModification, surRetrait }: {
  ligne: LignePanier; negociable: boolean; estEmploye: boolean; surModification: (m: Partial<LignePanier>) => void; surRetrait: () => void
}) {
  const [mode, definirMode] = useState<'unitaire' | 'total'>('unitaire')
  const p = ligne.produit
  const [libelle, facteurAffichage] = infosAffichage(p)
  const facteur = facteurLigne(ligne)
  const pesable = !ligne.conditionnement && (p.unite_base || 'piece') !== 'piece'
  const total = totalLigne(ligne)
  const marge = total - coutLigne(ligne)
  const remise = totalReferenceLigne(ligne) - total
  const sousLePlancher = p.prix_min != null && prixParAffichage(ligne) < p.prix_min
  const aPerte = marge < 0

  const choisirConditionnement = (valeur: string) => {
    const c = valeur ? (p.conditionnements || []).find((x) => String(x.id) === valeur) || null : null
    surModification({ conditionnement: c, quantiteBase: c ? c.facteur : facteurAffichage, prixReel: c ? c.prix : Math.round(Number(p.prix_vente)) })
  }
  const definirNombre = (n: number) => { if (n <= 0) return surRetrait(); surModification({ quantiteBase: n * facteur }) }
  const definirPoids = (v: string) => surModification({ quantiteBase: Math.round(Math.max(0, Number(v) || 0) * facteurAffichage) })
  const definirPrix = (v: string) => {
    const n = Math.max(0, Number(v) || 0)
    if (mode === 'unitaire') surModification({ prixReel: Math.round(n) })
    else surModification({ prixReel: ligne.quantiteBase > 0 ? Math.round(n * facteur / ligne.quantiteBase) : ligne.prixReel })
  }

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--trait-doux)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Le pictogramme suit le produit jusque dans le panier. */}
        <Avatar photo={p.photo} icone={iconeProduit(p.nom)} nom={p.nom} taille={34} rayon={11} fond={fondProduit(p.nom)} />
        <div className="police-titre" style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{p.nom}</div>
        <div className="police-titre" style={{ fontWeight: 800, color: 'var(--vert-fonce)' }}>{fcfa(total)}</div>
        <button className="bouton-compact bouton-compact-supprimer" style={{ padding: '4px 8px' }} aria-label="Retirer" onClick={surRetrait}>✕</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        {(p.conditionnements?.length ?? 0) > 0 && (
          <select value={ligne.conditionnement ? String(ligne.conditionnement.id) : ''} onChange={(e) => choisirConditionnement(e.target.value)} style={{ padding: '6px 8px', borderRadius: 9, border: '1px solid var(--trait)', background: 'var(--fond)', color: 'var(--encre)', fontSize: 12.5 }}>
            <option value="">Détail ({libelle})</option>
            {(p.conditionnements || []).map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
          </select>
        )}
        {pesable ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" inputMode="decimal" step="0.05" value={nombreLigne(ligne)} onChange={(e) => definirPoids(e.target.value)} style={{ width: 84, padding: '6px 8px', borderRadius: 9, border: '1px solid var(--trait)', background: 'var(--fond)', color: 'var(--encre)' }} />
            <span style={{ fontSize: 12.5, color: 'var(--attenue)' }}>{libelle}</span>
          </div>
        ) : (
          <div className="stock-reglage">
            <button className="stock-bouton moins" aria-label="Diminuer" onClick={() => definirNombre(nombreLigne(ligne) - 1)}>−</button>
            <span className="stock-nombre">{nombreLigne(ligne)}</span>
            <button className="stock-bouton plus" aria-label="Augmenter" onClick={() => definirNombre(nombreLigne(ligne) + 1)}>+</button>
          </div>
        )}
      </div>

      {negociable && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <button className="pastille-douce" style={{ fontSize: 11, padding: '5px 8px' }} onClick={() => definirMode(mode === 'unitaire' ? 'total' : 'unitaire')}>{mode === 'unitaire' ? `Prix / ${libelleLigne(ligne)}` : 'Prix total'}</button>
          <input type="number" inputMode="numeric" value={mode === 'unitaire' ? ligne.prixReel : total} onChange={(e) => definirPrix(e.target.value)} style={{ width: 92, padding: '6px 8px', borderRadius: 9, border: `1px solid ${sousLePlancher || aPerte ? 'var(--danger)' : 'var(--trait)'}`, background: 'var(--fond)', color: 'var(--encre)' }} />
          {remise > 0 && <span style={{ fontSize: 11.5, color: 'var(--accent)' }}>remise {fcfa(remise)}</span>}
        </div>
      )}

      {/* Design 3.3 — « la marge qui respire » : verte et calme si saine, ambre
          qui pulse quand elle fond, rouge qui tremble sous le plancher. */}
      {(() => {
        const ratio = total > 0 ? marge / total : 0
        const niveau = sousLePlancher || aPerte ? 'danger' : ratio < 0.12 ? 'attention' : 'ok'
        return (
          <div className={`marge-jauge marge-${niveau}`}>
            <div className="marge-piste"><div className="marge-remplissage" style={{ width: `${Math.max(4, Math.min(100, ratio * 100))}%` }} /></div>
            <div className="marge-infos">
              <span>marge {fcfa(marge)}</span>
              {sousLePlancher
                ? <span className="marge-alerte">⚠ sous plancher{estEmploye ? ' — refus à l’encaisse' : ''}</span>
                : aPerte ? <span className="marge-alerte">⚠ vente à perte</span> : null}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function FenetrePaiement({ total, surFermeture, surPaiement, surCredit }: { total: number; surFermeture: () => void; surPaiement: (m: string) => void; surCredit: () => void }) {
  // Le montant est affiché en grand : au comptoir, c'est l'information que le
  // commerçant annonce au client avant de choisir le moyen de paiement.
  return (
    <div className="fenetre-calque" onClick={surFermeture}>
      <div className="fenetre-boite" onClick={(e) => e.stopPropagation()}>
        <div className="fenetre-titre">Encaisser</div>

        <div className="paiement-montant">
          <span className="paiement-montant-libelle">Montant à encaisser</span>
          <span className="paiement-montant-valeur">{fcfa(total)}</span>
        </div>

        {/* Damier 2×2 : les quatre moyens tiennent sous le montant, sans faire
            défiler. Un pouce les atteint tous sans déplacer la main. */}
        <div className="modes-paiement-grille">
          <button className="mode-paiement mode-paiement-especes" onClick={() => surPaiement('especes')}>
            <span className="mode-paiement-icone" aria-hidden="true">💵</span>
            <span className="mode-paiement-corps"><span className="mode-paiement-titre">Espèces</span><span className="mode-paiement-sous-titre">Liquide</span></span>
          </button>

          <button className="mode-paiement" onClick={() => surPaiement('wave')}>
            <img src="/paiement/wave.png" alt="" width={30} height={30} loading="lazy" />
            <span className="mode-paiement-corps"><span className="mode-paiement-titre">Wave</span><span className="mode-paiement-sous-titre">Mobile</span></span>
          </button>

          <button className="mode-paiement" onClick={() => surPaiement('orange')}>
            <img src="/paiement/orange-money.png" alt="" width={30} height={30} loading="lazy" />
            <span className="mode-paiement-corps"><span className="mode-paiement-titre">Orange Money</span><span className="mode-paiement-sous-titre">Mobile</span></span>
          </button>

          <button className="mode-paiement mode-paiement-credit" onClick={surCredit}>
            <span className="mode-paiement-icone" aria-hidden="true">📝</span>
            <span className="mode-paiement-corps"><span className="mode-paiement-titre">Crédit</span><span className="mode-paiement-sous-titre">Plus tard</span></span>
          </button>
        </div>

        <button className="bouton-annuler" style={{ width: '100%', marginTop: 10 }} onClick={surFermeture}>Annuler</button>
      </div>
    </div>
  )
}

/** Choix du client de la vente : habitué du fichier, nouveau nom, ou personne. */
function ChoixClient({ clients, actuel, surFermeture, surChoix }: {
  clients: ClientPourVente[]
  actuel: ClientVente | null
  surFermeture: () => void
  surChoix: (c: ClientVente | null) => void
}) {
  const [recherche, definirRecherche] = useState('')
  const [nouveau, definirNouveau] = useState(false)
  const [nom, definirNom] = useState('')
  const [telephone, definirTelephone] = useState('')

  const trouves = clients.filter((c) => c.nom.toLowerCase().includes(recherche.toLowerCase()) || (c.telephone || '').includes(recherche))

  return (
    <div className="fenetre-calque" onClick={surFermeture}>
      <div className="fenetre-boite" onClick={(e) => e.stopPropagation()}>
        <div className="fenetre-titre">👤 Client de la vente</div>

        {nouveau ? (
          <>
            <div className="groupe-champ"><label>Nom du client</label><input value={nom} onChange={(e) => definirNom(e.target.value)} placeholder="Ex. Awa Ndiaye" autoFocus /></div>
            <div className="groupe-champ"><label>📞 Téléphone</label><input type="tel" inputMode="tel" value={telephone} onChange={(e) => definirTelephone(e.target.value)} placeholder="77 123 45 67" /></div>
            <p style={{ fontSize: 12, color: 'var(--attenue)', marginTop: -4 }}>
              Une fiche client sera créée automatiquement si la vente se fait à crédit.
            </p>
            <div className="fenetre-actions">
              <button className="bouton-annuler" onClick={() => definirNouveau(false)}>Retour</button>
              <button className="bouton-valider" disabled={!nom.trim()} onClick={() => surChoix({ id: null, nom: nom.trim(), telephone: telephone || null })}>Choisir</button>
            </div>
          </>
        ) : (
          <>
            <input className="barre-recherche" placeholder="🔍 Chercher un client..." value={recherche} onChange={(e) => definirRecherche(e.target.value)} />

            <button className="volet-element" onClick={() => surChoix(null)}>
              <span className="volet-icone" style={{ background: '#F3F4F6' }}>🙋</span>
              <div><h3>Client de passage</h3><p>Vente sans fiche client</p></div>
              {!actuel && <span className="volet-chevron">✅</span>}
            </button>

            <button className="volet-element" onClick={() => definirNouveau(true)}>
              <span className="volet-icone" style={{ background: '#EDE9FE' }}>➕</span>
              <div><h3>Nouveau client</h3><p>Saisir un nom et un téléphone</p></div>
              <span className="volet-chevron">›</span>
            </button>

            <div className="section-libelle" style={{ marginTop: 12 }}>Mes clients ({trouves.length})</div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {trouves.length === 0 && <div className="vide-sous-titre" style={{ padding: '10px 4px' }}>Aucun client enregistré</div>}
              {trouves.map((c) => (
                <button key={c.id} className="volet-element" onClick={() => surChoix({ id: c.id, nom: c.nom, telephone: c.telephone })}>
                  <Avatar nom={c.nom} taille={40} rayon={13} />
                  <div><h3>{c.nom}</h3><p>{c.telephone || 'sans téléphone'}</p></div>
                  {actuel?.id === c.id && <span className="volet-chevron">✅</span>}
                </button>
              ))}
            </div>
            <button className="bouton-annuler" style={{ width: '100%', marginTop: 10 }} onClick={surFermeture}>Fermer</button>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Vente à crédit.
 *
 * Un crédit est une dette : elle doit porter un NOM connu de la boutique,
 * sinon ni l'historique ni la relance ne fonctionnent. On exige donc un client
 * (choisi dans le fichier ou créé au vol) et on affiche le score de risque
 * calculé sur SES achats passés avant de valider.
 */
function FenetreCredit({ total, client, clients, surChoixClient, surFermeture, surValidation }: {
  total: number
  client: ClientVente | null
  clients: ClientPourVente[]
  surChoixClient: () => void
  surFermeture: () => void
  surValidation: (d: DonneesCredit) => void
}) {
  const [echeance, definirEcheance] = useState('')
  const [score, definirScore] = useState<ScoreCredit | null>(null)

  const RISQUE = {
    vert: { couleur: 'var(--vert)', fond: 'var(--succes-fond)', texte: 'Risque faible' },
    orange: { couleur: 'var(--attention)', fond: 'var(--attention-fond)', texte: 'Risque moyen' },
    rouge: { couleur: 'var(--danger)', fond: 'var(--danger-fond)', texte: 'Risque élevé' },
  } as const

  // Score dès qu'un client est choisi : on ne prête pas à l'aveugle.
  useEffect(() => {
    if (!client || total <= 0) { definirScore(null); return }
    const minuterie = setTimeout(() => {
      Ia.scoreCredit({ montant: total, date_echeance: echeance || null, client_id: client.id, nom_client: client.nom })
        .then(definirScore).catch(() => definirScore(null))
    }, 350)
    return () => clearTimeout(minuterie)
  }, [client, total, echeance])

  const connu = client?.id != null && clients.some((c) => c.id === client.id)

  return (
    <div className="fenetre-calque" onClick={surFermeture}>
      <div className="fenetre-boite" onClick={(e) => e.stopPropagation()}>
        <div className="fenetre-titre">📝 Vente à crédit</div>

        <div className="paiement-montant">
          <span className="paiement-montant-libelle">Montant à crédit</span>
          <span className="paiement-montant-valeur">{fcfa(total)}</span>
        </div>

        <button className={`puce-client ${client ? 'allume' : ''}`} onClick={surChoixClient} style={{ marginBottom: 12 }}>
          <span className="puce-client-icone">{client ? '👤' : '⚠️'}</span>
          <span className="puce-client-corps">
            <b>{client ? client.nom : 'Choisir le client'}</b>
            <small>{client ? (connu ? 'Client enregistré' : 'Nouveau client — fiche créée à la validation') : 'Obligatoire pour un crédit'}</small>
          </span>
          <span className="puce-client-aller">›</span>
        </button>

        {score && (
          <div className="score-carte" style={{ background: RISQUE[score.risque].fond, border: `1px solid ${RISQUE[score.risque].couleur}33` }}>
            <AnneauScore score={score.score} couleur={RISQUE[score.risque].couleur} libelle={RISQUE[score.risque].texte} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: RISQUE[score.risque].couleur, marginBottom: 4 }}>🤖 {RISQUE[score.risque].texte}</div>
              {score.raisons.map((r, i) => <div key={i} style={{ fontSize: 11.5, color: 'var(--attenue)' }}>• {r}</div>)}
            </div>
          </div>
        )}

        <div className="groupe-champ"><label>🗓️ À rembourser avant le</label><input type="date" value={echeance} onChange={(e) => definirEcheance(e.target.value)} /></div>

        <div className="fenetre-actions">
          <button className="bouton-annuler" onClick={surFermeture}>Annuler</button>
          <button className="bouton-valider" disabled={!client}
            onClick={() => client && surValidation({ client_id: client.id, nom_client: client.nom, telephone_client: client.telephone, date_echeance: echeance })}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

function FenetreProduitRapide({ categories, surFermeture, surCreation }: { categories: Categorie[]; surFermeture: () => void; surCreation: () => void }) {
  const [nom, definirNom] = useState(''); const [prix, definirPrix] = useState(''); const [stock, definirStock] = useState('')
  const [categorieId, definirCategorieId] = useState(''); const [envoi, definirEnvoi] = useState(false)

  const enregistrer = async () => {
    if (!nom.trim() || !prix) return alert('Nom et prix requis')
    definirEnvoi(true)
    try {
      await Produits.creer({ nom: nom.trim(), prix_vente: Number(prix), stock: Number(stock) || 0, categorie_id: categorieId ? Number(categorieId) : null })
      surCreation()
    } catch (e: any) { alert(e?.response?.data?.erreur || 'Erreur') } finally { definirEnvoi(false) }
  }

  return (
    <div className="fenetre-calque" onClick={surFermeture}>
      <div className="fenetre-boite" onClick={(e) => e.stopPropagation()}>
        <div className="fenetre-titre">➕ Nouveau produit</div>
        <div className="groupe-champ"><label>Nom</label><input value={nom} onChange={(e) => definirNom(e.target.value)} placeholder="Nom du produit" autoFocus /></div>
        <div className="groupe-champ"><label>Prix de vente (FCFA)</label><input type="number" inputMode="numeric" value={prix} onChange={(e) => definirPrix(e.target.value)} /></div>
        <div className="groupe-champ"><label>Stock initial</label><input type="number" inputMode="numeric" value={stock} onChange={(e) => definirStock(e.target.value)} placeholder="0" /></div>
        <div className="groupe-champ"><label>Catégorie</label>
          <select value={categorieId} onChange={(e) => definirCategorieId(e.target.value)}>
            <option value="">Sans catégorie</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.nom}</option>)}
          </select>
        </div>
        <div className="fenetre-actions">
          <button className="bouton-annuler" onClick={surFermeture}>Annuler</button>
          <button className="bouton-valider" onClick={enregistrer} disabled={envoi}>{envoi ? '…' : 'Ajouter'}</button>
        </div>
      </div>
    </div>
  )
}
