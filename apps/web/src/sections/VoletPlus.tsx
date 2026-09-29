import type { Ecran } from './Accueil'
import { traduire } from '../outils/traductions'

type Element = { ecran?: Ecran; icone: string; fond: string; titre: string; sousTitre: string; bientot?: boolean }

const ELEMENTS: Element[] = [
  { ecran: 'vente', icone: '🛒', fond: '#ECFDF5', titre: 'Vendre', sousTitre: 'Encaisser une vente' },
  { ecran: 'stock', icone: '📦', fond: '#EFF6FF', titre: 'Stock', sousTitre: 'Gérer les produits' },
  { ecran: 'categories', icone: '🏷️', fond: '#EDE9FE', titre: 'Catégories', sousTitre: 'Organiser les produits' },
  { ecran: 'rapports', icone: '📈', fond: '#FFFBEB', titre: 'Chiffres', sousTitre: 'Ventes & graphiques' },
  { ecran: 'ia', icone: '🤖', fond: '#EDE9FE', titre: 'Réappro IA', sousTitre: 'Prévision & réassort' },
  { ecran: 'credits', icone: '📝', fond: '#FCE7F3', titre: 'Crédits', sousTitre: 'Dettes clients' },
  { ecran: 'inventaire', icone: '📋', fond: '#EFF6FF', titre: 'Inventaire', sousTitre: 'Bénéfices & marges' },
  { ecran: 'clients', icone: '👤', fond: '#FCE7F3', titre: 'Clients', sousTitre: 'Fichier clients' },
  { ecran: 'fournisseurs', icone: '🚚', fond: '#FEF3C7', titre: 'Fournisseurs', sousTitre: 'Vos fournisseurs' },
  { ecran: 'commandes', icone: '📋', fond: '#F0FDF4', titre: 'Commandes', sousTitre: 'Réappro fournisseurs' },
  { ecran: 'livraisons', icone: '🛵', fond: '#EFF6FF', titre: 'Livraisons', sousTitre: 'Suivi des réappros' },
  { ecran: 'caisse', icone: '💰', fond: '#FFFBEB', titre: 'Caisse', sousTitre: 'Clôture de journée' },
  { ecran: 'retours', icone: '↩️', fond: '#FEE2E2', titre: 'Retours', sousTitre: 'Retours & remboursements' },
  { ecran: 'equipe', icone: '👥', fond: '#EFF6FF', titre: 'Équipe', sousTitre: 'Membres & rôles' },
  { ecran: 'boutiques', icone: '🏬', fond: '#EDE9FE', titre: 'Boutiques', sousTitre: 'Multi-boutique' },
  { ecran: 'profil', icone: '⚙️', fond: '#F3F4F6', titre: 'Paramètres', sousTitre: 'Profil & préférences' },
]

/* Volet « toutes les fonctions ».
 *
 * C'était une liste verticale de 16 lignes : il fallait faire défiler pour
 * atteindre les six dernières, et chaque ligne se lisait au texte. En grille de
 * quatre, tout tient d'un seul écran et l'on vise directement le pictogramme —
 * comme sur l'écran d'accueil d'un téléphone. */
export default function VoletPlus({ peutVoir, surFermeture, surNavigation }: { peutVoir: (e: Ecran) => boolean; surFermeture: () => void; surNavigation: (e: Ecran) => void }) {
  const elements = ELEMENTS.filter((el) => !el.ecran || peutVoir(el.ecran))
  return (
    <div className="fenetre-calque" onClick={surFermeture} style={{ alignItems: 'flex-end' }}>
      <div className="fenetre-boite" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, borderRadius: '22px 22px 0 0' }}>
        <div className="fenetre-titre">{traduire('plus.titre')}</div>
        <div className="volet-grille">
          {elements.map((el) => (
            <button key={el.titre} className="volet-tuile"
              disabled={el.bientot}
              onClick={() => el.ecran && surNavigation(el.ecran)}
              title={el.sousTitre}
              style={{ opacity: el.bientot ? 0.5 : 1, cursor: el.bientot ? 'default' : 'pointer' }}>
              <span className="volet-tuile-icone" style={{ background: el.fond }} aria-hidden="true">{el.bientot ? '🔒' : el.icone}</span>
              <span className="volet-tuile-libelle">{el.ecran ? traduire('nav.' + el.ecran) : el.titre}</span>
            </button>
          ))}
        </div>
        <button className="bouton-annuler" style={{ width: '100%', marginTop: 14 }} onClick={surFermeture}>{traduire('commun.fermer')}</button>
      </div>
    </div>
  )
}
