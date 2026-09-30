import { useEffect, useState } from 'react'
import { Statistiques, Membres, Caisse, fcfa, type AlerteStock, type Utilisateur } from '../outils/api'
import { traduire, lireLangue, choisirLangue, LANGUES, type Langue } from '../outils/traductions'
import { changerTheme, lirePreferenceTheme, LIBELLES_THEME, type PreferenceTheme } from '../outils/theme'
import { bulle } from '../outils/bulles'
import { extraireJetonInvitation } from '../outils/invitation'

export type Ecran = 'accueil' | 'toutes-boutiques' | 'vente' | 'stock' | 'categories' | 'rapports' | 'inventaire' | 'credits'
  | 'clients' | 'fournisseurs' | 'caisse' | 'commandes' | 'retours' | 'livraisons' | 'boutiques' | 'equipe' | 'profil' | 'ia'

/* Tuiles d'accueil : une couleur PLEINE par destination.
   Avant, six cartes blanches se distinguaient par un mot ; il fallait lire
   pour choisir. Ici la couleur, le pictogramme et la place dans la grille
   suffisent — le vert en haut à gauche, c'est vendre, toujours. */
const TUILES: { ecran: Ecran; emoji: string; cle: string; sousTitre: string; teinte: string }[] = [
  { ecran: 'vente', emoji: '🛒', cle: 'nav.vente', sousTitre: 'Encaisser vite', teinte: 'tuile-vert' },
  { ecran: 'stock', emoji: '📦', cle: 'nav.stock', sousTitre: 'Produits & quantités', teinte: 'tuile-bleu' },
  { ecran: 'credits', emoji: '🤝', cle: 'nav.credits', sousTitre: 'Dettes clients', teinte: 'tuile-violet' },
  { ecran: 'rapports', emoji: '📊', cle: 'nav.rapports', sousTitre: 'Ventes & marges', teinte: 'tuile-orange' },
  { ecran: 'categories', emoji: '🗂️', cle: 'nav.categories', sousTitre: 'Mes rayons', teinte: 'tuile-sarcelle' },
  { ecran: 'clients', emoji: '👤', cle: 'nav.clients', sousTitre: 'Mon carnet', teinte: 'tuile-rose' },
]

/** Événement `beforeinstallprompt` (non typé par TypeScript). */
type InvitationInstallation = Event & { prompt: () => void; userChoice: Promise<unknown> }

