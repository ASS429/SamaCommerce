import { Fragment, useEffect, useState } from 'react'
import { Livraisons as ApiLivraisons, Commandes, identiteBoutique, fcfa } from '../outils/api'
import { demanderConfirmation, bulle } from '../outils/bulles'
import { ListeSquelette } from '../composants/Squelette'
import Avatar from '../composants/Avatar'
import { messageLivraison, ouvrirWhatsapp } from '../outils/whatsapp'
import ErreurChargement from '../composants/ErreurChargement'
import { useErreurChargement } from '../outils/erreursChargement'

/* Une livraison, c'est un trajet : ⏳ pas encore partie → 🛵 en route → ✅ arrivée.
   Trois images qui racontent l'étape, la couleur confirme (orange → vert). */
const STATUTS: Record<string, { icone: string; libelle: string; classe: string }> = {
  en_attente: { icone: '⏳', libelle: 'En attente', classe: 'pilule-bas' },
  en_cours: { icone: '🛵', libelle: 'En route', classe: 'pilule-bas' },
  livree: { icone: '✅', libelle: 'Livrée', classe: 'pilule-ok' },
}

/** Les trois étapes du trajet, dans l'ordre. `ORDRE` donne le rang atteint. */
const ETAPES = [
  { cle: 'en_attente', icone: '📦', libelle: 'Préparée' },
  { cle: 'en_cours', icone: '🛵', libelle: 'En route' },
  { cle: 'livree', icone: '🏠', libelle: 'Livrée' },
] as const
const ORDRE = ETAPES.map((e) => e.cle) as readonly string[]

