import { useEffect, useState } from 'react'
import { Membres, TOUTES_PERMISSIONS, identiteBoutique, type Membre } from '../outils/api'
import { demanderConfirmation, bulle } from '../outils/bulles'
import { ListeSquelette } from '../composants/Squelette'
import Avatar from '../composants/Avatar'
import ChoixPhoto from '../composants/ChoixPhoto'
import { messageInvitation, ouvrirWhatsapp, lienAppel } from '../outils/whatsapp'
import ErreurChargement from '../composants/ErreurChargement'
import { useErreurChargement } from '../outils/erreursChargement'

/* Chaque permission porte un pictogramme identique à celui de la section
   correspondante : le patron retrouve visuellement « ce que l'employé a le
   droit d'ouvrir », sans lire la liste. */
const LIBELLES_PERMISSIONS: Record<string, string> = {
  vente: '💳 Vente', stock: '📦 Stock', categories: '🏷️ Catégories', rapports: '📈 Chiffres',
  caisse: '💰 Caisse', credits: '📝 Crédits/Retours', clients: '👤 Clients',
  fournisseurs: '🚚 Fournisseurs', commandes: '📋 Commandes', livraisons: '🛵 Livraisons',
}

const ROLES = {
  gerant: { icone: '👔', libelle: 'Gérant' },
  employe: { icone: '🧑‍💼', libelle: 'Employé' },
} as const

const STATUTS: Record<string, { icone: string; libelle: string; classe: string }> = {
  acceptee: { icone: '✅', libelle: 'Actif', classe: 'pilule-ok' },
  invitee: { icone: '⏳', libelle: 'Invitation envoyée', classe: 'pilule-bas' },
  refusee: { icone: '⛔', libelle: 'Refusée', classe: 'pilule-critique' },
}

/** Nom affiché : fiche saisie par le patron, sinon compte lié, sinon email. */
const nomAffiche = (m: Membre) => m.nom || m.nom_commerce_utilisateur || m.email.split('@')[0]
const telephoneAffiche = (m: Membre) => m.telephone || m.telephone_utilisateur || null

