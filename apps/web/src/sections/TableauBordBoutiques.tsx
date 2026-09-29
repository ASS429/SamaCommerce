/* Tableau de bord MULTI-BOUTIQUE.
 *
 * Le reste de l'application est cloisonné : chaque écran ne montre que la
 * boutique active. Cette page est la seule exception, et c'est sa raison
 * d'être — comparer ses points de vente sans basculer de l'un à l'autre en
 * retenant les chiffres de tête.
 *
 * Lecture sans lire : une carte par boutique, la meilleure du jour porte une
 * médaille, et les alertes (rupture, dette) sont des pastilles colorées.
 */

import { useEffect, useState } from 'react'
import { Boutiques as ApiBoutiques, enregistrerUtilisateur, lireUtilisateur, fcfa, type LigneBoutique, type DonneesTableauBord } from '../outils/api'
import { ListeSquelette } from '../composants/Squelette'
import Avatar from '../composants/Avatar'
import type { Ecran } from './Accueil'
import ErreurChargement from '../composants/ErreurChargement'
import { useErreurChargement } from '../outils/erreursChargement'

export default function TableauBordBoutiques({ surNavigation }: { surNavigation?: (e: Ecran) => void }) {
  const [donnees, definirDonnees] = useState<DonneesTableauBord | null>(null)
  const [chargement, definirChargement] = useState(true)
  const [activation, definirActivation] = useState<number | null>(null)
  const { erreur, surveiller, effacer } = useErreurChargement()
  const boutiqueActiveId = lireUtilisateur()?.boutique_active_id

  const charger = () => { effacer(); surveiller(ApiBoutiques.tableauDeBord().then(definirDonnees)).finally(() => definirChargement(false)) }
  useEffect(() => { charger() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const activer = async (b: LigneBoutique) => {
    definirActivation(b.id)
    await ApiBoutiques.activer(b.id)
    const u = lireUtilisateur()
    if (u) enregistrerUtilisateur({ ...u, boutique_active_id: b.id })
    // Rechargement complet : tout l'écran dépend de la boutique active.
    window.location.reload()
  }

  const total = donnees?.total

  return (
    <>
      <div className="page-entete"><h2>📊 Toutes mes boutiques</h2></div>

      <div className="grille-stats">
        <div className="stat stat-vert"><div className="stat-valeur">{total ? fcfa(total.ca_jour) : '—'}</div><div className="stat-libelle">💰 Encaissé aujourd'hui</div></div>
        <div className="stat stat-bleu"><div className="stat-valeur">{total ? total.nb_ventes_jour : '—'}</div><div className="stat-libelle">🛒 Ventes du jour</div></div>
        <div className="stat stat-violet"><div className="stat-valeur">{total ? fcfa(total.ca_mois) : '—'}</div><div className="stat-libelle">📆 Ce mois</div></div>
        <div className="stat stat-jaune"><div className="stat-valeur">{total ? total.nb_boutiques : '—'}</div><div className="stat-libelle">🏬 Boutiques</div></div>
      </div>

      {total && (total.ruptures > 0 || total.credits_impayes > 0) && (
        <div className="alerte-stock">
          <div className="titre-alerte">⚠️ À surveiller, toutes boutiques confondues</div>
          {total.ruptures > 0 && <div className="ligne-alerte"><span>📦 Produits en rupture</span><strong>{total.ruptures}</strong></div>}
          {total.credits_impayes > 0 && <div className="ligne-alerte"><span>📝 Dettes clients non réglées</span><strong>{fcfa(total.credits_impayes)}</strong></div>}
        </div>
      )}

      <div className="section-libelle">🏬 Détail par boutique</div>

      {chargement && <ListeSquelette nombre={2} />}
      {!chargement && erreur && <ErreurChargement erreur={erreur} surReessai={charger} />}
      {!chargement && !erreur && !donnees && (
        <div className="etat-vide">
          <div className="vide-icone">📊</div>
          <div className="vide-texte">Tableau de bord indisponible</div>
          <div className="vide-sous-titre">Vérifiez votre connexion et réessayez</div>
        </div>
      )}

      {!chargement && donnees?.boutiques.map((b) => {
        const estActive = b.id === boutiqueActiveId
        const meilleure = donnees.meilleure?.id === b.id && donnees.boutiques.length > 1 && b.ca_jour > 0
        return (
          <div key={b.id} className={`carte fiche ${estActive ? 'fiche-active' : ''}`}>
            <div className="fiche-entete">
              <Avatar photo={b.photo} icone={b.photo ? undefined : (b.emoji || '🏪')} nom={b.nom} taille={52} />
              <div className="fiche-identite">
                <div className="fiche-nom">
                  {meilleure && <span title="Meilleure vente du jour">🥇 </span>}{b.nom}
                  {b.est_principale && <span className="cat-pastille" style={{ marginLeft: 6, background: '#EDE9FE', color: 'var(--principal)' }}>⭐ Principale</span>}
                </div>
                <div className="fiche-sous-titre">🛒 {b.nb_ventes_jour} vente(s) aujourd'hui · 👥 {b.nb_membres} membre(s)</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="produit-prix-principal" style={{ color: b.ca_jour > 0 ? 'var(--vert)' : 'var(--attenue)' }}>{fcfa(b.ca_jour)}</div>
                <span className="fiche-sous-titre">aujourd'hui</span>
              </div>
            </div>

            <div className="fiche-chiffres">
              <span className="chiffre chiffre-violet"><b>{fcfa(b.ca_mois)}</b><span>📆 ce mois</span></span>
              <span className="chiffre chiffre-bleu"><b>{b.nb_produits}</b><span>📦 produits</span></span>
              {b.ruptures > 0 && <span className="chiffre chiffre-rouge"><b>{b.ruptures}</b><span>🚫 ruptures</span></span>}
              {b.ruptures === 0 && b.stock_faible > 0 && <span className="chiffre"><b>{b.stock_faible}</b><span>⚠️ stock bas</span></span>}
              {b.credits_impayes > 0 && <span className="chiffre chiffre-rouge"><b>{fcfa(b.credits_impayes)}</b><span>📝 dettes</span></span>}
            </div>

            <div className="fiche-actions">
              {estActive
                ? <span className="fa-bouton fa-actif">✅ Boutique ouverte</span>
                : <button className="fa-bouton fa-aller" disabled={activation === b.id} onClick={() => activer(b)}>
                    {activation === b.id ? '⏳ Ouverture…' : '🔄 Ouvrir cette boutique'}
                  </button>}
              {estActive && surNavigation && <button className="fa-bouton fa-appeler" onClick={() => surNavigation('rapports')}>📈 Ses chiffres</button>}
            </div>
          </div>
        )
      })}

      <div className="guide" style={{ marginTop: 14 }}>
        <div style={{ fontSize: 22 }}>💡</div>
        <div style={{ fontSize: 12.5, color: 'var(--libelle)', lineHeight: 1.45 }}>
          Cette page est la seule à réunir vos boutiques. Partout ailleurs — stock, ventes,
          caisse, chiffres — vous ne voyez que la <b>boutique ouverte</b>.
        </div>
      </div>
    </>
  )
}