export default function Accueil({ utilisateur, peutVoir, alertesAutorisees = true, surNavigation, surDeconnexion, surPassagePremium, bureau, chiffres }: {
  utilisateur: Utilisateur | null
  peutVoir: (e: Ecran) => boolean
  /** Droit de lire les alertes de stock (l'API les réserve au droit « rapports »). */
  alertesAutorisees?: boolean
  surNavigation: (e: Ecran) => void
  surDeconnexion: () => void
  surPassagePremium: () => void
  bureau?: boolean
  chiffres?: { ca: number; articles: number; stock: number }
}) {
  const [alertes, definirAlertes] = useState<AlerteStock[]>([])
  const [guide, definirGuide] = useState(true)
  const [theme, definirTheme] = useState<PreferenceTheme>(lirePreferenceTheme())
  const [invitationInstallation, definirInvitationInstallation] = useState<InvitationInstallation | null>(null)
  const [rejoindreOuvert, definirRejoindreOuvert] = useState(false)
  const [semaine, definirSemaine] = useState<{ date: string; total_encaisse: number }[]>([])

  useEffect(() => {
    if (alertesAutorisees) Statistiques.stockFaible(5).then(definirAlertes).catch(() => definirAlertes([]))
  }, [alertesAutorisees])
  useEffect(() => { if (bureau) Caisse.semaine().then(definirSemaine).catch(() => {}) }, [bureau])

  useEffect(() => {
    const surInvitation = (e: Event) => { e.preventDefault(); definirInvitationInstallation(e as InvitationInstallation) }
    window.addEventListener('beforeinstallprompt', surInvitation)
    return () => window.removeEventListener('beforeinstallprompt', surInvitation)
  }, [])

  const installer = async () => {
    if (!invitationInstallation) return
    invitationInstallation.prompt()
    await invitationInstallation.userChoice
    definirInvitationInstallation(null)
  }

  const changerLangue = () => {
    const ordre: Langue[] = ['fr', 'wo', 'en']
    const suivante = ordre[(ordre.indexOf(lireLangue()) + 1) % ordre.length]
    choisirLangue(suivante)
    window.location.reload()
  }

  // Auto → Clair → Sombre. « Auto » suit le réglage du téléphone.
  const themeSuivant = (e: React.MouseEvent) => definirTheme(changerTheme({ x: e.clientX, y: e.clientY }))

  return (
    <>
      {bureau && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
            <div>
              <div className="police-titre" style={{ fontSize: 23, fontWeight: 800 }}>Bonjour {utilisateur?.nom_commerce || ''} 👋</div>
              <div style={{ fontSize: 13.5, color: 'var(--attenue)' }}>Voici l'activité de ta boutique aujourd'hui</div>
            </div>
            <button className="bouton-encaisser" style={{ width: 'auto', padding: '13px 22px' }} onClick={() => surNavigation('vente')}>＋ Nouvelle vente</button>
          </div>
          <div className="grille-stats" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            <div className="stat stat-violet"><div className="stat-valeur">{fcfa(chiffres?.ca || 0)}</div><div className="stat-libelle">Encaissé aujourd'hui</div></div>
            <div className="stat stat-bleu"><div className="stat-valeur">{chiffres?.articles || 0}</div><div className="stat-libelle">Articles vendus</div></div>
            <div className="stat stat-jaune"><div className="stat-valeur">{chiffres?.stock || 0}</div><div className="stat-libelle">Articles en stock</div></div>
            <div className="stat stat-vert"><div className="stat-valeur">👑 {utilisateur?.plan}</div><div className="stat-libelle">Abonnement</div></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 4 }}>
            <div className="carte">
              <div className="carte-titre">📅 Encaissements — 7 derniers jours</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150, padding: '8px 0' }}>
                {semaine.length === 0
                  ? <div style={{ color: 'var(--attenue)', fontSize: 13, margin: 'auto' }}>Pas encore de données</div>
                  : semaine.map((j, i) => {
                    const max = Math.max(1, ...semaine.map((x) => Number(x.total_encaisse)))
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }} title={fcfa(Number(j.total_encaisse))}>
                        <div style={{ width: '100%', background: 'linear-gradient(180deg, var(--marque-clair), var(--marque))', borderRadius: 7, height: `${(Number(j.total_encaisse) / max) * 115}px`, minHeight: 3, transition: 'height .3s' }} />
                        <span style={{ fontSize: 10, color: 'var(--attenue)' }}>{(j.date || '').slice(8, 10)}/{(j.date || '').slice(5, 7)}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
            <div className="carte" style={{ background: 'var(--attention-fond)', borderColor: 'var(--attention-bordure)' }}>
              <div className="carte-titre" style={{ color: '#9a4a06' }}>⚠️ Alertes de stock</div>
              {alertes.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--attenue)' }}>Aucune alerte 🎉</div>
                : alertes.slice(0, 5).map((a, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderTop: i ? '1px solid var(--attention-bordure)' : 'none', fontSize: 13 }}>
                    <span style={{ color: '#9a4a06' }}>{a.produit}</span>
                    <button className="bouton-compact bouton-compact-modifier" style={{ padding: '5px 10px' }} onClick={() => surNavigation('commandes')}>Commander · {a.stock}</button>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {guide && (
        // Parcours en 3 étapes montré par l'IMAGE : une liste de phrases est
        // illisible pour un commerçant peu alphabétisé, et elle repoussait le
        // bouton « Vendre » hors de l'écran. Ici, 3 pictogrammes et 1 mot.
        <div className="guide">
          <div className="guide-etapes">
            <button className="guide-etape" onClick={() => surNavigation('stock')}>
              <span className="guide-etape-icone" style={{ background: '#DBEAFE' }}>📦</span>
              <span>Remplir</span>
            </button>
            <span className="guide-fleche" aria-hidden="true">→</span>
            <button className="guide-etape" onClick={() => surNavigation('vente')}>
              <span className="guide-etape-icone" style={{ background: '#DCFCE7' }}>🛒</span>
              <span>Vendre</span>
            </button>
            <span className="guide-fleche" aria-hidden="true">→</span>
            <button className="guide-etape" onClick={() => surNavigation('rapports')}>
              <span className="guide-etape-icone" style={{ background: '#FEF3C7' }}>💰</span>
              <span>Gagner</span>
            </button>
          </div>
          <button className="guide-fermer" onClick={() => definirGuide(false)} aria-label="Masquer le guide">✕</button>
        </div>
      )}

      {alertes.length > 0 && (
        <div className="alerte-stock">
          <div className="titre-alerte">
            ⚠️ Stock presque épuisé
            <span className="compteur-jaune" style={{ marginLeft: 'auto', background: 'rgba(154,74,6,.12)', borderRadius: 999, padding: '2px 9px', fontSize: 12 }}>{alertes.length}</span>
          </div>
          {alertes.map((a, i) => (
            <div className="ligne-alerte" key={i}><span>{a.produit}</span><strong>{a.stock} restant(s)</strong></div>
          ))}
        </div>
      )}

      {utilisateur?.est_employe && (
        <div className="ligne-alerte" style={{ background: 'var(--marque-teinte)', borderColor: 'var(--marque-bordure)', color: 'var(--marque-fonce)', marginBottom: 12, fontWeight: 600 }}>
          🧑‍💼 Vous êtes connecté en tant qu'employé{utilisateur?.nom_commerce ? ` · ${utilisateur.nom_commerce}` : ''}
        </div>
      )}

      <div className="section-libelle">{traduire('accueil.actionsRapides')}</div>
      <div className="tuiles">
        {TUILES.filter((t) => peutVoir(t.ecran)).map((t) => (
          <button key={t.ecran} className={`tuile ${t.teinte}`} onClick={() => surNavigation(t.ecran)}>
            <span className="tuile-icone" aria-hidden="true">{t.emoji}</span>
            <span className="tuile-titre">{traduire(t.cle)}</span>
            <span className="tuile-sous-titre">{t.ecran === 'stock' && chiffres?.stock ? `${chiffres.stock} en stock` : t.sousTitre}</span>
          </button>
        ))}
      </div>

      {utilisateur?.plan === 'Gratuit' && !utilisateur?.est_employe && (
        <button className="premium-carte" style={{ marginTop: 14 }} onClick={surPassagePremium}>
          <span className="tuile-icone" aria-hidden="true">👑</span>
          <span>
            <span className="premium-titre" style={{ display: 'block' }}>SamaCommerce Premium</span>
            <span className="premium-sous-titre" style={{ display: 'block' }}>IA, multi-boutique, export illimité</span>
          </span>
          <span className="premium-aller">Activer</span>
        </button>
      )}

      {/* Réglages d'appareil : utiles, mais ce ne sont pas des actions de vente.
          Ils passent donc en bas, en discret, sous les six destinations. */}
      <div className="actions-haut" style={{ marginTop: 18, marginBottom: 0 }}>
        <button className="pastille-douce" onClick={themeSuivant}
          title="Thème : automatique (comme le téléphone), clair ou sombre">{LIBELLES_THEME[theme].icone} {LIBELLES_THEME[theme].libelle}</button>
        <button className="pastille-douce" style={{ background: 'var(--bleu-teinte)', color: 'var(--bleu)' }} onClick={changerLangue}>{LANGUES.find((l) => l.code === lireLangue())?.libelle}</button>
        {invitationInstallation && <button className="pastille-douce" style={{ background: 'var(--succes-fond)', color: 'var(--vert-profond)' }} onClick={installer}>📲 Installer</button>}
        {!utilisateur?.est_employe && (
          <button className="pastille-douce" style={{ background: 'var(--bleu-teinte)', color: 'var(--bleu)' }} onClick={() => definirRejoindreOuvert(true)}>
            🤝 Rejoindre une boutique
          </button>
        )}
        <button className="bouton-deconnexion" onClick={surDeconnexion}>🔓 Déconnexion</button>
      </div>
      {rejoindreOuvert && <FenetreRejoindre surFermeture={() => definirRejoindreOuvert(false)} />}
    </>
  )
}

