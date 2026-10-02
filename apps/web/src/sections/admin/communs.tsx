/* Composants partagés du panneau d'administration : en-tête de vue, états
 * (chargement, erreur, vide), pastilles, logos des moyens de paiement. */

import type { ReactNode } from 'react'
import { Banknote, CircleAlert, Gift, RotateCw } from 'lucide-react'
import { decrireErreur } from '../../outils/erreursChargement'
import type { MoyenAbonnement } from '../../outils/api'
import type { Ton } from './outilsAdmin'

// ─── Mise en page ───

export function EnTeteVue({ titre, soustitre, actions }: { titre: string; soustitre?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="adm-entete">
      <div className="adm-entete-texte">
        <h1 className="adm-titre" tabIndex={-1}>{titre}</h1>
        {soustitre && <p className="adm-soustitre">{soustitre}</p>}
      </div>
      {actions && <div className="adm-entete-actions">{actions}</div>}
    </header>
  )
}

export function Squelette({ hauteur, largeur = '100%' }: { hauteur: number; largeur?: number | string }) {
  return <div className="squelette adm-squelette" style={{ height: hauteur, width: largeur }} aria-hidden="true" />
}

/** Chargement d'une vue : la forme de ce qui arrive, pas une roue qui tourne. */
export function ChargementVue({ blocs = [120, 260, 200] }: { blocs?: number[] }) {
  return (
    <div className="adm-contenu" aria-busy="true" aria-label="Chargement">
      <Squelette hauteur={36} largeur={260} />
      {blocs.map((h, i) => <Squelette key={i} hauteur={h} />)}
    </div>
  )
}

export function ErreurVue({ erreur, surReessai, compacte = false }: { erreur: unknown; surReessai: () => void; compacte?: boolean }) {
  const infos = decrireErreur(erreur)
  const conseil = infos?.type === 'hors-ligne' ? 'Reconnectez-vous à Internet, puis réessayez.'
    : infos?.type === 'injoignable' ? 'Le serveur se réveille peut-être. Réessayez dans quelques secondes.'
      : 'Réessayez. Si cela continue, regardez la santé du système sur le tableau de bord.'
  return (
    <div className={`adm-vide adm-vide--erreur${compacte ? ' adm-vide--compact' : ''}`} role="alert">
      <CircleAlert size={compacte ? 20 : 28} aria-hidden="true" />
      <strong>{infos?.titre ?? 'Chargement impossible'}</strong>
      <span>{conseil}</span>
      <button type="button" className="adm-bouton adm-bouton--contour" onClick={surReessai}>
        <RotateCw size={16} aria-hidden="true" />Réessayer
      </button>
    </div>
  )
}

export function Vide({ icone, titre, texte, ton, children }: { icone: ReactNode; titre: string; texte?: string; ton?: 'ok'; children?: ReactNode }) {
  return (
    <div className={`adm-vide${ton ? ' adm-vide--' + ton : ''}`}>
      {icone}
      <strong>{titre}</strong>
      {texte && <span>{texte}</span>}
      {children}
    </div>
  )
}

export function Pastille({ ton, children }: { ton: Ton; children: ReactNode }) {
  return <span className={`adm-pastille adm-pastille--${ton}`}>{children}</span>
}

/** Logo officiel de Wave et d'Orange Money ; pictogramme pour espèces et offert. */
export function LogoMoyen({ moyen, taille = 42 }: { moyen: MoyenAbonnement; taille?: number }) {
  const style = { width: taille, height: taille }
  if (moyen === 'wave') return <span className="adm-moyen" style={style}><img src="/paiement/wave.png" alt="" width={taille} height={taille} /></span>
  if (moyen === 'orange') return <span className="adm-moyen" style={style}><img src="/paiement/orange-money.png" alt="" width={taille} height={taille} /></span>
  if (moyen === 'especes') return <span className="adm-moyen adm-moyen--especes" style={style}><Banknote size={Math.round(taille / 2)} aria-hidden="true" /></span>
  return <span className="adm-moyen adm-moyen--offert" style={style}><Gift size={Math.round(taille / 2)} aria-hidden="true" /></span>
}

export function Interrupteur({ actif, surChangement, libelle, desactive = false }: { actif: boolean; surChangement: (v: boolean) => void; libelle: string; desactive?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={actif} aria-label={libelle} className="adm-interrupteur" disabled={desactive} onClick={() => surChangement(!actif)}>
      <span aria-hidden="true" />
    </button>
  )
}
