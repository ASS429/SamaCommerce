import { useEffect, useState } from 'react'
import { Stats, Members, Caisse, fcfa, type User } from '../lib/api'
import { t, getLang, setLang, LANGS, type Lang } from '../lib/i18n'
import { cycleTheme, getThemePref, THEME_LABEL, type ThemePref } from '../lib/theme'

export type View = 'menu' | 'dashboard' | 'vente' | 'stock' | 'categories' | 'rapports' | 'inventaire' | 'credits'
  | 'clients' | 'fournisseurs' | 'caisse' | 'commandes' | 'returns' | 'livraisons' | 'boutiques' | 'equipe' | 'profil' | 'ia'

const BUTTONS: { view: View; emoji: string; key: string; sub: string; ai: string; featured?: boolean }[] = [
  { view: 'vente', emoji: '🛒', key: 'btn.sell', sub: 'Encaisser une nouvelle vente', ai: '', featured: true },
  { view: 'stock', emoji: '📦', key: 'btn.stock', sub: 'Inventaire & stock', ai: 'ai-green' },
  { view: 'credits', emoji: '🤝', key: 'btn.credits', sub: 'Dettes clients', ai: 'ai-blue' },
  { view: 'rapports', emoji: '📊', key: 'btn.reports', sub: 'Ventes & marges', ai: 'ai-orange' },
  { view: 'categories', emoji: '🗂️', key: 'btn.categories', sub: 'Organiser', ai: 'ai-gray' },
]

