import { useState } from 'react'
import { Categories, type Categorie } from '../outils/api'
import { demanderConfirmation, bulle } from '../outils/bulles'
import { GrilleSquelette } from '../composants/Squelette'
import { iconeProduit } from '../outils/iconeProduit'
import { teinteDe } from '../outils/teinte'
import ErreurChargement from '../composants/ErreurChargement'
import { decrireErreur } from '../outils/erreursChargement'
import { useProduits, useCategories, useRafraichirCatalogue, CLES, LISTE_VIDE } from '../outils/requetes'
import { useQueryClient } from '@tanstack/react-query'

/* Palette d'icônes ORGANISÉE par famille de commerce : on cherche des yeux, pas
   au clavier. L'ordre suit ce qu'on trouve dans une boutique de quartier
   sénégalaise — alimentaire d'abord, puis entretien, puis le reste. */
const GROUPES_EMOJI: { libelle: string; emojis: string[] }[] = [
  { libelle: '🍚 Alimentaire', emojis: ['🍚', '🍞', '🍝', '🌾', '🫘', '🧂', '🍬', '🧴', '🍅', '🧅', '🧄', '🌶️', '🥜', '🍯', '🧈', '🧀', '🥚', '🥫'] },
  { libelle: '🥤 Boissons', emojis: ['💧', '🥤', '🧃', '🥛', '☕', '🍵', '🍶', '🧊'] },
  { libelle: '🐟 Frais', emojis: ['🐟', '🥩', '🍗', '🥬', '🥕', '🥔', '🍌', '🍊', '🥭', '🍉', '🍎', '🍋'] },
  { libelle: '🍪 Snacks', emojis: ['🍪', '🍫', '🍦', '🍟', '🍩', '🥐', '🍭'] },
  { libelle: '🧼 Hygiène & entretien', emojis: ['🧼', '🧻', '🦷', '🍼', '💨', '🧹', '🧽', '💊'] },
  { libelle: '🏠 Maison & divers', emojis: ['🔥', '🕯️', '🔋', '💡', '📱', '🚬', '📒', '🔧', '🧱', '🛒', '🏷️'] },
  { libelle: '👕 Mode', emojis: ['👕', '👖', '👗', '👔', '👟', '👠', '👜', '💍', '⌚', '💄', '🎩'] },
]

export default function SectionCategories() {
  const clientRequetes = useQueryClient()
  const requeteCategories = useCategories()
  const requeteProduits = useProduits()   // sert uniquement au comptage par catégorie
  const categories = requeteCategories.data ?? LISTE_VIDE
  const produits = requeteProduits.data ?? LISTE_VIDE
  const [recherche, definirRecherche] = useState('')
  const [fenetreOuverte, definirFenetreOuverte] = useState(false)
  const [enEdition, definirEnEdition] = useState<Categorie | null>(null)
  const chargement = requeteCategories.isPending
  /* react-query CONSERVE les dernières données valides quand un simple
     RAFRAÎCHISSEMENT échoue. Une requête ratée (API endormie une fois) laissait
     donc l'erreur enregistrée, et le grand bandeau s'affichait par-dessus une
     liste pourtant correcte — l'utilisateur croyait à une panne alors que ses
     produits étaient sous ses yeux.
     Règle : on n'alerte QUE si l'on n'a RIEN à montrer. Si des données sont
     affichées, l'échec devient un bandeau discret avec « Réessayer ». */
  const aDesDonnees = requeteCategories.data !== undefined
  const erreur = decrireErreur(requeteCategories.error)

  const recharger = useRafraichirCatalogue()

  const nombreProduits = (id: number) => produits.filter((p) => p.categorie_id === id).length
  const basculerNegociation = async (c: Categorie) => {
    // Bascule immédiate dans le cache partagé : le point de vente lit la même
    // liste et doit voir tout de suite si l'article devient négociable.
    clientRequetes.setQueryData<Categorie[]>(CLES.categories, (liste) =>
      (liste ?? []).map((x) => x.id === c.id ? { ...x, negociable: !c.negociable } : x))
    try { await Categories.modifier(c.id, { negociable: !c.negociable }) } catch { bulle('Modification non enregistrée', 'erreur'); recharger() }
  }
  const supprimer = async (c: Categorie) => {
    if (!await demanderConfirmation(`Supprimer « ${c.nom} » ?`)) return
    try { await Categories.supprimer(c.id); recharger() } catch (e: any) { alert(e?.response?.data?.erreur || 'Suppression impossible') }
  }
  const filtrees = categories.filter((c) => c.nom.toLowerCase().includes(recherche.toLowerCase()))

  return (
    <>
      <div className="page-entete"><h2>🏷️ Catégories</h2><button className="bouton-principal" onClick={() => { definirEnEdition(null); definirFenetreOuverte(true) }}>+ Ajouter</button></div>
      <input className="barre-recherche" placeholder="🔍 Rechercher une catégorie..." value={recherche} onChange={(e) => definirRecherche(e.target.value)} />

      {chargement && <GrilleSquelette nombre={6} />}
      {!chargement && erreur && <ErreurChargement erreur={erreur} surReessai={recharger} compacte={aDesDonnees} />}
      {!chargement && !erreur && filtrees.length === 0 && (
        <div className="etat-vide">
          <div className="vide-icone">🏷️</div>
          <div className="vide-texte">{categories.length === 0 ? 'Aucune catégorie' : 'Aucun résultat'}</div>
          <div className="vide-sous-titre">{categories.length === 0 ? 'Rangez vos produits par famille : riz, boissons, savons…' : 'Essayez un autre nom'}</div>
        </div>
      )}

      {/* Chaque rayon porte SA couleur, déduite de son nom (outils/teinte). Le
          commerçant retrouve « Boissons » à sa couleur sans lire l'étiquette,
          et la teinte ne change pas quand il en ajoute une autre. */}
      {!chargement && (
        <div className="grille-categories">
          {filtrees.map((c) => (
            <div key={c.id} className={`cat-carte cat-carte--teinte tuile-${teinteDe(c.nom)}`}>
              <div className="cat-outils">
                <button className="cat-outil" aria-label={`Modifier ${c.nom}`} onClick={() => { definirEnEdition(c); definirFenetreOuverte(true) }}>✏️</button>
                <button className="cat-outil cat-supprimer" aria-label={`Supprimer ${c.nom}`} onClick={() => supprimer(c)}>🗑️</button>
              </div>
              <span className="cat-emoji">{c.emoji}</span>
              <span className="cat-nom">{c.nom}</span>
              <span className="cat-pastille">📦 {nombreProduits(c.id)} produit(s)</span>
              <button className="cat-pastille" style={{ cursor: 'pointer', border: 'none' }}
                onClick={() => basculerNegociation(c)} aria-pressed={!!c.negociable}
                title="Autoriser le marchandage pour cette catégorie">
                {c.negociable ? '💬 Négociable' : '🔒 Prix fixe'}
              </button>
            </div>
          ))}
        </div>
      )}

      {fenetreOuverte && <FenetreCategorie categorie={enEdition} surFermeture={() => definirFenetreOuverte(false)} surEnregistrement={() => { definirFenetreOuverte(false); recharger() }} />}
    </>
  )
}

