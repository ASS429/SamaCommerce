import { useEffect, useState } from 'react'
import { Commandes as ApiCommandes, Fournisseurs, Produits, identiteBoutique, fcfa, type Fournisseur, type Produit } from '../outils/api'
import { demanderConfirmation, bulle } from '../outils/bulles'
import { ListeSquelette } from '../composants/Squelette'
import Avatar from '../composants/Avatar'
import { iconeProduit, fondProduit } from '../outils/iconeProduit'
import { ouvrirWhatsapp, messageCommande } from '../outils/whatsapp'
import ErreurChargement from '../composants/ErreurChargement'
import { useErreurChargement } from '../outils/erreursChargement'

const STATUTS: Record<string, { icone: string; libelle: string; classe: string }> = {
  en_attente: { icone: '⏳', libelle: 'En attente', classe: 'pilule-bas' },
  recue: { icone: '✅', libelle: 'Reçue', classe: 'pilule-ok' },
}

export default function Commandes() {
  const [liste, definirListe] = useState<any[]>([])
  const [fenetreOuverte, definirFenetreOuverte] = useState(false)
  const [chargement, definirChargement] = useState(true)
  const { erreur, surveiller, effacer } = useErreurChargement()
  const [detail, definirDetail] = useState<any | null>(null)

  const charger = () => { effacer(); surveiller(ApiCommandes.lister().then(definirListe)).finally(() => definirChargement(false)) }
  useEffect(() => { charger() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const recevoir = async (c: any) => {
    if (!await demanderConfirmation('Marquer cette commande comme reçue ? Le stock sera mis à jour.')) return
    const d = await ApiCommandes.recevoir(c.id); bulle(d.message, 'succes'); charger()
  }
  const supprimer = async (c: any) => { if (await demanderConfirmation('Supprimer cette commande ?')) { await ApiCommandes.supprimer(c.id); charger() } }

  /* Envoi du bon de commande au fournisseur : on recharge le détail pour avoir
     les lignes (la liste n'en donne que le nombre). */
  const envoyer = async (c: any) => {
    try {
      const complete = await ApiCommandes.afficher(c.id)
      const lignes = (complete.lignes || []).map((l: any) => ({
        libelle: l.produit?.nom || `Produit #${l.produit_id}`,
        quantite: l.quantite,
        total: Number(l.quantite) * Number(l.prix_unitaire),
      }))
      ouvrirWhatsapp(c.telephone_fournisseur, messageCommande(identiteBoutique(), {
        fournisseur: c.nom_fournisseur, reference: c.id, lignes,
        total: Number(c.total), dateSouhaitee: c.date_prevue, notes: c.notes,
      }))
    } catch { bulle('Impossible de charger la commande', 'erreur') }
  }

  const voir = async (c: any) => {
    try { definirDetail(await ApiCommandes.afficher(c.id)) } catch { bulle('Impossible de charger la commande', 'erreur') }
  }

  return (
    <>
      <div className="page-entete"><h2>📋 Commandes</h2><button className="bouton-principal" data-guide="commandes-nouvelle" onClick={() => definirFenetreOuverte(true)}>+ Nouvelle</button></div>

      {chargement && <ListeSquelette nombre={3} />}
      {!chargement && erreur && <ErreurChargement erreur={erreur} surReessai={charger} />}
      {!chargement && !erreur && liste.length === 0 && (
        <div className="etat-vide">
          <div className="vide-icone">📋</div>
          <div className="vide-texte">Aucune commande</div>
          <div className="vide-sous-titre">Commandez du réappro à un fournisseur</div>
        </div>
      )}

      {!chargement && liste.map((c) => {
        const statut = STATUTS[c.statut] || { icone: '•', libelle: c.statut, classe: 'pilule-bas' }
        return (
          <div key={c.id} className="carte fiche">
            <div className="fiche-entete">
              <Avatar icone="🚚" nom={c.nom_fournisseur || 'Commande'} taille={48} />
              <div className="fiche-identite">
                <div className="fiche-nom">{c.nom_fournisseur || 'Sans fournisseur'}</div>
                <div className="fiche-sous-titre">📦 {c.nb_lignes} article(s) · 📅 {(c.cree_le || '').slice(0, 10)}</div>
                {c.date_prevue && <div className="fiche-sous-titre">🗓️ Attendue le {c.date_prevue.slice(0, 10)}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="produit-prix-principal" style={{ color: 'var(--principal)' }}>{fcfa(Number(c.total))}</div>
                <span className={`produit-stock-pilule ${statut.classe}`}>{statut.icone} {statut.libelle}</span>
              </div>
            </div>

            {c.notes && <div className="fiche-note">📝 {c.notes}</div>}

            <div className="fiche-actions">
              <button className="fa-bouton fa-aller" onClick={() => voir(c)}>👁️ Détail</button>
              {c.telephone_fournisseur && <button className="fa-bouton fa-whatsapp" onClick={() => envoyer(c)}>💬 Envoyer</button>}
              {c.statut !== 'recue' && <button className="fa-bouton fa-ok" onClick={() => recevoir(c)}>📥 Reçue (+ stock)</button>}
              <button className="fa-bouton fa-supprimer" onClick={() => supprimer(c)}>🗑️</button>
            </div>
          </div>
        )
      })}

      {detail && <FenetreDetail commande={detail} surFermeture={() => definirDetail(null)} />}
      {fenetreOuverte && <FenetreCommande surFermeture={() => definirFenetreOuverte(false)} surEnregistrement={() => { definirFenetreOuverte(false); charger() }} />}
    </>
  )
}

function FenetreDetail({ commande, surFermeture }: { commande: any; surFermeture: () => void }) {
  return (
    <div className="fenetre-calque" onClick={surFermeture}>
      <div className="fenetre-boite" onClick={(e) => e.stopPropagation()}>
        <div className="fenetre-titre">📋 Commande n°{commande.id}</div>
        <div className="fiche-sous-titre" style={{ marginBottom: 10 }}>🚚 {commande.fournisseur?.nom || 'Sans fournisseur'} · 📅 {(commande.cree_le || '').slice(0, 10)}</div>
        {(commande.lignes || []).map((l: any) => (
          <div key={l.id} className="ligne-article">
            <span className="produit-icone" style={{ width: 34, height: 34, fontSize: 18, borderRadius: 11, background: fondProduit(l.produit?.nom) }} aria-hidden="true">
              {iconeProduit(l.produit?.nom)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="police-titre" style={{ fontWeight: 700, fontSize: 13.5 }}>{l.produit?.nom || `Produit #${l.produit_id}`}</div>
              <div style={{ fontSize: 12, color: 'var(--attenue)' }}>× {l.quantite} · {fcfa(Number(l.prix_unitaire))} l'unité</div>
            </div>
            <div className="police-titre" style={{ fontWeight: 800 }}>{fcfa(Number(l.quantite) * Number(l.prix_unitaire))}</div>
          </div>
        ))}
        <div className="barre-total"><span className="barre-total-libelle">TOTAL</span><span className="barre-total-montant">{fcfa(Number(commande.total))}</span></div>
        <button className="bouton-annuler" style={{ width: '100%', marginTop: 10 }} onClick={surFermeture}>Fermer</button>
      </div>
    </div>
  )
}

type LigneCommande = { produit_id: number; quantite: number; prix_unitaire: number; nom: string }

function FenetreCommande({ surFermeture, surEnregistrement }: { surFermeture: () => void; surEnregistrement: () => void }) {
  const [fournisseurs, definirFournisseurs] = useState<Fournisseur[]>([])
  const [produits, definirProduits] = useState<Produit[]>([])
  const [fournisseurId, definirFournisseurId] = useState('')
  const [notes, definirNotes] = useState('')
  const [datePrevue, definirDatePrevue] = useState('')
  const [lignes, definirLignes] = useState<LigneCommande[]>([])
  const [envoi, definirEnvoi] = useState(false)

  useEffect(() => { Fournisseurs.lister().then(definirFournisseurs); Produits.lister().then(definirProduits) }, [])

  const ajouterLigne = (p: Produit) => {
    if (lignes.find((l) => l.produit_id === p.id)) return
    definirLignes([...lignes, { produit_id: p.id, quantite: 1, prix_unitaire: Number(p.prix_achat), nom: p.nom }])
  }
  const total = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0)

  const enregistrer = async () => {
    if (lignes.length === 0) return alert('Ajoutez au moins un article')
    definirEnvoi(true)
    try {
      await ApiCommandes.creer({
        fournisseur_id: fournisseurId ? Number(fournisseurId) : null, notes: notes || null, date_prevue: datePrevue || null,
        lignes: lignes.map(({ produit_id, quantite, prix_unitaire }) => ({ produit_id, quantite, prix_unitaire })),
      })
      surEnregistrement()
    } catch (e: any) { alert(e?.response?.data?.erreur || 'Erreur') } finally { definirEnvoi(false) }
  }

  /* Produits en rupture proposés en premier : c'est ce qu'on commande. */
  const tries = [...produits].sort((a, b) => a.stock - b.stock)

  return (
    <div className="fenetre-calque" onClick={surFermeture}>
      <div className="fenetre-boite" onClick={(e) => e.stopPropagation()}>
        <div className="fenetre-titre">📋 Nouvelle commande</div>
        <div className="groupe-champ"><label>🚚 Fournisseur</label>
          <select value={fournisseurId} onChange={(e) => definirFournisseurId(e.target.value)}>
            <option value="">Aucun</option>
            {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
        </div>
        <div className="groupe-champ"><label>📦 Ajouter un produit (les plus bas en stock d'abord)</label>
          <select value="" onChange={(e) => { const p = produits.find((x) => x.id === Number(e.target.value)); if (p) ajouterLigne(p) }}>
            <option value="">Choisir un produit…</option>
            {tries.map((p) => <option key={p.id} value={p.id}>{iconeProduit(p.nom)} {p.nom} — stock {p.stock}</option>)}
          </select>
        </div>

        {lignes.map((l, i) => (
          <div key={l.produit_id} className="ligne-article">
            <span className="produit-icone" style={{ width: 32, height: 32, fontSize: 17, borderRadius: 10, background: fondProduit(l.nom) }} aria-hidden="true">{iconeProduit(l.nom)}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, minWidth: 0 }}>{l.nom}</span>
            <input type="number" min={1} value={l.quantite} aria-label="Quantité"
              onChange={(e) => definirLignes(lignes.map((x, j) => j === i ? { ...x, quantite: Number(e.target.value) } : x))}
              style={{ width: 56, padding: 6, border: '1px solid var(--trait)', borderRadius: 8, background: 'var(--fond)', color: 'var(--encre)' }} />
            <input type="number" value={l.prix_unitaire} aria-label="Prix unitaire"
              onChange={(e) => definirLignes(lignes.map((x, j) => j === i ? { ...x, prix_unitaire: Number(e.target.value) } : x))}
              style={{ width: 72, padding: 6, border: '1px solid var(--trait)', borderRadius: 8, background: 'var(--fond)', color: 'var(--encre)' }} />
            <button className="bouton-compact bouton-compact-supprimer" aria-label="Retirer" onClick={() => definirLignes(lignes.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}

        <div className="groupe-champ" style={{ marginTop: 8 }}><label>🗓️ Livraison souhaitée</label><input type="date" value={datePrevue} onChange={(e) => definirDatePrevue(e.target.value)} /></div>
        <div className="groupe-champ"><label>📝 Notes</label><textarea value={notes} onChange={(e) => definirNotes(e.target.value)} /></div>
        <div className="barre-total"><span className="barre-total-libelle">TOTAL</span><span className="barre-total-montant">{fcfa(total)}</span></div>
        <div className="fenetre-actions"><button className="bouton-annuler" onClick={surFermeture}>Annuler</button><button className="bouton-valider" onClick={enregistrer} disabled={envoi}>Créer</button></div>
      </div>
    </div>
  )
}
