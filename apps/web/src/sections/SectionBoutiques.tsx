import { useEffect, useState } from 'react'
import { Boutiques as ApiBoutiques, enregistrerUtilisateur, lireUtilisateur, type Boutique } from '../outils/api'
import { demanderConfirmation } from '../outils/bulles'
import { ListeSquelette } from '../composants/Squelette'
import Avatar from '../composants/Avatar'
import ChoixPhoto from '../composants/ChoixPhoto'
import { lienAppel } from '../outils/whatsapp'
import ErreurChargement from '../composants/ErreurChargement'
import { useErreurChargement } from '../outils/erreursChargement'

/* Enseignes proposées : on couvre les commerces les plus fréquents au Sénégal
   (boutique de quartier, alimentation générale, pharmacie, quincaillerie…).
   Le commerçant choisit une IMAGE, pas un mot. */
const ENSEIGNES = ['🏪', '🏬', '🛒', '🥬', '🍞', '🥩', '🐟', '🍲', '👕', '👟', '💊', '📱', '💇', '🔧', '🧱', '⛽', '📚', '🧴']

export default function SectionBoutiques() {
  const [liste, definirListe] = useState<Boutique[]>([])
  const [fenetreOuverte, definirFenetreOuverte] = useState(false)
  const [enEdition, definirEnEdition] = useState<Boutique | null>(null)
  const [chargement, definirChargement] = useState(true)
  const { erreur, surveiller, effacer } = useErreurChargement()
  const boutiqueActiveId = lireUtilisateur()?.boutique_active_id

  const charger = () => { effacer(); surveiller(ApiBoutiques.lister().then(definirListe)).finally(() => definirChargement(false)) }
  useEffect(() => { charger() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const activer = async (b: Boutique) => {
    await ApiBoutiques.activer(b.id)
    // Met à jour l'utilisateur mémorisé puis recharge pour appliquer le contexte
    const u = lireUtilisateur()
    if (u) enregistrerUtilisateur({ ...u, boutique_active_id: b.id })
    window.location.reload()
  }
  const supprimer = async (b: Boutique) => {
    if (b.est_principale) return alert('Impossible de supprimer la boutique principale')
    if (await demanderConfirmation(`Supprimer « ${b.nom} » ?`)) { await ApiBoutiques.supprimer(b.id); charger() }
  }

  return (
    <>
      <div className="page-entete"><h2>🏬 Mes Boutiques</h2><button className="bouton-principal" onClick={() => { definirEnEdition(null); definirFenetreOuverte(true) }}>+ Boutique</button></div>

      {chargement && <ListeSquelette nombre={2} />}
      {!chargement && erreur && <ErreurChargement erreur={erreur} surReessai={charger} />}
      {!chargement && !erreur && liste.length === 0 && (
        <div className="etat-vide"><div className="vide-icone">🏬</div><div className="vide-texte">Aucune boutique</div><div className="vide-sous-titre">Créez votre première boutique</div></div>
      )}

      {/* La boutique ACTIVE est un panneau violet, les autres restent des
          fiches blanches : on voit sur quel point de vente on travaille avant
          d'avoir lu un mot. Se tromper de boutique fausse toute la journée. */}
      {!chargement && liste.map((b) => {
        const active = b.id === boutiqueActiveId
        const appel = lienAppel(b.telephone)
        if (active) {
          return (
            <div key={b.id} className="panneau">
              <div className="panneau-haut">
                <Avatar photo={b.photo} icone={b.photo ? undefined : (b.emoji || '🏪')} nom={b.nom} taille={50} rayon={15} fond="rgba(255,255,255,.2)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="panneau-libelle">✅ Boutique active{b.est_principale ? ' · principale' : ''}</div>
                  <div className="panneau-valeur" style={{ fontSize: 21 }}>{b.nom}</div>
                  {b.adresse && <div className="panneau-sous-titre">📍 {b.adresse}</div>}
                </div>
                <div className="panneau-haut-actions">
                  <button className="panneau-bouton" aria-label={`Modifier ${b.nom}`} onClick={() => { definirEnEdition(b); definirFenetreOuverte(true) }}>✏️</button>
                </div>
              </div>
              <div className="panneau-chiffres">
                <div className="panneau-chiffre"><b>{b.nb_produits || 0}</b><span>📦 produits</span></div>
                <div className="panneau-chiffre"><b>{b.nb_ventes || 0}</b><span>🛒 ventes</span></div>
                <div className="panneau-chiffre"><b>{b.nb_membres || 0}</b><span>👥 membres</span></div>
              </div>
              {appel && <a className="panneau-appel" href={appel} style={{ textAlign: 'center', textDecoration: 'none' }}>📞 {b.telephone}</a>}
            </div>
          )
        }
        return (
          <div key={b.id} className="carte fiche">
            <div className="fiche-entete">
              <Avatar photo={b.photo} icone={b.photo ? undefined : (b.emoji || '🏪')} nom={b.nom} taille={54} />
              <div className="fiche-identite">
                <div className="fiche-nom">
                  {b.nom} {b.est_principale && <span className="cat-pastille">⭐ Principale</span>}
                </div>
                {b.telephone && <div className="fiche-sous-titre">📞 {b.telephone}</div>}
                {b.adresse && <div className="fiche-sous-titre">📍 {b.adresse}</div>}
              </div>
              <div className="fiche-outils">
                <button className="bouton-compact bouton-compact-modifier" aria-label={`Modifier ${b.nom}`} onClick={() => { definirEnEdition(b); definirFenetreOuverte(true) }}>✏️</button>
                {!b.est_principale && <button className="bouton-compact bouton-compact-supprimer" aria-label={`Supprimer ${b.nom}`} onClick={() => supprimer(b)}>🗑️</button>}
              </div>
            </div>

            <div className="fiche-chiffres">
              <span className="chiffre chiffre-bleu"><b>{b.nb_produits || 0}</b><span>📦 produits</span></span>
              <span className="chiffre chiffre-vert"><b>{b.nb_ventes || 0}</b><span>🛒 ventes</span></span>
              <span className="chiffre chiffre-violet"><b>{b.nb_membres || 0}</b><span>👥 membres</span></span>
            </div>

            <div className="fiche-actions">
              {appel && <a className="fa-bouton fa-appeler" href={appel}>📞 Appeler</a>}
              <button className="fa-bouton fa-aller" onClick={() => activer(b)}>🔄 Activer cette boutique</button>
            </div>
          </div>
        )
      })}

      {fenetreOuverte && <FenetreBoutique boutique={enEdition} surFermeture={() => definirFenetreOuverte(false)} surEnregistrement={() => { definirFenetreOuverte(false); charger() }} />}
    </>
  )
}

function FenetreBoutique({ boutique, surFermeture, surEnregistrement }: { boutique: Boutique | null; surFermeture: () => void; surEnregistrement: () => void }) {
  const [nom, definirNom] = useState(boutique?.nom ?? '')
  const [emoji, definirEmoji] = useState(boutique?.emoji || '🏪')
  const [telephone, definirTelephone] = useState(boutique?.telephone ?? '')
  const [adresse, definirAdresse] = useState(boutique?.adresse ?? '')
  const [photo, definirPhoto] = useState<string | null>(boutique?.photo ?? null)
  const [envoi, definirEnvoi] = useState(false)

  const enregistrer = async () => {
    if (!nom.trim()) return alert('Le nom est requis')
    definirEnvoi(true)
    const charge = { nom: nom.trim(), emoji, telephone: telephone || null, adresse: adresse || null, photo }
    try { if (boutique) await ApiBoutiques.modifier(boutique.id, charge); else await ApiBoutiques.creer(charge); surEnregistrement() }
    catch (e: any) { alert(e?.response?.data?.message || e?.response?.data?.erreur || 'Erreur') } finally { definirEnvoi(false) }
  }

  return (
    <div className="fenetre-calque" onClick={surFermeture}>
      <div className="fenetre-boite" onClick={(e) => e.stopPropagation()}>
        <div className="fenetre-titre">{boutique ? '✏️ Modifier la boutique' : '🏬 Nouvelle boutique'}</div>
        <ChoixPhoto valeur={photo} surChangement={definirPhoto} nom={nom} icone={emoji} libelle="📷 Photo de la devanture (facultatif)" />
        <div className="groupe-champ"><label>Nom</label><input value={nom} onChange={(e) => definirNom(e.target.value)} placeholder="Ex. Boutique Ndiaye" /></div>
        <div className="groupe-champ"><label>📞 Téléphone</label><input type="tel" inputMode="tel" value={telephone} onChange={(e) => definirTelephone(e.target.value)} placeholder="77 123 45 67" /></div>
        <div className="groupe-champ"><label>📍 Adresse</label><input value={adresse} onChange={(e) => definirAdresse(e.target.value)} placeholder="Quartier, rue…" /></div>
        <div className="groupe-champ"><label>Enseigne (sélectionnée : {emoji})</label></div>
        <div className="grille-emoji">
          {ENSEIGNES.map((e) => <button key={e} type="button" className={`bouton-emoji ${emoji === e ? 'choisi' : ''}`} onClick={() => definirEmoji(e)}>{e}</button>)}
        </div>
        <div className="fenetre-actions"><button className="bouton-annuler" onClick={surFermeture}>Annuler</button><button className="bouton-valider" onClick={enregistrer} disabled={envoi}>{boutique ? 'Mettre à jour' : 'Créer'}</button></div>
      </div>
    </div>
  )
}