function FenetreCategorie({ categorie, surFermeture, surEnregistrement }: { categorie: Categorie | null; surFermeture: () => void; surEnregistrement: () => void }) {
  const [nom, definirNom] = useState(categorie?.nom ?? '')
  const [emoji, definirEmoji] = useState(categorie?.emoji || '🏷️')
  const [choisiALaMain, definirChoisiALaMain] = useState(!!categorie) // l'utilisateur a-t-il choisi l'icône lui-même ?
  const [negociable, definirNegociable] = useState(!!categorie?.negociable)
  const [envoi, definirEnvoi] = useState(false)

  /* Suggestion automatique : « Boissons » propose 🥤 avant même que le
     commerçant ouvre la grille. Le même moteur que les produits, donc la
     catégorie et ses articles portent des images cohérentes. */
  const surNom = (v: string) => {
    definirNom(v)
    if (!choisiALaMain) {
      const suggestion = iconeProduit(v)
      definirEmoji(suggestion === '📦' ? '🏷️' : suggestion)
    }
  }

  const enregistrer = async () => {
    if (!nom.trim()) return alert('Le nom est requis')
    definirEnvoi(true)
    const charge = { nom: nom.trim(), emoji, negociable }
    try { if (categorie) await Categories.modifier(categorie.id, charge); else await Categories.creer(charge); surEnregistrement() }
    catch (e: any) { alert(e?.response?.data?.erreur || 'Erreur') } finally { definirEnvoi(false) }
  }

  return (
    <div className="fenetre-calque" onClick={surFermeture}>
      <div className="fenetre-boite" onClick={(e) => e.stopPropagation()}>
        <div className="fenetre-titre">{categorie ? '✏️ Modifier la catégorie' : '🏷️ Nouvelle catégorie'}</div>

        <div className="cat-apercu"><span>{emoji}</span><b>{nom || 'Nom de la catégorie'}</b></div>

        <div className="groupe-champ"><label>Nom</label><input value={nom} onChange={(e) => surNom(e.target.value)} placeholder="Ex. Boissons, Savons, Céréales" autoFocus /></div>

        <div className="groupe-champ"><label>Icône — touchez une image</label></div>
        <div className="groupes-emoji">
          {GROUPES_EMOJI.map((g) => (
            <div key={g.libelle}>
              <div className="groupe-emoji-libelle">{g.libelle}</div>
              <div className="grille-emoji">
                {g.emojis.map((e) => (
                  <button key={e} type="button" className={`bouton-emoji ${emoji === e ? 'choisi' : ''}`}
                    onClick={() => { definirEmoji(e); definirChoisiALaMain(true) }} aria-label={`Icône ${e}`} aria-pressed={emoji === e}>{e}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, margin: '10px 0 12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={negociable} onChange={(e) => definirNegociable(e.target.checked)} style={{ width: 18, height: 18 }} />
          💬 Prix négociable (marchandage autorisé)
        </label>

        <div className="fenetre-actions">
          <button className="bouton-annuler" onClick={surFermeture}>Annuler</button>
          <button className="bouton-valider" onClick={enregistrer} disabled={envoi}>{categorie ? 'Mettre à jour' : 'Ajouter'}</button>
        </div>
      </div>
    </div>
  )
}
