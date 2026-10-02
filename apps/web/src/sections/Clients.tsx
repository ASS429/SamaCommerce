import { useEffect, useState } from 'react'
import { Clients as ApiClients, identiteBoutique, fcfa, type Client } from '../outils/api'
import { demanderConfirmation } from '../outils/bulles'
import { ListeSquelette } from '../composants/Squelette'
import LigneGlissante from '../composants/LigneGlissante'
import Avatar from '../composants/Avatar'
import ChoixPhoto from '../composants/ChoixPhoto'
import { messageRappelCredit, ouvrirWhatsapp, lienAppel } from '../outils/whatsapp'
import ErreurChargement from '../composants/ErreurChargement'
import { useErreurChargement } from '../outils/erreursChargement'

export default function Clients() {
  const [clients, definirClients] = useState<Client[]>([])
  const [recherche, definirRecherche] = useState('')
  const [fenetreOuverte, definirFenetreOuverte] = useState(false)
  const [enEdition, definirEnEdition] = useState<Client | null>(null)
  const [chargement, definirChargement] = useState(true)
  const { erreur, surveiller, effacer } = useErreurChargement()

  const charger = () => { effacer(); surveiller(ApiClients.lister().then(definirClients)).finally(() => definirChargement(false)) }
  useEffect(() => { charger() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const supprimer = async (c: Client) => { if (await demanderConfirmation(`Supprimer « ${c.nom} » ?`)) { await ApiClients.supprimer(c.id); charger() } }
  const filtres = clients.filter((c) => c.nom.toLowerCase().includes(recherche.toLowerCase()) || (c.telephone || '').includes(recherche))

  /** Rappel de dette : le message part prérempli, le commerçant n'a qu'à envoyer. */
  const rappel = (c: Client) => ouvrirWhatsapp(c.telephone, messageRappelCredit(identiteBoutique(), {
    client: c.nom, montant: Number(c.montant_credits || 0),
  }))

  return (
    <>
      <div className="page-entete"><h2>👤 Clients</h2><button className="bouton-principal" data-guide="clients-ajouter" onClick={() => { definirEnEdition(null); definirFenetreOuverte(true) }}>+ Ajouter</button></div>
      <input className="barre-recherche" placeholder="🔍 Rechercher un client..." value={recherche} onChange={(e) => definirRecherche(e.target.value)} />

      {chargement && <ListeSquelette nombre={4} />}
      {!chargement && erreur && <ErreurChargement erreur={erreur} surReessai={charger} />}
      {!chargement && !erreur && filtres.length === 0 && (
        <div className="etat-vide">
          <div className="vide-icone">👤</div>
          <div className="vide-texte">{clients.length === 0 ? 'Aucun client' : 'Aucun résultat'}</div>
          <div className="vide-sous-titre">{clients.length === 0 ? 'Ajoutez votre premier client' : 'Essayez un autre nom'}</div>
        </div>
      )}

      {!chargement && filtres.map((c) => {
        const dette = Number(c.montant_credits || 0)
        const appel = lienAppel(c.telephone)
        return (
          <LigneGlissante key={c.id} surSuppression={() => supprimer(c)}>
            <div className="carte fiche" style={{ marginBottom: 0 }}>
              <div className="fiche-entete">
                {/* Photo ou initiales : on identifie le client d'un coup d'œil. */}
                <Avatar photo={c.photo} nom={c.nom} taille={52} />
                <div className="fiche-identite">
                  <div className="fiche-nom">{c.nom}</div>
                  {c.telephone && <div className="fiche-sous-titre">📞 {c.telephone}</div>}
                  {!c.telephone && c.adresse && <div className="fiche-sous-titre">📍 {c.adresse}</div>}
                </div>
                <div className="fiche-outils">
                  <button className="bouton-compact bouton-compact-modifier" aria-label="Modifier" onClick={() => { definirEnEdition(c); definirFenetreOuverte(true) }}>✏️</button>
                  <button className="bouton-compact bouton-compact-supprimer" aria-label="Supprimer" onClick={() => supprimer(c)}>🗑️</button>
                </div>
              </div>

              <div className="fiche-chiffres">
                <span className="chiffre chiffre-bleu"><b>{c.nb_achats || 0}</b><span>🛒 achats</span></span>
                <span className="chiffre chiffre-vert"><b>{fcfa(c.total_achats || 0)}</b><span>💰 dépensé</span></span>
                {dette > 0 && <span className="chiffre chiffre-rouge"><b>{fcfa(dette)}</b><span>📝 dette</span></span>}
              </div>

              {c.telephone && (
                <div className="fiche-actions">
                  {appel && <a className="fa-bouton fa-appeler" href={appel}>📞 Appeler</a>}
                  <button className="fa-bouton fa-whatsapp" onClick={() => ouvrirWhatsapp(c.telephone, `👋 Bonjour ${c.nom},\n\n🏪 *${identiteBoutique().nom}*`)}>💬 WhatsApp</button>
                  {dette > 0 && <button className="fa-bouton fa-alerte" onClick={() => rappel(c)}>🔔 Rappel dette</button>}
                </div>
              )}
            </div>
          </LigneGlissante>
        )
      })}

      {fenetreOuverte && <FenetreClient client={enEdition} surFermeture={() => definirFenetreOuverte(false)} surEnregistrement={() => { definirFenetreOuverte(false); charger() }} />}
    </>
  )
}

function FenetreClient({ client, surFermeture, surEnregistrement }: { client: Client | null; surFermeture: () => void; surEnregistrement: () => void }) {
  const [nom, definirNom] = useState(client?.nom ?? '')
  const [telephone, definirTelephone] = useState(client?.telephone ?? '')
  const [email, definirEmail] = useState(client?.email ?? '')
  const [adresse, definirAdresse] = useState(client?.adresse ?? '')
  const [notes, definirNotes] = useState(client?.notes ?? '')
  const [photo, definirPhoto] = useState<string | null>(client?.photo ?? null)
  const [envoi, definirEnvoi] = useState(false)

  const enregistrer = async () => {
    if (!nom.trim()) return alert('Le nom est requis')
    definirEnvoi(true)
    const charge = { nom: nom.trim(), telephone: telephone || null, email: email || null, adresse: adresse || null, notes: notes || null, photo }
    try { if (client) await ApiClients.modifier(client.id, charge); else await ApiClients.creer(charge); surEnregistrement() }
    catch (e: any) { alert(e?.response?.data?.erreur || 'Erreur') } finally { definirEnvoi(false) }
  }

  return (
    <div className="fenetre-calque" onClick={surFermeture}>
      <div className="fenetre-boite" onClick={(e) => e.stopPropagation()}>
        <div className="fenetre-titre">{client ? '✏️ Modifier le client' : '👤 Nouveau client'}</div>
        <ChoixPhoto valeur={photo} surChangement={definirPhoto} nom={nom} icone="👤" libelle="📷 Photo du client (facultatif)" />
        <div className="groupe-champ"><label>Nom</label><input value={nom} onChange={(e) => definirNom(e.target.value)} placeholder="Nom du client" /></div>
        <div className="groupe-champ"><label>📞 Téléphone</label><input type="tel" inputMode="tel" value={telephone} onChange={(e) => definirTelephone(e.target.value)} placeholder="77 123 45 67" /></div>
        <div className="groupe-champ"><label>✉️ Email</label><input value={email} onChange={(e) => definirEmail(e.target.value)} /></div>
        <div className="groupe-champ"><label>📍 Adresse</label><input value={adresse} onChange={(e) => definirAdresse(e.target.value)} /></div>
        <div className="groupe-champ"><label>📝 Notes</label><textarea value={notes} onChange={(e) => definirNotes(e.target.value)} /></div>
        <div className="fenetre-actions"><button className="bouton-annuler" onClick={surFermeture}>Annuler</button><button className="bouton-valider" onClick={enregistrer} disabled={envoi}>{client ? 'Mettre à jour' : 'Ajouter'}</button></div>
      </div>
    </div>
  )
}
