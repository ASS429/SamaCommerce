import { useEffect, useState } from 'react'
import { modifierProfil, enregistrerUtilisateur, lireUtilisateur, basculerDoubleFacteur, deconnecterPartout, JournalActivite, type Activite, type Utilisateur } from '../outils/api'
import { bulle, demanderSaisie, demanderConfirmation } from '../outils/bulles'
import { activerNotifications, desactiverNotifications, notificationsActives, notificationsPrisesEnCharge } from '../outils/notifications'
import { aUnCode, definirCode, retirerCode } from '../outils/verrouPin'
import { lirePreferenceTheme, definirPreferenceTheme, LIBELLES_THEME, type PreferenceTheme } from '../outils/theme'
import { SECTIONS_MASQUABLES, sectionVisible, afficherSection, toutAfficher, impressionAutoActive, definirImpressionAuto } from '../outils/modules'
import ChoixPhoto from '../composants/ChoixPhoto'
import Avatar from '../composants/Avatar'

const ICONES_ACTIONS: Record<string, string> = {
  vente: '🛒', remboursement: '💰', 'produit.ajout': '➕', 'produit.suppr': '🗑️',
  'caisse.cloture': '🔒', 'equipe.invitation': '✉️', 'equipe.retrait': '👋',
}

export default function Profil({ utilisateur, surDeconnexion, surPassagePremium }: { utilisateur: Utilisateur | null; surDeconnexion: () => void; surPassagePremium: () => void }) {
  const [nomCommerce, definirNomCommerce] = useState(utilisateur?.nom_commerce ?? '')
  const [telephone, definirTelephone] = useState(utilisateur?.telephone ?? '')
  const [envoi, definirEnvoi] = useState(false)
  const [photo, definirPhoto] = useState<string | null>(utilisateur?.photo ?? null)
  const [theme, definirTheme] = useState<PreferenceTheme>(lirePreferenceTheme())
  const [impressionAuto, definirImpressionAutoLocale] = useState(impressionAutoActive())
  // Nouveau rendu local de la grille des sections (la source de vérité est le stockage).
  const [versionSections, definirVersionSections] = useState(0)
  const [activites, definirActivites] = useState<Activite[]>([])
  const [chargementActivites, definirChargementActivites] = useState(true)
  const [doubleFacteur, definirDoubleFacteur] = useState(!!utilisateur?.double_facteur_actif)
  const [notifications, definirNotifications] = useState(notificationsActives())
  const [codeActif, definirCodeActif] = useState(aUnCode())
  const estEmploye = !!utilisateur?.est_employe

  const basculerCode = async () => {
    if (codeActif) {
      if (await demanderConfirmation('Retirer le code de verrouillage ?', 'Retirer')) { retirerCode(); definirCodeActif(false); bulle('Verrouillage désactivé', 'info') }
      return
    }
    const code = await demanderSaisie('Choisissez un code à 4 chiffres', '••••')
    if (!code) return
    if (!/^\d{4}$/.test(code)) { bulle('Le code doit contenir 4 chiffres', 'erreur'); return }
    await definirCode(code); definirCodeActif(true); bulle('Verrouillage activé 🔒', 'succes')
  }

  const deconnecterTousLesAppareils = async () => {
    if (await demanderConfirmation('Déconnecter TOUS les appareils connectés à ce compte ?', 'Déconnecter')) {
      await deconnecterPartout(); surDeconnexion()
    }
  }

  const basculerNotifications = async () => {
    if (notifications) { desactiverNotifications(); definirNotifications(false); bulle('Notifications désactivées', 'info'); return }
    const accordees = await activerNotifications()
    definirNotifications(accordees)
    bulle(accordees ? 'Notifications activées 🔔' : 'Permission refusée par le navigateur', accordees ? 'succes' : 'erreur')
  }

  const basculerDouble = async () => {
    const suivant = !doubleFacteur; definirDoubleFacteur(suivant)
    try { await basculerDoubleFacteur(suivant); const actuel = lireUtilisateur(); if (actuel) enregistrerUtilisateur({ ...actuel, double_facteur_actif: suivant }); bulle(suivant ? '2FA activée 🔐' : '2FA désactivée', 'succes') }
    catch { definirDoubleFacteur(!suivant); bulle('Erreur', 'erreur') }
  }

  useEffect(() => { JournalActivite.lister().then(definirActivites).catch(() => {}).finally(() => definirChargementActivites(false)) }, [])

  const enregistrer = async () => {
    definirEnvoi(true)
    try {
      const u = await modifierProfil({ nom_commerce: nomCommerce, telephone, photo })
      const actuel = lireUtilisateur()
      if (actuel) enregistrerUtilisateur({ ...actuel, nom_commerce: u.nom_commerce, telephone: u.telephone, photo: u.photo })
      bulle('Profil mis à jour ✅', 'succes')
    } catch (e: any) { alert(e?.response?.data?.erreur || 'Erreur') } finally { definirEnvoi(false) }
  }

  const basculerSection = (ecran: (typeof SECTIONS_MASQUABLES)[number]['ecran'], visible: boolean) => {
    afficherSection(ecran, visible)
    definirVersionSections((n) => n + 1)
  }
  const choisirTheme = (p: PreferenceTheme, e: React.MouseEvent) => { definirTheme(p); definirPreferenceTheme(p, { x: e.clientX, y: e.clientY }) }

  return (
    <>
      <div className="page-entete"><h2>👤 Paramètres</h2></div>

      {/* Carte d'identité de la boutique : la photo, le nom, le numéro. C'est
          ce que le commerçant vient vérifier ici en premier, et cela confirme
          au passage sur quel compte il est connecté. */}
      <div className="panneau">
        <div className="panneau-haut">
          <Avatar photo={utilisateur?.photo} icone={utilisateur?.photo ? undefined : '🏪'} nom={utilisateur?.nom_commerce} taille={54} rayon={16} fond="rgba(255,255,255,.2)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="panneau-valeur" style={{ fontSize: 20 }}>{utilisateur?.nom_commerce || 'Ma boutique'}</div>
            <div className="panneau-sous-titre">{utilisateur?.telephone || utilisateur?.identifiant}</div>
          </div>
          <span className="case-code" style={{ minWidth: 0, padding: '0 12px', fontSize: 13 }}>
            {estEmploye ? '🧑‍💼 Employé' : `👑 ${utilisateur?.plan}`}
          </span>
        </div>
      </div>

      <div className="carte">
        <div className="carte-titre">🏪 Ma boutique</div>
        {estEmploye ? (
          <div className="ligne-alerte" style={{ background: 'var(--marque-teinte)', borderColor: 'var(--marque-bordure)', color: 'var(--marque-fonce)', fontWeight: 600 }}>
            Vous êtes employé de « {utilisateur?.nom_commerce} ». Le profil est géré par le propriétaire.
          </div>
        ) : (
          <>
            {/* La photo remplace les initiales dans l'en-tête de l'application :
                le commerçant reconnaît SA boutique du premier coup d'œil. */}
            <ChoixPhoto valeur={photo} surChangement={definirPhoto} nom={nomCommerce} icone="🏪" libelle="📷 Ma photo / logo (facultatif)" />
            <div className="groupe-champ"><label>Nom de la boutique</label><input value={nomCommerce} onChange={(e) => definirNomCommerce(e.target.value)} /></div>
            <div className="groupe-champ"><label>📞 Téléphone</label><input type="tel" inputMode="tel" value={telephone} onChange={(e) => definirTelephone(e.target.value)} /></div>
            <button className="bouton-valider" style={{ width: '100%' }} onClick={enregistrer} disabled={envoi}>💾 Enregistrer</button>
          </>
        )}
      </div>

      {/* ─── Sections activables ───
          17 sections, mais un vendeur de café n'en utilise que deux. Chacun
          compose son application : ce qui est décoché disparaît de la barre du
          bas et de la colonne de gauche. Les droits, eux, ne bougent pas. */}
      <div className="carte">
        <div className="carte-titre">🧩 Mes fonctionnalités</div>
        <div style={{ fontSize: 12.5, color: 'var(--attenue)', marginBottom: 12 }}>
          Touchez pour afficher ou masquer une section. Accueil et Paramètres restent toujours visibles.
        </div>
        <div className="fonctions-grille" key={versionSections}>
          {SECTIONS_MASQUABLES.filter((s) => !estEmploye || s.ecran !== 'boutiques').map((s) => {
            const visible = sectionVisible(s.ecran)
            return (
              <button key={s.ecran} className={`fonction-carte ${visible ? 'allume' : ''}`} onClick={() => basculerSection(s.ecran, !visible)}
                aria-pressed={visible} aria-label={`${s.libelle} — ${visible ? 'affichée' : 'masquée'}`}>
                <span className="fonction-icone">{s.icone}</span>
                <span className="fonction-libelle">{s.libelle}</span>
                <span className="fonction-aide">{s.aide}</span>
                <span className="fonction-etat">{visible ? '✅' : '🚫'}</span>
              </button>
            )
          })}
        </div>
        <button className="pastille-douce" style={{ marginTop: 12 }} onClick={() => { toutAfficher(); definirVersionSections((n) => n + 1) }}>↩️ Tout afficher</button>
      </div>

      <div className="carte">
        <div className="carte-titre">⚙️ Préférences</div>
        {/* Trois pastilles imagées plutôt qu'un interrupteur « activé/désactivé » :
            le choix se comprend sans lire. « Auto » = comme le téléphone. */}
        <div style={{ padding: '6px 0 10px' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>🌓 Apparence</div>
          <div className="theme-choix">
            {(['auto', 'clair', 'sombre'] as PreferenceTheme[]).map((p) => (
              <button key={p} className={`theme-option ${theme === p ? 'choisi' : ''}`} onClick={(e) => choisirTheme(p, e)}
                aria-pressed={theme === p} aria-label={`Apparence ${LIBELLES_THEME[p].libelle}`}>
                <span className="theme-option-icone">{LIBELLES_THEME[p].icone}</span>
                <span className="theme-option-libelle">{LIBELLES_THEME[p].libelle}</span>
              </button>
            ))}
          </div>
          {theme === 'auto' && <div style={{ fontSize: 12, color: 'var(--attenue)', marginTop: 6 }}>L'application suit le mode clair/sombre de votre téléphone.</div>}
        </div>
        {/* Un interrupteur au lieu d'une étiquette « Activées / Désactivées » :
            l'état se voit à la position et à la couleur, sans lire. Toute la
            ligne est cliquable — au comptoir, on tape au pouce. */}
        <div className="reglages-liste">
          {notificationsPrisesEnCharge() && (
            <button className="reglage-ligne" role="switch" aria-checked={notifications} onClick={basculerNotifications}>
              <span className="reglage-icone" aria-hidden="true">🔔</span>
              <span className="reglage-corps">
                <span className="reglage-titre">Notifications de stock</span>
                <span className="reglage-description">Prévenir quand un produit s'épuise</span>
              </span>
              <span className={`interrupteur ${notifications ? 'allume' : ''}`} aria-hidden="true" />
            </button>
          )}
          {!estEmploye && (
            <button className="reglage-ligne" role="switch" aria-checked={doubleFacteur} onClick={basculerDouble}>
              <span className="reglage-icone" aria-hidden="true">🔐</span>
              <span className="reglage-corps">
                <span className="reglage-titre">Double authentification</span>
                <span className="reglage-description">Un code en plus du mot de passe</span>
              </span>
              <span className={`interrupteur ${doubleFacteur ? 'allume' : ''}`} aria-hidden="true" />
            </button>
          )}
          {/* Peu de boutiques ont une imprimante ticket : l'option est donc
              désactivée par défaut, et se règle ici une fois pour toutes. */}
          <button className="reglage-ligne" role="switch" aria-checked={impressionAuto}
            onClick={() => { const suivant = !impressionAuto; definirImpressionAutoLocale(suivant); definirImpressionAuto(suivant) }}>
            <span className="reglage-icone" aria-hidden="true">🖨️</span>
            <span className="reglage-corps">
              <span className="reglage-titre">Imprimer le reçu tout seul</span>
              <span className="reglage-description">À l'encaissement, sans un geste de plus</span>
            </span>
            <span className={`interrupteur ${impressionAuto ? 'allume' : ''}`} aria-hidden="true" />
          </button>
          <button className="reglage-ligne" role="switch" aria-checked={codeActif} onClick={basculerCode}>
            <span className="reglage-icone" aria-hidden="true">🔒</span>
            <span className="reglage-corps">
              <span className="reglage-titre">Verrouillage par code</span>
              <span className="reglage-description">Quatre chiffres pour rouvrir la caisse</span>
            </span>
            <span className={`interrupteur ${codeActif ? 'allume' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {utilisateur?.plan === 'Gratuit' && !estEmploye && (
        <button className="premium-carte" style={{ marginBottom: 12 }} onClick={surPassagePremium}>
          <span className="bandeau-icone" aria-hidden="true">👑</span>
          <span style={{ minWidth: 0 }}>
            <span className="premium-titre" style={{ display: 'block' }}>SamaCommerce Premium</span>
            <span className="premium-sous-titre" style={{ display: 'block' }}>IA, multi-boutique, export illimité</span>
          </span>
          <span className="premium-aller">Activer</span>
        </button>
      )}

      <div className="carte">
        <div className="carte-titre">🛡️ Sécurité du compte</div>
        <div className="reglages-liste">
          <button className="reglage-ligne" onClick={deconnecterTousLesAppareils}>
            <span className="reglage-icone" aria-hidden="true" style={{ background: 'var(--attention-fond)' }}>📵</span>
            <span className="reglage-corps">
              <span className="reglage-titre">Déconnecter tous les appareils</span>
              <span className="reglage-description">Utile si vous avez perdu un téléphone</span>
            </span>
            <span className="reglage-aller" aria-hidden="true">›</span>
          </button>
          {utilisateur?.plan !== 'Gratuit' && (
            <div className="reglage-ligne" style={{ cursor: 'default' }}>
              <span className="reglage-icone" aria-hidden="true">💳</span>
              <span className="reglage-corps"><span className="reglage-titre">Abonnement</span></span>
              <span className="reglage-valeur">👑 {utilisateur?.plan}</span>
            </div>
          )}
        </div>
      </div>

      <div className="carte">
        <div className="carte-titre">🕓 Activité récente</div>
        {chargementActivites
          ? [0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
              <div className="squelette" style={{ width: 22, height: 22, borderRadius: '50%' }} />
              <div style={{ flex: 1 }}>
                <div className="squelette" style={{ height: 12, width: '60%' }} />
                <div className="squelette" style={{ height: 10, width: '35%', marginTop: 5 }} />
              </div>
            </div>
          ))
          : activites.length === 0
          ? <div style={{ fontSize: 13, color: 'var(--attenue)', padding: '4px 0' }}>Aucune activité pour le moment</div>
          : activites.slice(0, 12).map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--trait-doux)' }}>
              <span style={{ fontSize: 18 }}>{ICONES_ACTIONS[a.action] || '•'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.detail || a.action}</div>
                <div style={{ fontSize: 11.5, color: 'var(--attenue)' }}>{a.nom_acteur} · {(a.cree_le || '').slice(0, 16).replace('T', ' ')}</div>
              </div>
            </div>
          ))}
      </div>

      <div className="carte">
        <div style={{ fontSize: 13, color: 'var(--attenue)', marginBottom: 10 }}>Connecté : {utilisateur?.identifiant}</div>
        <button className="bouton-paiement" style={{ background: 'var(--danger-fond)', color: 'var(--danger)', boxShadow: 'none' }} onClick={surDeconnexion}>🔓 Se déconnecter</button>
      </div>
    </>
  )
}