export default function Home({ user, can, onNavigate, onLogout, onUpgrade, desktop, stats }: {
  user: User | null
  can: (v: View) => boolean
  onNavigate: (v: View) => void
  onLogout: () => void
  onUpgrade: () => void
  desktop?: boolean
  stats?: { ca: number; articles: number; stock: number }
}) {
  const [alertes, setAlertes] = useState<{ produit: string; stock: number }[]>([])
  const [guide, setGuide] = useState(true)
  const [theme, setTheme] = useState<ThemePref>(getThemePref())
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showJoin, setShowJoin] = useState(false)
  const [weekly, setWeekly] = useState<{ date: string; total_encaisse: number }[]>([])

  useEffect(() => { Stats.stockFaible(5).then(setAlertes).catch(() => setAlertes([])) }, [])
  useEffect(() => { if (desktop) Caisse.weekly().then(setWeekly).catch(() => {}) }, [desktop])

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const cycleLang = () => {
    const order: Lang[] = ['fr', 'wo', 'en']
    const next = order[(order.indexOf(getLang()) + 1) % order.length]
    setLang(next)
    window.location.reload()
  }

  // Auto → Clair → Sombre. « Auto » suit le réglage du téléphone.
  const nextTheme = (e: React.MouseEvent) => setTheme(cycleTheme({ x: e.clientX, y: e.clientY }))

  return (
    <>
      {desktop && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
            <div>
              <div className="sora" style={{ fontSize: 23, fontWeight: 800 }}>Bonjour {user?.company_name || ''} 👋</div>
              <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>Voici l'activité de ta boutique aujourd'hui</div>
            </div>
            <button className="btn-encaisser" style={{ width: 'auto', padding: '13px 22px' }} onClick={() => onNavigate('vente')}>＋ Nouvelle vente</button>
          </div>
          <div className="stat-2x2" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            <div className="st st-p"><div className="sv">{fcfa(stats?.ca || 0)}</div><div className="sl">Encaissé aujourd'hui</div></div>
            <div className="st st-b"><div className="sv">{stats?.articles || 0}</div><div className="sl">Articles vendus</div></div>
            <div className="st st-y"><div className="sv">{stats?.stock || 0}</div><div className="sl">Réf. en stock</div></div>
            <div className="st st-g"><div className="sv">👑 {user?.plan}</div><div className="sl">Abonnement</div></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 4 }}>
            <div className="card">
              <div className="card-title">📅 Encaissements — 7 derniers jours</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150, padding: '8px 0' }}>
                {weekly.length === 0
                  ? <div style={{ color: 'var(--muted)', fontSize: 13, margin: 'auto' }}>Pas encore de données</div>
                  : weekly.map((d, i) => {
                    const max = Math.max(1, ...weekly.map((x) => Number(x.total_encaisse)))
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }} title={fcfa(Number(d.total_encaisse))}>
                        <div style={{ width: '100%', background: 'linear-gradient(180deg, var(--brand-light), var(--brand))', borderRadius: 7, height: `${(Number(d.total_encaisse) / max) * 115}px`, minHeight: 3, transition: 'height .3s' }} />
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{(d.date || '').slice(8, 10)}/{(d.date || '').slice(5, 7)}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
            <div className="card" style={{ background: 'var(--warning-bg)', borderColor: 'var(--warning-border)' }}>
              <div className="card-title" style={{ color: '#9a4a06' }}>⚠️ Alertes de stock</div>
              {alertes.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>Aucune alerte 🎉</div>
                : alertes.slice(0, 5).map((a, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderTop: i ? '1px solid var(--warning-border)' : 'none', fontSize: 13 }}>
                    <span style={{ color: '#9a4a06' }}>{a.produit}</span>
                    <button className="prd-btn prd-btn-edit" style={{ padding: '5px 10px' }} onClick={() => onNavigate('commandes')}>Commander · {a.stock}</button>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      <div className="top-actions">
        <button className="btn-logout" onClick={onLogout}>🔓 Déconnexion</button>
        <button className="badge-soft" style={{ background: '#EDE9FE', color: 'var(--primary)' }} onClick={nextTheme}
          title="Thème : automatique (comme le téléphone), clair ou sombre">{THEME_LABEL[theme].icon} {THEME_LABEL[theme].label}</button>
        {installPrompt && <button className="badge-soft" style={{ background: '#ECFDF5', color: 'var(--green)' }} onClick={install}>📲 Installer</button>}
        <button className="badge-soft" style={{ background: '#EFF6FF', color: 'var(--blue)' }} onClick={cycleLang}>{LANGS.find((l) => l.code === getLang())?.label}</button>
        {user?.plan === 'Free' && <button className="badge-soft" onClick={onUpgrade}>⭐ Passer Premium</button>}
      </div>

      {guide && (
        // Parcours en 3 étapes montré par l'IMAGE : une liste de phrases est
        // illisible pour un commerçant peu alphabétisé, et elle repoussait le
        // bouton « Vendre » hors de l'écran. Ici, 3 pictogrammes et 1 mot.
        <div className="guide">
          <div className="guide-steps">
            <button className="guide-step" onClick={() => onNavigate('stock')}>
              <span className="guide-step-icon" style={{ background: '#DBEAFE' }}>📦</span>
              <span>Remplir</span>
            </button>
            <span className="guide-arrow" aria-hidden="true">→</span>
            <button className="guide-step" onClick={() => onNavigate('vente')}>
              <span className="guide-step-icon" style={{ background: '#DCFCE7' }}>🛒</span>
              <span>Vendre</span>
            </button>
            <span className="guide-arrow" aria-hidden="true">→</span>
            <button className="guide-step" onClick={() => onNavigate('rapports')}>
              <span className="guide-step-icon" style={{ background: '#FEF3C7' }}>💰</span>
              <span>Gagner</span>
            </button>
          </div>
          <button className="guide-close" onClick={() => setGuide(false)} aria-label="Masquer le guide">✕</button>
        </div>
      )}

      {alertes.length > 0 && (
        <div className="alert-stock">
          <div className="alert-title">⚠️ Stock presque épuisé</div>
          {alertes.map((a, i) => (
            <div className="alert-row" key={i}><span>{a.produit}</span><strong>{a.stock} restant(s)</strong></div>
          ))}
        </div>
      )}

      {user?.is_employee && (
        <div className="alert-row" style={{ background: '#EDE9FE', color: 'var(--primary-dark)', marginBottom: 12, fontWeight: 600 }}>
          🧑‍💼 Vous êtes connecté en tant qu'employé{user?.company_name ? ` · ${user.company_name}` : ''}
        </div>
      )}

      <div className="section-label">{t('home.quickActions')}</div>
      <div className="action-grid">
        {BUTTONS.filter((b) => can(b.view)).map((b) => (
          <button key={b.view} className={`action-btn ${b.featured ? 'featured' : ''}`} onClick={() => onNavigate(b.view)}>
            <div className={`ai ${b.ai}`}>{b.emoji}</div>
            <div>
              <div className="at">{t(b.key)}</div>
              <div className="as">{b.sub}</div>
            </div>
            {b.featured && <span style={{ marginLeft: 'auto', fontSize: 20 }}>›</span>}
          </button>
        ))}
      </div>

      {!user?.is_employee && (
        <button className="badge-soft" style={{ marginTop: 14, background: '#EFF6FF', color: 'var(--blue)' }} onClick={() => setShowJoin(true)}>
          🤝 Rejoindre une boutique (code d'invitation)
        </button>
      )}
      {showJoin && <JoinModal onClose={() => setShowJoin(false)} />}
    </>
  )
}

function JoinModal({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const join = async () => {
    if (!token.trim()) return alert('Collez le code d\'invitation')
    setSaving(true)
    try {
      const d = await Members.accept(token.trim().replace(/.*invite=/, ''))
      alert(`✅ ${d.message} — rôle : ${d.role}`)
      window.location.reload()
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Code invalide ou expiré')
    } finally { setSaving(false) }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">🤝 Rejoindre une boutique</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Collez le code (ou lien) d'invitation reçu du propriétaire :</p>
        <div className="form-group"><input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Code ou lien d'invitation" /></div>
        <div className="modal-actions"><button className="btn-cancel" onClick={onClose}>Annuler</button><button className="btn-confirm" onClick={join} disabled={saving}>Rejoindre</button></div>
      </div>
    </div>
  )
}
