import { useEffect, useState } from 'react'
import { Fournisseurs as ApiFournisseurs, Commandes, fcfa, type Fournisseur } from '../outils/api'
import { demanderConfirmation, bulle } from '../outils/bulles'
import { ListeSquelette } from '../composants/Squelette'
import Avatar from '../composants/Avatar'
import ChoixPhoto from '../composants/ChoixPhoto'
import { lienAppel } from '../outils/whatsapp'
import ErreurChargement from '../composants/ErreurChargement'
import { useErreurChargement } from '../outils/erreursChargement'

export default function Fournisseurs() {
  const [liste, definirListe] = useState<Fournisseur[]>([])
  const [commandes, definirCommandes] = useState<any[]>([])
  const [recherche, definirRecherche] = useState('')
  const [fenetreOuverte, definirFenetreOuverte] = useState(false)
  const [enEdition, definirEnEdition] = useState<Fournisseur | null>(null)
  const [chargement, definirChargement] = useState(true)
  const { erreur, surveiller, effacer } = useErreurChargement()
  const [apercu, definirApercu] = useState<{ fournisseur: Fournisseur; message: string; lien: string } | null>(null)

  const charger = () => {
    effacer()
    surveiller(ApiFournisseurs.lister().then(definirListe)).finally(() => definirChargement(false))
    Commandes.lister().then(definirCommandes).catch(() => {}) // secondaire : ne bloque pas la liste
  }
  useEffect(() => { charger() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const supprimer = async (f: Fournisseur) => { if (await demanderConfirmation(`Supprimer « ${f.nom} » ?`)) { await ApiFournisseurs.supprimer(f.id); charger() } }

  /* La relance part APRÈS relecture : le commerçant voit le message tel qu'il
     sera envoyé (et peut annuler s'il s'est trompé de fournisseur). */
  const relancer = async (f: Fournisseur) => {
    try {
      const d = await ApiFournisseurs.messageReappro(f.id)
      definirApercu({ fournisseur: f, message: d.message, lien: d.url_whatsapp })
    } catch { bulle('Impossible de préparer la relance', 'erreur') }
  }

  const chiffresDe = (f: Fournisseur) => {
    const siennes = commandes.filter((c) => c.fournisseur_id === f.id)
    return { nb: siennes.length, total: siennes.reduce((s, c) => s + Number(c.total || 0), 0) }
  }

  const filtres = liste.filter((f) => f.nom.toLowerCase().includes(recherche.toLowerCase()) || (f.telephone || '').includes(recherche))

  return (
    <>
      <div className="page-entete"><h2>🚚 Fournisseurs</h2><button className="bouton-principal" data-guide="fournisseurs-ajouter" onClick={() => { definirEnEdition(null); definirFenetreOuverte(true) }}>+ Ajouter</button></div>
      <input className="barre-recherche" placeholder="🔍 Rechercher un fournisseur..." value={recherche} onChange={(e) => definirRecherche(e.target.value)} />

      {chargement && <ListeSquelette nombre={3} />}
      {!chargement && erreur && <ErreurChargement erreur={erreur} surReessai={charger} />}
      {!chargement && !erreur && filtres.length === 0 && (
        <div className="etat-vide">
          <div className="vide-icone">🚚</div>
          <div className="vide-texte">{liste.length === 0 ? 'Aucun fournisseur' : 'Aucun résultat'}</div>
          <div className="vide-sous-titre">{liste.length === 0 ? 'Ajoutez celui qui vous livre le plus souvent' : 'Essayez un autre nom'}</div>
        </div>
      )}

      {!chargement && filtres.map((f) => {
        const chiffres = chiffresDe(f)
        const appel = lienAppel(f.telephone)
        return (
          <div key={f.id} className="carte fiche">
            <div className="fiche-entete">
              <Avatar photo={f.photo} icone={f.photo ? undefined : '🚚'} nom={f.nom} taille={52} />
              <div className="fiche-identite">
                <div className="fiche-nom">{f.nom}</div>
                {f.telephone && <div className="fiche-sous-titre">📞 {f.telephone}</div>}
                {f.adresse && <div className="fiche-sous-titre">📍 {f.adresse}</div>}
              </div>
              <div className="fiche-outils">
                <button className="bouton-compact bouton-compact-modifier" aria-label="Modifier" onClick={() => { definirEnEdition(f); definirFenetreOuverte(true) }}>✏️</button>
                <button className="bouton-compact bouton-compact-supprimer" aria-label="Supprimer" onClick={() => supprimer(f)}>🗑️</button>
              </div>
            </div>

            <div className="fiche-chiffres">
              <span className="chiffre chiffre-bleu"><b>{chiffres.nb}</b><span>📋 commandes</span></span>
              <span className="chiffre chiffre-violet"><b>{fcfa(chiffres.total)}</b><span>💰 total achats</span></span>
            </div>

            {f.telephone && (
              <div className="fiche-actions">
                {appel && <a className="fa-bouton fa-appeler" href={appel}>📞 Appeler</a>}
                <button className="fa-bouton fa-whatsapp" onClick={() => relancer(f)}>📲 Relance réappro</button>
              </div>
            )}
            {f.notes && <div className="fiche-note">📝 {f.notes}</div>}
          </div>
        )
      })}

      {apercu && (
        <div className="fenetre-calque" onClick={() => definirApercu(null)}>
          <div className="fenetre-boite" onClick={(e) => e.stopPropagation()}>
            <div className="fenetre-titre">📲 Relance à {apercu.fournisseur.nom}</div>
            <div className="apercu-whatsapp">{apercu.message}</div>
            <div className="fenetre-actions">
              <button className="bouton-annuler" onClick={() => definirApercu(null)}>Annuler</button>
              <button className="bouton-valider" onClick={() => { window.open(apercu.lien, '_blank', 'noopener'); definirApercu(null) }}>💬 Envoyer</button>
            </div>
          </div>
        </div>
      )}

      {fenetreOuverte && <FenetreFournisseur fournisseur={enEdition} surFermeture={() => definirFenetreOuverte(false)} surEnregistrement={() => { definirFenetreOuverte(false); charger() }} />}
    </>
  )
}

function FenetreFournisseur({ fournisseur, surFermeture, surEnregistrement }: { fournisseur: Fournisseur | null; surFermeture: () => void; surEnregistrement: () => void }) {
  const [nom, definirNom] = useState(fournisseur?.nom ?? '')
  const [telephone, definirTelephone] = useState(fournisseur?.telephone ?? '')
  const [email, definirEmail] = useState(fournisseur?.email ?? '')
  const [adresse, definirAdresse] = useState(fournisseur?.adresse ?? '')
  const [notes, definirNotes] = useState(fournisseur?.notes ?? '')
  const [photo, definirPhoto] = useState<string | null>(fournisseur?.photo ?? null)
  const [envoi, definirEnvoi] = useState(false)

  const enregistrer = async () => {
    if (!nom.trim()) return alert('Le nom est requis')
    definirEnvoi(true)
    const charge = { nom: nom.trim(), telephone: telephone || null, email: email || null, adresse: adresse || null, notes: notes || null, photo }
    try { if (fournisseur) await ApiFournisseurs.modifier(fournisseur.id, charge); else await ApiFournisseurs.creer(charge); surEnregistrement() }
    catch (e: any) { alert(e?.response?.data?.erreur || 'Erreur') } finally { definirEnvoi(false) }
  }

  return (
    <div className="fenetre-calque" onClick={surFermeture}>
      <div className="fenetre-boite" onClick={(e) => e.stopPropagation()}>
        <div className="fenetre-titre">{fournisseur ? '✏️ Modifier le fournisseur' : '🚚 Nouveau fournisseur'}</div>
        <ChoixPhoto valeur={photo} surChangement={definirPhoto} nom={nom} icone="🚚" libelle="📷 Photo / logo (facultatif)" />
        <div className="groupe-champ"><label>Nom</label><input value={nom} onChange={(e) => definirNom(e.target.value)} placeholder="Nom du fournisseur" /></div>
        <div className="groupe-champ"><label>📞 Téléphone (WhatsApp)</label><input type="tel" inputMode="tel" value={telephone} onChange={(e) => definirTelephone(e.target.value)} placeholder="77 123 45 67" /></div>
        <div className="groupe-champ"><label>✉️ Email</label><input value={email} onChange={(e) => definirEmail(e.target.value)} /></div>
        <div className="groupe-champ"><label>📍 Adresse</label><input value={adresse} onChange={(e) => definirAdresse(e.target.value)} /></div>
        <div className="groupe-champ"><label>📝 Notes</label><textarea value={notes} onChange={(e) => definirNotes(e.target.value)} placeholder="Jours de livraison, conditions de paiement…" /></div>
        <div className="fenetre-actions"><button className="bouton-annuler" onClick={surFermeture}>Annuler</button><button className="bouton-valider" onClick={enregistrer} disabled={envoi}>{fournisseur ? 'Mettre à jour' : 'Ajouter'}</button></div>
      </div>
    </div>
  )
}
