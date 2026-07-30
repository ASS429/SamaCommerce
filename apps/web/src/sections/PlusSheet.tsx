import type { View } from './Home'
import { t } from '../lib/i18n'

type Item = { view?: View; icon: string; bg: string; title: string; sub: string; soon?: boolean }

const ITEMS: Item[] = [
  { view: 'vente', icon: '🛒', bg: '#ECFDF5', title: 'Vendre', sub: 'Encaisser une vente' },
  { view: 'stock', icon: '📦', bg: '#EFF6FF', title: 'Stock', sub: 'Gérer les produits' },
  { view: 'categories', icon: '🏷️', bg: '#EDE9FE', title: 'Catégories', sub: 'Organiser les produits' },
  { view: 'rapports', icon: '📈', bg: '#FFFBEB', title: 'Chiffres', sub: 'Ventes & graphiques' },
  { view: 'ia', icon: '🤖', bg: '#EDE9FE', title: 'Réappro IA', sub: 'Prévision & réassort' },
  { view: 'credits', icon: '📝', bg: '#FCE7F3', title: 'Crédits', sub: 'Dettes clients' },
  { view: 'inventaire', icon: '📋', bg: '#EFF6FF', title: 'Inventaire', sub: 'Bénéfices & marges' },
  { view: 'clients', icon: '👤', bg: '#FCE7F3', title: 'Clients', sub: 'Fichier clients' },
  { view: 'fournisseurs', icon: '🚚', bg: '#FEF3C7', title: 'Fournisseurs', sub: 'Vos fournisseurs' },
  { view: 'commandes', icon: '📋', bg: '#F0FDF4', title: 'Commandes', sub: 'Réappro fournisseurs' },
  { view: 'livraisons', icon: '🛵', bg: '#EFF6FF', title: 'Livraisons', sub: 'Suivi des réappros' },
  { view: 'caisse', icon: '💰', bg: '#FFFBEB', title: 'Caisse', sub: 'Clôture de journée' },
  { view: 'returns', icon: '↩️', bg: '#FEE2E2', title: 'Retours', sub: 'Retours & remboursements' },
  { view: 'equipe', icon: '👥', bg: '#EFF6FF', title: 'Équipe', sub: 'Membres & rôles' },
  { view: 'boutiques', icon: '🏬', bg: '#EDE9FE', title: 'Boutiques', sub: 'Multi-boutique' },
  { view: 'profil', icon: '⚙️', bg: '#F3F4F6', title: 'Paramètres', sub: 'Profil & préférences' },
]

/* Feuille « toutes les fonctions ».
 *
 * C'était une liste verticale de 16 lignes : il fallait faire défiler pour
 * atteindre les six dernières, et chaque ligne se lisait au texte. En grille de
 * quatre, tout tient d'un seul écran et l'on vise directement le pictogramme —
 * comme sur l'écran d'accueil d'un téléphone. */
export default function PlusSheet({ can, onClose, onNavigate }: { can: (v: View) => boolean; onClose: () => void; onNavigate: (v: View) => void }) {
  const items = ITEMS.filter((it) => !it.view || can(it.view))
  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-end' }}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, borderRadius: '22px 22px 0 0' }}>
        <div className="modal-title">{t('plus.title')}</div>
        <div className="sheet-grid">
          {items.map((it) => (
            <button key={it.title} className="sheet-tile"
              disabled={it.soon}
              onClick={() => it.view && onNavigate(it.view)}
              title={it.sub}
              style={{ opacity: it.soon ? 0.5 : 1, cursor: it.soon ? 'default' : 'pointer' }}>
              <span className="sheet-tile-ico" style={{ background: it.bg }} aria-hidden="true">{it.soon ? '🔒' : it.icon}</span>
              <span className="sheet-tile-l">{it.view ? t('nav.' + it.view) : it.title}</span>
            </button>
          ))}
        </div>
        <button className="btn-cancel" style={{ width: '100%', marginTop: 14 }} onClick={onClose}>{t('common.close')}</button>
      </div>
    </div>
  )
}
