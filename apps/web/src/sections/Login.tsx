import { useState } from 'react'
import { login, register, forgotPassword, resetPassword, verify2fa, type User } from '../lib/api'
import { toast } from '../lib/toast'
import HeroBackdrop from '../components/HeroBackdrop'
import Logo from '../components/Logo'

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [username, setUsername] = useState('demo@samacommerce.sn')
  const [password, setPassword] = useState('password')
  const [company, setCompany] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [twofaPending, setTwofaPending] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const apiErr = (err: any, fallback: string) =>
    setError(err?.response?.data?.error || (err?.response?.data?.errors ? Object.values(err.response.data.errors)[0] as string : fallback))

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
            {mode === 'register' && <div className="form-group"><label>🏪 Nom de la boutique</label><input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Ex. Boutique Ndiaye" /></div>}
            <div className="form-group"><label>✉️ Email / identifiant</label><input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" /></div>
            <div className="form-group"><label>🔒 Mot de passe</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {error && <p style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', marginBottom: 10 }}>{error}</p>}
            <button className="btn-confirm" style={{ width: '100%' }} disabled={loading}>{loading ? '…' : mode === 'login' ? 'Se connecter' : 'Créer ma boutique'}</button>
          </form>
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