function FenetreRejoindre({ surFermeture }: { surFermeture: () => void }) {
  const [jeton, definirJeton] = useState('')
  const [envoi, definirEnvoi] = useState(false)
  const rejoindre = async () => {
    if (!jeton.trim()) return bulle('Collez le code d\'invitation', 'erreur')
    definirEnvoi(true)
    try {
      const d = await Membres.accepter(extraireJetonInvitation(jeton))
      bulle(`${d.message} — rôle : ${d.role}`, 'succes')
      setTimeout(() => window.location.reload(), 900)
    } catch (e: any) {
      bulle(e?.response?.data?.erreur || 'Code invalide ou expiré', 'erreur')
    } finally { definirEnvoi(false) }
  }
  return (
    <div className="fenetre-calque" onClick={surFermeture}>
      <div className="fenetre-boite" onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <span className="bandeau-icone" style={{ display: 'inline-flex', background: 'var(--marque-teinte)', color: 'var(--marque-fonce)' }} aria-hidden="true">🔑</span>
        </div>
        <div className="fenetre-titre" style={{ marginBottom: 6 }}>Rejoindre une boutique</div>
        <p style={{ fontSize: 13, color: 'var(--attenue)', textAlign: 'center', margin: '0 0 14px' }}>
          Collez le code que le propriétaire vous a partagé.
        </p>
        {/* Champ volontairement grand : le code arrive par WhatsApp, on le colle
            au pouce et on doit pouvoir vérifier ce qu'on a collé. */}
        <input className="champ-code" value={jeton} onChange={(e) => definirJeton(e.target.value)}
          placeholder="7K2P…" aria-label="Code d'invitation" autoFocus
          style={{ width: '100%', height: 62, fontSize: 20, letterSpacing: 1, padding: '0 12px' }} />
        <div className="fenetre-actions"><button className="bouton-annuler" onClick={surFermeture}>Annuler</button><button className="bouton-valider" onClick={rejoindre} disabled={envoi}>{envoi ? '…' : 'Rejoindre'}</button></div>
      </div>
    </div>
  )
}