export default function Livraisons() {
  const [liste, definirListe] = useState<any[]>([])
  const [commandes, definirCommandes] = useState<any[]>([])
  const [fenetreOuverte, definirFenetreOuverte] = useState(false)
  const [chargement, definirChargement] = useState(true)
  const { erreur, surveiller, effacer } = useErreurChargement()

  const charger = () => {
    effacer()
    surveiller(ApiLivraisons.lister().then(definirListe)).finally(() => definirChargement(false))
    Commandes.lister().then(definirCommandes).catch(() => {}) // alimente le formulaire : secondaire
  }
  useEffect(() => { charger() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* Suivi ET réception étaient dissociés : on pouvait marquer « Livrée » sans
     que le stock bouge. Désormais, si la livraison porte une commande encore
     en attente, on propose de l'ajouter au stock dans la foulée. */
  const avancer = async (l: any) => {
    const suivant = l.statut === 'en_attente' ? 'en_cours' : 'livree'
    definirListe((xs) => xs.map((x) => x.id === l.id ? { ...x, statut: suivant } : x))
    const reponse = await ApiLivraisons.changerStatut(l.id, suivant)
    if (reponse?.commande_a_recevoir) {
      if (await demanderConfirmation('Livraison arrivée ✅\n\nAjouter les articles de la commande à votre stock ?', 'Ajouter au stock')) {
        const fait = await ApiLivraisons.changerStatut(l.id, 'livree', true)
        bulle(fait?.message || 'Stock mis à jour', 'succes')
      }
    }
    charger()
  }
  const supprimer = async (l: any) => { if (await demanderConfirmation('Supprimer cette livraison ?')) { await ApiLivraisons.supprimer(l.id); charger() } }

  return (
    <>
      <div className="page-entete"><h2>🛵 Livraisons</h2><button className="bouton-principal" onClick={() => definirFenetreOuverte(true)}>+ Suivre</button></div>

      {chargement && <ListeSquelette nombre={3} />}
      {!chargement && erreur && <ErreurChargement erreur={erreur} surReessai={charger} />}
      {!chargement && !erreur && liste.length === 0 && (
        <div className="etat-vide">
          <div className="vide-icone">🛵</div>
          <div className="vide-texte">Aucune livraison</div>
          <div className="vide-sous-titre">Suivez la livraison d'une commande</div>
        </div>
      )}

      {!chargement && liste.map((l) => {
        const statut = STATUTS[l.statut] || { icone: '•', libelle: l.statut, classe: 'pilule-bas' }
        return (
          <div key={l.id} className="carte fiche">
            <div className="fiche-entete">
              <Avatar icone={statut.icone} nom={l.nom_fournisseur || 'Livraison'} taille={48} />
              <div className="fiche-identite">
                <div className="fiche-nom">{l.nom_fournisseur || 'Livraison'}</div>
                {l.total_commande ? <div className="fiche-sous-titre">💰 {fcfa(Number(l.total_commande))}</div> : null}
                {l.note_suivi && <div className="fiche-sous-titre">📍 {l.note_suivi}</div>}
                {l.livree_le && <div className="fiche-sous-titre">✅ Livrée le {(l.livree_le || '').slice(0, 10)}</div>}
              </div>
              <span className={`produit-stock-pilule ${statut.classe}`}>{statut.icone} {statut.libelle}</span>
            </div>

            {/* Le trajet est dessiné : préparée → en route → livrée. Une simple
                pastille de statut ne dit pas ce qui vient ensuite ; ici on voit
                d'un coup où en est le fournisseur et ce qu'il reste à faire. */}
            <div className="trajet" aria-hidden="true">
              {ETAPES.map((etape, i) => {
                const rang = ORDRE.indexOf(l.statut)
                const etat = i < rang ? 'fait' : i === rang ? 'en-cours' : ''
                return (
                  <Fragment key={etape.cle}>
                    {i > 0 && <span className={`trajet-trait ${i <= rang ? 'fait' : ''}`} />}
                    <span className={`trajet-etape ${etat}`}>
                      <span className="trajet-point">{i < rang ? '✓' : etape.icone}</span>
                      <span className="trajet-libelle">{etape.libelle}</span>
                    </span>
                  </Fragment>
                )
              })}
            </div>
            <span className="lecteur-ecran-seul">Étape : {statut.libelle}</span>

            <div className="fiche-actions">
              {l.statut !== 'livree' && (
                <button className="fa-bouton fa-ok" onClick={() => avancer(l)}>
                  {l.statut === 'en_attente' ? '▶️ Démarrer' : '✅ Marquer livrée'}
                </button>
              )}
              {l.telephone_fournisseur && (
                <button className="fa-bouton fa-whatsapp" onClick={() => ouvrirWhatsapp(l.telephone_fournisseur, messageLivraison(identiteBoutique(), {
                  reference: l.commande_id, statut: l.statut, note: l.note_suivi,
                }))}>💬 Demander où ça en est</button>
              )}
              <button className="fa-bouton fa-supprimer" onClick={() => supprimer(l)}>🗑️</button>
            </div>
          </div>
        )
      })}

      {fenetreOuverte && <FenetreLivraison commandes={commandes} surFermeture={() => definirFenetreOuverte(false)} surEnregistrement={() => { definirFenetreOuverte(false); charger() }} />}
    </>
  )
}

function FenetreLivraison({ commandes, surFermeture, surEnregistrement }: { commandes: any[]; surFermeture: () => void; surEnregistrement: () => void }) {
  const [commandeId, definirCommandeId] = useState('')
  const [note, definirNote] = useState('')
  const [envoi, definirEnvoi] = useState(false)
  const enregistrer = async () => {
    definirEnvoi(true)
    try { await ApiLivraisons.creer(commandeId ? Number(commandeId) : null, note || undefined); surEnregistrement() }
    catch (e: any) { alert(e?.response?.data?.erreur || 'Erreur') } finally { definirEnvoi(false) }
  }
  return (
    <div className="fenetre-calque" onClick={surFermeture}>
      <div className="fenetre-boite" onClick={(e) => e.stopPropagation()}>
        <div className="fenetre-titre">🛵 Suivre une livraison</div>
        <div className="groupe-champ"><label>📋 Commande liée</label>
          <select value={commandeId} onChange={(e) => definirCommandeId(e.target.value)}>
            <option value="">Aucune</option>
            {commandes.map((c) => <option key={c.id} value={c.id}>#{c.id} · {c.nom_fournisseur || 'Sans fournisseur'} · {fcfa(Number(c.total))}</option>)}
          </select>
        </div>
        <div className="groupe-champ"><label>📍 Note de suivi</label><input value={note} onChange={(e) => definirNote(e.target.value)} placeholder="Transporteur, n° de suivi..." /></div>
        <div className="fenetre-actions"><button className="bouton-annuler" onClick={surFermeture}>Annuler</button><button className="bouton-valider" onClick={enregistrer} disabled={envoi}>Créer</button></div>
      </div>
    </div>
  )
}
