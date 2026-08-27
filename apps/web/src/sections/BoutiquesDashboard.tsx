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
import { Boutiques as Api, getUser, fcfa, type BoutiqueLine, type BoutiquesDashboard as Data } from '../lib/api'
import { SkeletonList } from '../components/Skeleton'
import Avatar from '../components/Avatar'
import type { View } from './Home'
import LoadError from '../components/LoadError'
import { useLoadError } from '../lib/loadError'

export default function BoutiquesDashboard({ onNavigate }: { onNavigate?: (v: View) => void }) {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState<number | null>(null)
  const { error, watch, reset } = useLoadError()
  const active = getUser()?.current_boutique_id

  const load = () => { reset(); watch(Api.dashboard().then(setData)).finally(() => setLoading(false)) }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const activer = async (b: BoutiqueLine) => {
    setSwitching(b.id)
    await Api.switch(b.id)
    const u = getUser()
    if (u) localStorage.setItem('samacommerce_user', JSON.stringify({ ...u, current_boutique_id: b.id }))
    // Rechargement complet : tout l'écran dépend de la boutique active.
    window.location.reload()
  }

  const t = data?.total

  return (
    <>
      <div className="page-header"><h2>📊 Toutes mes boutiques</h2></div>

      <div className="stat-2x2">
        <div className="st st-g"><div className="sv">{t ? fcfa(t.ca_jour) : '—'}</div><div className="sl">💰 Encaissé aujourd'hui</div></div>
        <div className="st st-b"><div className="sv">{t ? t.nb_ventes_jour : '—'}</div><div className="sl">🛒 Ventes du jour</div></div>
        <div className="st st-p"><div className="sv">{t ? fcfa(t.ca_mois) : '—'}</div><div className="sl">📆 Ce mois</div></div>
        <div className="st st-y"><div className="sv">{t ? t.nb_boutiques : '—'}</div><div className="sl">🏬 Boutiques</div></div>
      </div>

      {t && (t.ruptures > 0 || t.credits_impayes > 0) && (
        <div className="alert-stock">
          <div className="alert-title">⚠️ À surveiller, toutes boutiques confondues</div>
          {t.ruptures > 0 && <div className="alert-row"><span>📦 Produits en rupture</span><strong>{t.ruptures}</strong></div>}
          {t.credits_impayes > 0 && <div className="alert-row"><span>📝 Dettes clients non réglées</span><strong>{fcfa(t.credits_impayes)}</strong></div>}
        </div>
      )}

      <div className="section-label">🏬 Détail par boutique</div>

      {loading && <SkeletonList count={2} />}
      {!loading && error && <LoadError error={error} onRetry={load} />}
      {!loading && !error && !data && (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <div className="empty-text">Tableau de bord indisponible</div>
          <div className="empty-sub">Vérifiez votre connexion et réessayez</div>
        </div>
      )}

      {!loading && data?.boutiques.map((b) => {
        const estActive = b.id === active
        const meilleure = data.meilleure?.id === b.id && data.boutiques.length > 1 && b.ca_jour > 0
        return (
          <div key={b.id} className={`card fiche ${estActive ? 'fiche-active' : ''}`}>
            <div className="fiche-head">
              <Avatar photo={b.photo} icon={b.photo ? undefined : (b.emoji || '🏪')} name={b.name} size={52} />
              <div className="fiche-id">
                <div className="fiche-name">
                  {meilleure && <span title="Meilleure vente du jour">🥇 </span>}{b.name}
                  {b.is_primary && <span className="cat-badge" style={{ marginLeft: 6, background: '#EDE9FE', color: 'var(--primary)' }}>⭐ Principale</span>}
                </div>
                <div className="fiche-sub">🛒 {b.nb_ventes_jour} vente(s) aujourd'hui · 👥 {b.nb_membres} membre(s)</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="produit-price-main" style={{ color: b.ca_jour > 0 ? 'var(--green)' : 'var(--muted)' }}>{fcfa(b.ca_jour)}</div>
                <span className="fiche-sub">aujourd'hui</span>
              </div>
            </div>

            <div className="fiche-stats">
              <span className="fst fst-p"><b>{fcfa(b.ca_mois)}</b><span>📆 ce mois</span></span>
              <span className="fst fst-b"><b>{b.nb_produits}</b><span>📦 produits</span></span>
              {b.ruptures > 0 && <span className="fst fst-r"><b>{b.ruptures}</b><span>🚫 ruptures</span></span>}
              {b.ruptures === 0 && b.stock_faible > 0 && <span className="fst"><b>{b.stock_faible}</b><span>⚠️ stock bas</span></span>}
              {b.credits_impayes > 0 && <span className="fst fst-r"><b>{fcfa(b.credits_impayes)}</b><span>📝 dettes</span></span>}
            </div>

            <div className="fiche-actions">
              {estActive
                ? <span className="fa-btn fa-on">✅ Boutique ouverte</span>
                : <button className="fa-btn fa-go" disabled={switching === b.id} onClick={() => activer(b)}>
                    {switching === b.id ? '⏳ Ouverture…' : '🔄 Ouvrir cette boutique'}
                  </button>}
              {estActive && onNavigate && <button className="fa-btn fa-call" onClick={() => onNavigate('rapports')}>📈 Ses chiffres</button>}
            </div>
          </div>
        )
      })}

      <div className="guide" style={{ marginTop: 14 }}>
        <div style={{ fontSize: 22 }}>💡</div>
        <div style={{ fontSize: 12.5, color: 'var(--label)', lineHeight: 1.45 }}>
          Cette page est la seule à réunir vos boutiques. Partout ailleurs — stock, ventes,
          caisse, chiffres — vous ne voyez que la <b>boutique ouverte</b>.
        </div>
      </div>
    </>
  )
}