export default function Equipe() {
  const [membres, definirMembres] = useState<Membre[]>([])
  const [fenetreOuverte, definirFenetreOuverte] = useState(false)
  const [enEdition, definirEnEdition] = useState<Membre | null>(null)
  const [chargement, definirChargement] = useState(true)
  const { erreur, surveiller, effacer } = useErreurChargement()

  const charger = () => { effacer(); surveiller(Membres.lister().then(definirMembres)).finally(() => definirChargement(false)) }
  useEffect(() => { charger() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const retirer = async (m: Membre) => { if (await demanderConfirmation(`Retirer ${nomAffiche(m)} de l'équipe ?`)) { await Membres.supprimer(m.id); charger() } }
  const basculerPermission = async (m: Membre, cle: string) => {
    const permissions = { ...m.permissions, [cle]: !m.permissions[cle] }
    definirMembres((liste) => liste.map((x) => x.id === m.id ? { ...x, permissions } : x))
    try { await Membres.modifier(m.id, { permissions }) } catch { bulle('Modification non enregistrée', 'erreur'); charger() }
  }

  return (
    <>
      <div className="page-entete"><h2>👥 Mon Équipe</h2></div>

      {/* Inviter est l'action qui fait vivre cet écran : elle prend la place
          d'un bandeau coloré plutôt que d'un petit bouton dans un coin. */}
      <button className="bandeau-couleur" onClick={() => { definirEnEdition(null); definirFenetreOuverte(true) }}>
        <span className="bandeau-icone" aria-hidden="true">🔑</span>
        <span style={{ minWidth: 0 }}>
          <span className="bandeau-titre" style={{ display: 'block' }}>Inviter un vendeur</span>
          <span className="bandeau-sous-titre" style={{ display: 'block' }}>Le lien se partage par WhatsApp</span>
        </span>
        <span className="premium-aller">+ Inviter</span>
      </button>

      {chargement && <ListeSquelette nombre={2} />}
      {!chargement && erreur && <ErreurChargement erreur={erreur} surReessai={charger} />}
      {!chargement && !erreur && membres.length === 0 && (
        <div className="etat-vide">
          <div className="vide-icone">👥</div>
          <div className="vide-texte">Aucun membre</div>
          <div className="vide-sous-titre">Invitez un employé : il vend, vous gardez la main sur les prix</div>
        </div>
      )}

      {!chargement && membres.map((m) => {
        const role = ROLES[m.role as keyof typeof ROLES] || ROLES.employe
        const statut = STATUTS[m.statut] || { icone: '•', libelle: m.statut, classe: 'pilule-bas' }
        const telephone = telephoneAffiche(m)
        const appel = lienAppel(telephone)
        return (
          <div key={m.id} className="carte fiche">
            <div className="fiche-entete">
              <Avatar photo={m.photo} icone={m.photo ? undefined : role.icone} nom={nomAffiche(m)} taille={52} />
              <div className="fiche-identite">
                <div className="fiche-nom">{nomAffiche(m)}</div>
                <div className="fiche-sous-titre">{role.icone} {role.libelle}</div>
                <div className="fiche-sous-titre">✉️ {m.email}</div>
                {telephone && <div className="fiche-sous-titre">📞 {telephone}</div>}
              </div>
              <div className="fiche-outils">
                <button className="bouton-compact bouton-compact-modifier" aria-label="Modifier" onClick={() => { definirEnEdition(m); definirFenetreOuverte(true) }}>✏️</button>
                <button className="bouton-compact bouton-compact-supprimer" aria-label="Retirer" onClick={() => retirer(m)}>🗑️</button>
              </div>
            </div>

            <span className={`produit-stock-pilule ${statut.classe}`} style={{ display: 'inline-block', marginBottom: 10 }}>{statut.icone} {statut.libelle}</span>

            {telephone && (
              <div className="fiche-actions">
                {appel && <a className="fa-bouton fa-appeler" href={appel}>📞 Appeler</a>}
                <button className="fa-bouton fa-whatsapp" onClick={() => ouvrirWhatsapp(telephone, `👋 Bonjour ${nomAffiche(m)},\n\n🏪 *${identiteBoutique().nom}*`)}>💬 WhatsApp</button>
              </div>
            )}

            <div className="droits-libelle">🔑 Ce qu'il peut ouvrir</div>
            <div className="droits-grille">
              {TOUTES_PERMISSIONS.map((cle) => (
                <button key={cle} onClick={() => basculerPermission(m, cle)}
                  className={`droit-puce ${m.permissions?.[cle] ? 'allume' : ''}`}
                  aria-pressed={!!m.permissions?.[cle]}>
                  <span aria-hidden="true">{m.permissions?.[cle] ? '✅' : '🚫'}</span> {LIBELLES_PERMISSIONS[cle]}
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {fenetreOuverte && <FenetreMembre membre={enEdition} surFermeture={() => definirFenetreOuverte(false)} surEnregistrement={() => { definirFenetreOuverte(false); charger() }} />}
    </>
  )
}

function FenetreMembre({ membre, surFermeture, surEnregistrement }: { membre: Membre | null; surFermeture: () => void; surEnregistrement: () => void }) {
  const [email, definirEmail] = useState(membre?.email ?? '')
  const [nom, definirNom] = useState(membre?.nom ?? '')
  const [telephone, definirTelephone] = useState(membre?.telephone ?? '')
  const [photo, definirPhoto] = useState<string | null>(membre?.photo ?? null)
  const [role, definirRole] = useState(membre?.role ?? 'employe')
  const [envoi, definirEnvoi] = useState(false)
  const [lien, definirLien] = useState<string | null>(null)

  const valider = async () => {
    definirEnvoi(true)
    try {
      if (membre) {
        await Membres.modifier(membre.id, { role, nom: nom || null, telephone: telephone || null, photo })
        bulle('Fiche mise à jour', 'succes')
        surEnregistrement()
        return
      }
      if (!email.trim()) return alert('Email requis')
      const d = await Membres.inviter({ email: email.trim(), role, nom: nom || null, telephone: telephone || null, photo })
      definirLien(d.lien_invitation || d.jeton_invitation)
    } catch (e: any) { alert(e?.response?.data?.message || e?.response?.data?.erreur || 'Erreur') } finally { definirEnvoi(false) }
  }

  /* L'invitation par email n'atteint pas nos utilisateurs : au Sénégal, on
     partage un lien par WhatsApp. Le message explique la marche à suivre en
     trois étapes numérotées. */
  const envoyerWhatsapp = () => {
    if (!lien) return
    ouvrirWhatsapp(telephone, messageInvitation(identiteBoutique(), { lien, role }))
  }

  return (
    <div className="fenetre-calque" onClick={surFermeture}>
      <div className="fenetre-boite" onClick={(e) => e.stopPropagation()}>
        <div className="fenetre-titre">{membre ? '✏️ Fiche employé' : '👥 Inviter un membre'}</div>
        {lien ? (
          <>
            <div className="bandeau-couleur" style={{ marginBottom: 14 }}>
              <span className="bandeau-icone" aria-hidden="true">✅</span>
              <span style={{ minWidth: 0 }}>
                <span className="bandeau-titre" style={{ display: 'block' }}>Invitation prête</span>
                <span className="bandeau-sous-titre" style={{ display: 'block' }}>Envoyez-la à {nom || 'votre employé'}</span>
              </span>
            </div>
            <div className="apercu-whatsapp" style={{ wordBreak: 'break-all' }}>{lien}</div>
            <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
              <button className="bouton-whatsapp" onClick={envoyerWhatsapp}>💬 Envoyer par WhatsApp</button>
              <button className="fa-bouton fa-appeler" style={{ flex: '0 0 auto', minWidth: 96 }} onClick={() => { navigator.clipboard?.writeText(lien); bulle('Lien copié 📋', 'succes') }}>📋 Copier</button>
            </div>
            <button className="bouton-valider" style={{ width: '100%' }} onClick={surEnregistrement}>Terminé</button>
          </>
        ) : (
          <>
            <ChoixPhoto valeur={photo} surChangement={definirPhoto} nom={nom || email} icone="🧑‍💼" libelle="📷 Photo de l'employé (facultatif)" />
            <div className="groupe-champ"><label>Nom / prénom</label><input value={nom} onChange={(e) => definirNom(e.target.value)} placeholder="Ex. Awa Ndiaye" /></div>
            {!membre && <div className="groupe-champ"><label>✉️ Email de l'employé</label><input type="email" value={email} onChange={(e) => definirEmail(e.target.value)} placeholder="employe@exemple.sn" /></div>}
            <div className="groupe-champ"><label>📞 Téléphone (WhatsApp)</label><input type="tel" inputMode="tel" value={telephone} onChange={(e) => definirTelephone(e.target.value)} placeholder="77 123 45 67" /></div>
            <div className="groupe-champ"><label>👔 Rôle</label>
              <select value={role} onChange={(e) => definirRole(e.target.value)}>
                <option value="employe">🧑‍💼 Employé (vente uniquement par défaut)</option>
                <option value="gerant">👔 Gérant (toutes permissions)</option>
              </select>
            </div>
            <div className="fenetre-actions"><button className="bouton-annuler" onClick={surFermeture}>Annuler</button><button className="bouton-valider" onClick={valider} disabled={envoi}>{membre ? 'Enregistrer' : 'Inviter'}</button></div>
          </>
        )}
      </div>
    </div>
  )
}
