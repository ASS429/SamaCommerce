import { useEffect, useState } from 'react'
import { updateProfile, saveUser, getUser, toggle2fa, logoutAllDevices, Activity, type Activity as Act, type User } from '../lib/api'
import { toast, promptAsync, confirmAsync } from '../lib/toast'
import { enableNotifications, disableNotifications, notifEnabled, notifSupported } from '../lib/notifications'
import { hasPin, setPin, clearPin } from '../lib/pinLock'
import { getThemePref, setThemePref, THEME_LABEL, type ThemePref } from '../lib/theme'
import { TOGGLEABLE, isModuleEnabled, setModuleEnabled, resetModules, autoPrintEnabled, setAutoPrint } from '../lib/modules'
import PhotoPicker from '../components/PhotoPicker'

const ACTION_ICON: Record<string, string> = {
  vente: '🛒', remboursement: '💰', 'produit.ajout': '➕', 'produit.suppr': '🗑️',
  'caisse.cloture': '🔒', 'equipe.invitation': '✉️', 'equipe.retrait': '👋',
}

export default function Profil({ user, onLogout, onUpgrade }: { user: User | null; onLogout: () => void; onUpgrade: () => void }) {
  const [company, setCompany] = useState(user?.company_name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [photo, setPhoto] = useState<string | null>(user?.photo ?? null)
  const [theme, setTheme] = useState<ThemePref>(getThemePref())
  const [autoPrint, setAutoPrintState] = useState(autoPrintEnabled())
  // Rerendu local de la grille des sections (la source de vérité est le storage).
  const [modRev, setModRev] = useState(0)
  const [activity, setActivity] = useState<Act[]>([])
  const [actLoading, setActLoading] = useState(true)
  const [twofa, setTwofa] = useState(!!(user as { twofa_enabled?: boolean } | null)?.twofa_enabled)
  const [notif, setNotif] = useState(notifEnabled())
  const [pinOn, setPinOn] = useState(hasPin())
  const isEmployee = !!user?.is_employee

  const togglePin = async () => {
    if (pinOn) {
      if (await confirmAsync('Retirer le code de verrouillage ?', 'Retirer')) { clearPin(); setPinOn(false); toast('Verrouillage désactivé', 'info') }
      return
    }
    const code = await promptAsync('Choisissez un code à 4 chiffres', '••••')
    if (!code) return
    if (!/^\d{4}$/.test(code)) { toast('Le code doit contenir 4 chiffres', 'error'); return }
    await setPin(code); setPinOn(true); toast('Verrouillage activé 🔒', 'success')
  }

  const logoutEverywhere = async () => {
    if (await confirmAsync('Déconnecter TOUS les appareils connectés à ce compte ?', 'Déconnecter')) {
      await logoutAllDevices(); onLogout()
    }
  }

  const toggleNotif = async () => {
    if (notif) { disableNotifications(); setNotif(false); toast('Notifications désactivées', 'info'); return }
    const ok = await enableNotifications()
    setNotif(ok)
    toast(ok ? 'Notifications activées 🔔' : 'Permission refusée par le navigateur', ok ? 'success' : 'error')
  }

  const toggleTwofa = async () => {
    const next = !twofa; setTwofa(next)
    try { await toggle2fa(next); const cur = getUser(); if (cur) saveUser({ ...cur, twofa_enabled: next } as User); toast(next ? '2FA activée 🔐' : '2FA désactivée', 'success') }
    catch { setTwofa(!next); toast('Erreur', 'error') }
  }

  useEffect(() => { Activity.list().then(setActivity).catch(() => {}).finally(() => setActLoading(false)) }, [])

  const save = async () => {
    setSaving(true)
    try {
      const u = await updateProfile({ company_name: company, phone, photo })
      const cur = getUser()
      if (cur) saveUser({ ...cur, company_name: u.company_name, phone: u.phone, photo: u.photo })
      toast('Profil mis à jour ✅', 'success')
    } catch (e: any) { alert(e?.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  const toggleModule = (view: (typeof TOGGLEABLE)[number]['view'], on: boolean) => {
    setModuleEnabled(view, on)
    setModRev((n) => n + 1)
  }
  const pickTheme = (p: ThemePref, e: React.MouseEvent) => { setTheme(p); setThemePref(p, { x: e.clientX, y: e.clientY }) }

  return (
    <>
      <div className="page-header"><h2>👤 Paramètres</h2></div>

      <div className="card">
        <div className="card-title">🏪 Ma boutique</div>
        {isEmployee ? (
          <div className="alert-row" style={{ background: '#EDE9FE', color: 'var(--primary-dark)', fontWeight: 600 }}>
            Vous êtes employé de « {user?.company_name} ». Le profil est géré par le propriétaire.
          </div>
        ) : (
          <>
            {/* La photo remplace les initiales dans l'en-tête de l'application :
                le commerçant reconnaît SA boutique du premier coup d'œil. */}
            <PhotoPicker value={photo} onChange={setPhoto} name={company} icon="🏪" label="📷 Ma photo / logo (facultatif)" />
            <div className="form-group"><label>Nom de la boutique</label><input value={company} onChange={(e) => setCompany(e.target.value)} /></div>
            <div className="form-group"><label>📞 Téléphone</label><input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <button className="btn-confirm" style={{ width: '100%' }} onClick={save} disabled={saving}>💾 Enregistrer</button>
          </>
        )}
      </div>

      {/* ─── Sections activables ───
          17 sections, mais un vendeur de café n'en utilise que deux. Chacun
          compose son application : ce qui est décoché disparaît de la barre du
          bas et de la colonne de gauche. Les droits, eux, ne bougent pas. */}
      <div className="card">
        <div className="card-title">🧩 Mes fonctionnalités</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
          Touchez pour afficher ou masquer une section. Accueil et Paramètres restent toujours visibles.
        </div>
        <div className="mod-grid" key={modRev}>
          {TOGGLEABLE.filter((m) => !isEmployee || m.view !== 'boutiques').map((m) => {
            const on = isModuleEnabled(m.view)
            return (
              <button key={m.view} className={`mod-card ${on ? 'on' : ''}`} onClick={() => toggleModule(m.view, !on)}
                aria-pressed={on} aria-label={`${m.label} — ${on ? 'affichée' : 'masquée'}`}>
                <span className="mod-icon">{m.icon}</span>
                <span className="mod-label">{m.label}</span>
                <span className="mod-hint">{m.hint}</span>
                <span className="mod-state">{on ? '✅' : '🚫'}</span>
              </button>
            )
          })}
        </div>
        <button className="badge-soft" style={{ marginTop: 12 }} onClick={() => { resetModules(); setModRev((n) => n + 1) }}>↩️ Tout afficher</button>
      </div>

      <div className="card">
        <div className="card-title">⚙️ Préférences</div>
        {/* Trois pastilles imagées plutôt qu'un interrupteur « activé/désactivé » :
            le choix se comprend sans lire. « Auto » = comme le téléphone. */}
        <div style={{ padding: '6px 0 10px' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>🌓 Apparence</div>
          <div className="theme-choice">
            {(['auto', 'light', 'dark'] as ThemePref[]).map((p) => (
              <button key={p} className={`theme-opt ${theme === p ? 'sel' : ''}`} onClick={(e) => pickTheme(p, e)}
                aria-pressed={theme === p} aria-label={`Apparence ${THEME_LABEL[p].label}`}>
                <span className="theme-opt-icon">{THEME_LABEL[p].icon}</span>
                <span className="theme-opt-label">{THEME_LABEL[p].label}</span>
              </button>
            ))}
          </div>
          {theme === 'auto' && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>L'application suit le mode clair/sombre de votre téléphone.</div>}
        </div>
        {notifSupported() && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
            <span style={{ fontWeight: 600 }}>🔔 Notifications stock</span>
            <button className="badge-soft" style={{ background: notif ? '#ECFDF5' : '#F3F4F6', color: notif ? 'var(--green)' : 'var(--muted)' }} onClick={toggleNotif}>{notif ? 'Activées' : 'Désactivées'}</button>
          </div>
        )}
        {!isEmployee && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
            <span style={{ fontWeight: 600 }}>🔐 Double authentification (2FA)</span>
            <button className="badge-soft" style={{ background: twofa ? '#ECFDF5' : '#F3F4F6', color: twofa ? 'var(--green)' : 'var(--muted)' }} onClick={toggleTwofa}>{twofa ? 'Activée' : 'Désactivée'}</button>
          </div>
        )}
        {/* Peu de boutiques ont une imprimante ticket : l'option est donc
            désactivée par défaut, et se règle ici une fois pour toutes. */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '6px 0' }}>
          <span style={{ fontWeight: 600 }}>🖨️ Imprimer le reçu automatiquement</span>
          <button className="badge-soft" style={{ background: autoPrint ? '#ECFDF5' : '#F3F4F6', color: autoPrint ? 'var(--green)' : 'var(--muted)' }}
            onClick={() => { const next = !autoPrint; setAutoPrintState(next); setAutoPrint(next) }}>{autoPrint ? 'Activée' : 'Désactivée'}</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
          <span style={{ fontWeight: 600 }}>🔒 Verrouillage par code (comptoir)</span>
          <button className="badge-soft" style={{ background: pinOn ? '#ECFDF5' : '#F3F4F6', color: pinOn ? 'var(--green)' : 'var(--muted)' }} onClick={togglePin}>{pinOn ? 'Activé' : 'Désactivé'}</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">🛡️ Sécurité du compte</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Vous avez perdu un téléphone ? Déconnectez toutes les sessions actives.</div>
        <button className="pay-btn" style={{ background: '#FEF3C7', color: '#92400E', boxShadow: 'none' }} onClick={logoutEverywhere}>📵 Déconnecter tous les appareils</button>
      </div>

      <div className="card">
        <div className="card-title">💳 Abonnement</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Plan actuel : <b style={{ color: 'var(--primary)' }}>{user?.plan}</b></span>
          {user?.plan === 'Free' && !isEmployee && <button className="btn-primary" onClick={onUpgrade}>⭐ Passer Premium</button>}
        </div>
      </div>

      <div className="card">
        <div className="card-title">🕓 Activité récente</div>
        {actLoading
          ? [0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
              <div className="skeleton" style={{ width: 22, height: 22, borderRadius: '50%' }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 12, width: '60%' }} />
                <div className="skeleton" style={{ height: 10, width: '35%', marginTop: 5 }} />
              </div>
            </div>
          ))
          : activity.length === 0
          ? <div style={{ fontSize: 13, color: 'var(--muted)', padding: '4px 0' }}>Aucune activité pour le moment</div>
          : activity.slice(0, 12).map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }}>
              <span style={{ fontSize: 18 }}>{ACTION_ICON[a.action] || '•'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.detail || a.action}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{a.actor_name} · {(a.created_at || '').slice(0, 16).replace('T', ' ')}</div>
              </div>
            </div>
          ))}
      </div>

      <div className="card">
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Connecté : {user?.username}</div>
        <button className="pay-btn" style={{ background: '#FEE2E2', color: 'var(--red)', boxShadow: 'none' }} onClick={onLogout}>🔓 Se déconnecter</button>
      </div>
    </>
  )
}
