import { useEffect, useState } from 'react'
import { login, register, forgotPassword, resetPassword, verify2fa, Members, type User } from '../lib/api'
import { toast } from '../lib/toast'
import { pendingInvite } from '../lib/invite'
import HeroBackdrop from '../components/HeroBackdrop'
import Logo from '../components/Logo'

type Invitation = { boutique: string | null; role: string; email: string; name: string | null }

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  /* Champs VIDES au depart. Ils etaient pre-remplis avec le compte de
     demonstration : un commercant arrivait donc sur un formulaire portant
     l'identifiant de quelqu'un d'autre, et pouvait valider sans regarder — il
     atterrissait alors dans une boutique fictive en croyant voir la sienne.
     On entre desormais en demonstration PARCE QU'ON L'A CHOISI (bouton). */
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState<Invitation | null>(null)
  const [company, setCompany] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [twofaPending, setTwofaPending] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  /* Un employé qui arrive par un lien d'invitation doit voir QUI l'invite, pas
     un formulaire nu. On bascule d'office sur « Inscription » (il n'a en
     général pas de compte) et on préremplit l'email saisi par le patron — les
     identifiants de démonstration seraient ici une fausse piste. */
  useEffect(() => {
    const token = pendingInvite()
    if (!token) return
    Members.preview(token)
      .then((d) => {
        setInvite(d)
        setMode('register')
        if (d.email) setUsername(d.email)
        setPassword('')
        if (d.name) setCompany(d.name)
      })
      .catch(() => { /* jeton mort : l'écran reste une connexion ordinaire */ })
  }, [])

  const apiErr = (err: any, fallback: string) =>
    setError(err?.response?.data?.error || (err?.response?.data?.errors ? Object.values(err.response.data.errors)[0] as string : fallback))

  /* Identifiants de la boutique-vitrine. Ils sont publics par nature : ce
     compte ne contient que des donnees fictives, et le cloisonnement par
     tenant empeche d'y voir quoi que ce soit d'un vrai commercant. */
  const DEMO = { username: 'demo@samacommerce.sn', password: 'password' }

  const essayerDemo = () => {
    setMode('login')
    setError('')
    setUsername(DEMO.username)
    setPassword(DEMO.password)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      if (mode === 'register') { onLogin(await register({ username, password, company_name: company })); return }
      const res = await login(username, password)
      if ('twofa_required' in res) {
        setTwofaPending(true); setCode('')
        toast(res.dev_code ? `Code 2FA (dev) : ${res.dev_code}` : 'Code de vérification envoyé', 'info')
        return
      }
      onLogin(res.user)
    } catch (err: any) {
      apiErr(err, 'Identifiants incorrects.')
    } finally { setLoading(false) }
  }

  const verify = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try { onLogin(await verify2fa(username, code)) }
    catch (err: any) { apiErr(err, 'Code invalide') } finally { setLoading(false) }
  }

  const sendCode = async () => {
    setLoading(true); setError('')
    try {
      const r = await forgotPassword(username)
      setCodeSent(true)
      toast(r.dev_code ? `Code (dev) : ${r.dev_code}` : 'Code envoyé', 'info')
    } catch (err: any) { apiErr(err, 'Erreur') } finally { setLoading(false) }
  }
  const doReset = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      await resetPassword(username, code, password)
      toast('Mot de passe réinitialisé ✅', 'success')
      setMode('login'); setCodeSent(false); setCode('')
    } catch (err: any) { apiErr(err, 'Code invalide') } finally { setLoading(false) }
  }

  return (
    <div className="login-screen">
      <HeroBackdrop />
      <div className="modal-box login-card auth-card" style={{ animation: 'none' }}>
        {/* Bandeau de marque : la carte s'ouvre sur le logo et le violet de
            l'application, pas sur un formulaire. On sait où l'on arrive. */}
        <div className="auth-head">
          <Logo size={64} style={{ margin: '0 auto', borderRadius: 18, boxShadow: '0 6px 18px rgba(0,0,0,.25)' }} />
          <div className="auth-brand">SamaCommerce</div>
          <div className="auth-tag">Gérez votre boutique, même sans réseau</div>
        </div>
        <div className="auth-body">
        {/* Invitation : le nom de la boutique en premier. C'est lui qui dit à
            l'employé qu'il est au bon endroit — pas le jeton du lien. */}
        {invite && !twofaPending && (
          <div className="tone-row" style={{ marginBottom: 14 }}>
            <span className="invite-ico" aria-hidden="true">🤝</span>
            <span style={{ minWidth: 0 }}>
              <span className="invite-t" style={{ display: 'block' }}>{invite.boutique || 'Une boutique'} vous invite</span>
              <span className="invite-s" style={{ display: 'block' }}>
                {invite.role === 'gerant' ? '👔 Gérant' : '🧑‍💼 Vendeur'} · créez votre code d'accès pour entrer
              </span>
            </span>
          </div>
        )}
        {!twofaPending && mode !== 'forgot' && (
          <div className="auth-tabs seg">
            <button type="button" className={`seg-btn ${mode === 'login' ? 'on' : ''}`} onClick={() => { setMode('login'); setError('') }}>Connexion</button>
            <button type="button" className={`seg-btn ${mode === 'register' ? 'on' : ''}`} onClick={() => { setMode('register'); setError('') }}>Inscription</button>
          </div>
        )}
        {twofaPending ? (
          <form onSubmit={verify}>
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>🔐 Vérification en 2 étapes — saisissez le code à 6 chiffres.</div>
            <div className="form-group"><label>Code de vérification</label><input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123456" autoFocus /></div>
            {error && <p style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', margin: '0 0 10px' }}>{error}</p>}
            <button className="btn-confirm" style={{ width: '100%' }} disabled={loading}>{loading ? '…' : '✅ Vérifier'}</button>
            <button type="button" onClick={() => { setTwofaPending(false); setError('') }} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>← Annuler</button>
          </form>
        ) : mode === 'forgot' ? (
          <form onSubmit={doReset}>
            <div className="form-group"><label>Email / identifiant</label><input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" /></div>
            {!codeSent
              ? <button type="button" className="btn-confirm" style={{ width: '100%' }} disabled={loading} onClick={sendCode}>{loading ? '…' : '📩 Recevoir un code'}</button>
              : (
                <>
                  <div className="form-group"><label>Code reçu (6 chiffres)</label><input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123456" /></div>
                  <div className="form-group"><label>Nouveau mot de passe</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                  <button className="btn-confirm" style={{ width: '100%' }} disabled={loading}>{loading ? '…' : '🔒 Réinitialiser'}</button>
                </>
              )}
            {error && <p style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', margin: '10px 0 0' }}>{error}</p>}
          </form>
        ) : (
          <form onSubmit={submit}>
            {/* Un invité ne crée pas une boutique, il rejoint celle du patron :
                ce champ nomme SON compte, d'où le libellé qui change. */}
            {mode === 'register' && (
              <div className="form-group">
                <label>{invite ? '👤 Votre nom' : '🏪 Nom de la boutique'}</label>
                <input value={company} onChange={(e) => setCompany(e.target.value)}
                  placeholder={invite ? 'Ex. Awa Ndiaye' : 'Ex. Boutique Ndiaye'} />
              </div>
            )}
            <div className="form-group"><label>✉️ Email / identifiant</label><input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" /></div>
            <div className="form-group"><label>🔒 Mot de passe</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {error && <p style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', marginBottom: 10 }}>{error}</p>}
            <button className="btn-confirm" style={{ width: '100%' }} disabled={loading}>
              {loading ? '…' : mode === 'login' ? 'Se connecter' : invite ? '🤝 Rejoindre la boutique' : 'Créer ma boutique'}
            </button>
          </form>
        )}
        {/* Essayer avant de s'inscrire : on remplit les champs sous les yeux de
            l'utilisateur plutot que de le connecter d'office, pour qu'il voie
            QUEL compte il ouvre — et qu'il puisse revenir en arriere. */}
        {!twofaPending && mode !== 'forgot' && !invite && (
          <button type="button" className="demo-btn" onClick={essayerDemo} disabled={loading}>
            <span className="demo-btn-ico" aria-hidden="true">👀</span>
            <span className="demo-btn-txt">
              <b>Essayer sans compte</b>
              <small>Boutique de démonstration, rien n'est réel</small>
            </span>
          </button>
        )}
        {!twofaPending && mode === 'login' && (
          <button className="auth-link" style={{ color: 'var(--muted)' }} onClick={() => { setMode('forgot'); setError(''); setCodeSent(false) }}>
            Mot de passe oublié ?
          </button>
        )}
        {!twofaPending && mode === 'forgot' && (
          <button className="auth-link" onClick={() => { setMode('login'); setError(''); setCodeSent(false) }}>
            ← Retour à la connexion
          </button>
        )}
        <div className="auth-note">📴 Fonctionne hors ligne : vos ventes partent au retour du réseau</div>
        </div>
      </div>
    </div>
  )
}
