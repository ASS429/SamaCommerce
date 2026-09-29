import { useEffect, useState } from 'react'
import { connecter, inscrire, motDePasseOublie, reinitialiserMotDePasse, verifierDoubleFacteur, Membres, type Utilisateur } from '../outils/api'
import { bulle } from '../outils/bulles'
import { invitationEnAttente } from '../outils/invitation'
import FondBanniere from '../composants/FondBanniere'
import Logo from '../composants/Logo'

type Invitation = { boutique: string | null; role: string; email: string; nom: string | null }

export default function Connexion({ surConnexion }: { surConnexion: (u: Utilisateur) => void }) {
  const [mode, definirMode] = useState<'connexion' | 'inscription' | 'oubli'>('connexion')
  /* Champs VIDES au départ. Ils étaient préremplis avec le compte de
     démonstration : un commerçant arrivait donc sur un formulaire portant
     l'identifiant de quelqu'un d'autre, et pouvait valider sans regarder — il
     atterrissait alors dans une boutique fictive en croyant voir la sienne.
     On entre désormais en démonstration PARCE QU'ON L'A CHOISI (bouton). */
  const [identifiant, definirIdentifiant] = useState('')
  const [motDePasse, definirMotDePasse] = useState('')
  const [invitation, definirInvitation] = useState<Invitation | null>(null)
  const [nomCommerce, definirNomCommerce] = useState('')
  const [code, definirCode] = useState('')
  const [codeEnvoye, definirCodeEnvoye] = useState(false)
  const [doubleFacteurEnAttente, definirDoubleFacteurEnAttente] = useState(false)
  const [erreur, definirErreur] = useState('')
  const [chargement, definirChargement] = useState(false)

  /* Un employé qui arrive par un lien d'invitation doit voir QUI l'invite, pas
     un formulaire nu. On bascule d'office sur « Inscription » (il n'a en
     général pas de compte) et on préremplit l'email saisi par le patron — les
     identifiants de démonstration seraient ici une fausse piste. */
  useEffect(() => {
    const jeton = invitationEnAttente()
    if (!jeton) return
    Membres.apercu(jeton)
      .then((d) => {
        definirInvitation(d)
        definirMode('inscription')
        if (d.email) definirIdentifiant(d.email)
        definirMotDePasse('')
        if (d.nom) definirNomCommerce(d.nom)
      })
      .catch(() => { /* jeton mort : l'écran reste une connexion ordinaire */ })
  }, [])

  const erreurApi = (e: any, repli: string) =>
    definirErreur(e?.response?.data?.erreur || (e?.response?.data?.errors ? Object.values(e.response.data.errors)[0] as string : repli))

  /* Identifiants de la boutique-vitrine. Ils sont publics par nature : ce
     compte ne contient que des données fictives, et le cloisonnement par
     propriétaire empêche d'y voir quoi que ce soit d'un vrai commerçant. */
  const DEMO = { identifiant: 'demo@samacommerce.sn', motDePasse: 'password' }

  const essayerDemo = () => {
    definirMode('connexion')
    definirErreur('')
    definirIdentifiant(DEMO.identifiant)
    definirMotDePasse(DEMO.motDePasse)
  }

  const valider = async (e: React.FormEvent) => {
    e.preventDefault(); definirChargement(true); definirErreur('')
    try {
      if (mode === 'inscription') { surConnexion(await inscrire({ identifiant, mot_de_passe: motDePasse, nom_commerce: nomCommerce })); return }
      const resultat = await connecter(identifiant, motDePasse)
      if ('double_facteur_requis' in resultat) {
        definirDoubleFacteurEnAttente(true); definirCode('')
        bulle(resultat.code_dev ? `Code 2FA (dev) : ${resultat.code_dev}` : 'Code de vérification envoyé', 'info')
        return
      }
      surConnexion(resultat.utilisateur)
    } catch (e: any) {
      erreurApi(e, 'Identifiants incorrects.')
    } finally { definirChargement(false) }
  }

  const verifier = async (e: React.FormEvent) => {
    e.preventDefault(); definirChargement(true); definirErreur('')
    try { surConnexion(await verifierDoubleFacteur(identifiant, code)) }
    catch (e: any) { erreurApi(e, 'Code invalide') } finally { definirChargement(false) }
  }

  const envoyerCode = async () => {
    definirChargement(true); definirErreur('')
    try {
      const r = await motDePasseOublie(identifiant)
      definirCodeEnvoye(true)
      bulle(r.code_dev ? `Code (dev) : ${r.code_dev}` : 'Code envoyé', 'info')
    } catch (e: any) { erreurApi(e, 'Erreur') } finally { definirChargement(false) }
  }
  const reinitialiser = async (e: React.FormEvent) => {
    e.preventDefault(); definirChargement(true); definirErreur('')
    try {
      await reinitialiserMotDePasse(identifiant, code, motDePasse)
      bulle('Mot de passe réinitialisé ✅', 'succes')
      definirMode('connexion'); definirCodeEnvoye(false); definirCode('')
    } catch (e: any) { erreurApi(e, 'Code invalide') } finally { definirChargement(false) }
  }

  return (
    <div className="ecran-connexion">
      <FondBanniere />
      <div className="fenetre-boite carte-verre carte-connexion" style={{ animation: 'none' }}>
        {/* Bandeau de marque : la carte s'ouvre sur le logo et le violet de
            l'application, pas sur un formulaire. On sait où l'on arrive. */}
        <div className="entete-connexion">
          <Logo taille={64} style={{ margin: '0 auto', borderRadius: 18, boxShadow: '0 6px 18px rgba(0,0,0,.25)' }} />
          <div className="marque-connexion">SamaCommerce</div>
          <div className="slogan-connexion">Gérez votre boutique, même sans réseau</div>
        </div>
        <div className="corps-connexion">
        {/* Invitation : le nom de la boutique en premier. C'est lui qui dit à
            l'employé qu'il est au bon endroit — pas le jeton du lien. */}
        {invitation && !doubleFacteurEnAttente && (
          <div className="bandeau-couleur" style={{ marginBottom: 14 }}>
            <span className="bandeau-icone" aria-hidden="true">🤝</span>
            <span style={{ minWidth: 0 }}>
              <span className="bandeau-titre" style={{ display: 'block' }}>{invitation.boutique || 'Une boutique'} vous invite</span>
              <span className="bandeau-sous-titre" style={{ display: 'block' }}>
                {invitation.role === 'gerant' ? '👔 Gérant' : '🧑‍💼 Vendeur'} · créez votre code d'accès pour entrer
              </span>
            </span>
          </div>
        )}
        {!doubleFacteurEnAttente && mode !== 'oubli' && (
          <div className="onglets-connexion segments">
            <button type="button" className={`segment ${mode === 'connexion' ? 'allume' : ''}`} onClick={() => { definirMode('connexion'); definirErreur('') }}>Connexion</button>
            <button type="button" className={`segment ${mode === 'inscription' ? 'allume' : ''}`} onClick={() => { definirMode('inscription'); definirErreur('') }}>Inscription</button>
          </div>
        )}
        {doubleFacteurEnAttente ? (
          <form onSubmit={verifier}>
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--attenue)', marginBottom: 14 }}>🔐 Vérification en 2 étapes — saisissez le code à 6 chiffres.</div>
            <div className="groupe-champ"><label>Code de vérification</label><input value={code} onChange={(e) => definirCode(e.target.value)} inputMode="numeric" placeholder="123456" autoFocus /></div>
            {erreur && <p style={{ color: 'var(--rouge)', fontSize: 13, textAlign: 'center', margin: '0 0 10px' }}>{erreur}</p>}
            <button className="bouton-valider" style={{ width: '100%' }} disabled={chargement}>{chargement ? '…' : '✅ Vérifier'}</button>
            <button type="button" onClick={() => { definirDoubleFacteurEnAttente(false); definirErreur('') }} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: 'var(--principal)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>← Annuler</button>
          </form>
        ) : mode === 'oubli' ? (
          <form onSubmit={reinitialiser}>
            <div className="groupe-champ"><label>Email / identifiant</label><input value={identifiant} onChange={(e) => definirIdentifiant(e.target.value)} autoCapitalize="none" /></div>
            {!codeEnvoye
              ? <button type="button" className="bouton-valider" style={{ width: '100%' }} disabled={chargement} onClick={envoyerCode}>{chargement ? '…' : '📩 Recevoir un code'}</button>
              : (
                <>
                  <div className="groupe-champ"><label>Code reçu (6 chiffres)</label><input value={code} onChange={(e) => definirCode(e.target.value)} inputMode="numeric" placeholder="123456" /></div>
                  <div className="groupe-champ"><label>Nouveau mot de passe</label><input type="password" value={motDePasse} onChange={(e) => definirMotDePasse(e.target.value)} /></div>
                  <button className="bouton-valider" style={{ width: '100%' }} disabled={chargement}>{chargement ? '…' : '🔒 Réinitialiser'}</button>
                </>
              )}
            {erreur && <p style={{ color: 'var(--rouge)', fontSize: 13, textAlign: 'center', margin: '10px 0 0' }}>{erreur}</p>}
          </form>
        ) : (
          <form onSubmit={valider}>
            {/* Un invité ne crée pas une boutique, il rejoint celle du patron :
                ce champ nomme SON compte, d'où le libellé qui change. */}
            {mode === 'inscription' && (
              <div className="groupe-champ">
                <label>{invitation ? '👤 Votre nom' : '🏪 Nom de la boutique'}</label>
                <input value={nomCommerce} onChange={(e) => definirNomCommerce(e.target.value)}
                  placeholder={invitation ? 'Ex. Awa Ndiaye' : 'Ex. Boutique Ndiaye'} />
              </div>
            )}
            <div className="groupe-champ"><label>✉️ Email / identifiant</label><input value={identifiant} onChange={(e) => definirIdentifiant(e.target.value)} autoCapitalize="none" /></div>
            <div className="groupe-champ"><label>🔒 Mot de passe</label><input type="password" value={motDePasse} onChange={(e) => definirMotDePasse(e.target.value)} /></div>
            {erreur && <p style={{ color: 'var(--rouge)', fontSize: 13, textAlign: 'center', marginBottom: 10 }}>{erreur}</p>}
            <button className="bouton-valider" style={{ width: '100%' }} disabled={chargement}>
              {chargement ? '…' : mode === 'connexion' ? 'Se connecter' : invitation ? '🤝 Rejoindre la boutique' : 'Créer ma boutique'}
            </button>
          </form>
        )}
        {/* Essayer avant de s'inscrire : on remplit les champs sous les yeux de
            l'utilisateur plutôt que de le connecter d'office, pour qu'il voie
            QUEL compte il ouvre — et qu'il puisse revenir en arrière. */}
        {!doubleFacteurEnAttente && mode !== 'oubli' && !invitation && (
          <button type="button" className="bouton-demo" onClick={essayerDemo} disabled={chargement}>
            <span className="bouton-demo-icone" aria-hidden="true">👀</span>
            <span className="bouton-demo-texte">
              <b>Essayer sans compte</b>
              <small>Boutique de démonstration, rien n'est réel</small>
            </span>
          </button>
        )}
        {!doubleFacteurEnAttente && mode === 'connexion' && (
          <button className="lien-connexion" style={{ color: 'var(--attenue)' }} onClick={() => { definirMode('oubli'); definirErreur(''); definirCodeEnvoye(false) }}>
            Mot de passe oublié ?
          </button>
        )}
        {!doubleFacteurEnAttente && mode === 'oubli' && (
          <button className="lien-connexion" onClick={() => { definirMode('connexion'); definirErreur(''); definirCodeEnvoye(false) }}>
            ← Retour à la connexion
          </button>
        )}
        <div className="note-connexion">📴 Fonctionne hors ligne : vos ventes partent au retour du réseau</div>
        </div>
      </div>
    </div>
  )
}
