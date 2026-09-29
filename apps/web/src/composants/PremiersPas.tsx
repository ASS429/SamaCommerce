import { useState } from 'react'
import Logo from './Logo'

const CLE = 'samacommerce_premiers_pas_vus'

const ETAPES = [
  { icone: '', logo: true, titre: 'Bienvenue sur SamaCommerce', texte: 'Gérez votre commerce simplement : ventes, stock, crédits et chiffres, même hors-ligne.' },
  { icone: '💳', titre: 'Vendre en 2 clics', texte: 'Touchez le bouton violet central, choisissez vos produits, encaissez (espèces, Wave, Orange ou crédit).' },
  { icone: '📦', titre: 'Suivre le stock', texte: 'Ajoutez vos produits, ajustez les quantités avec + / − et recevez des alertes de stock faible.' },
  { icone: '📝', titre: 'Gérer les crédits', texte: 'Notez les ventes à crédit de vos clients et marquez-les remboursées en un geste.' },
  { icone: '📈', titre: 'Voir vos chiffres', texte: 'Chiffre d\'affaires du jour, top produits, caisse… exportables en PDF.' },
]

export default function PremiersPas({ surFin }: { surFin: () => void }) {
  const [i, definirI] = useState(0)
  const terminer = () => { localStorage.setItem(CLE, '1'); surFin() }
  const etape = ETAPES[i]
  const derniere = i === ETAPES.length - 1

  return (
    <div className="fenetre-calque" style={{ zIndex: 200 }}>
      <div className="fenetre-boite" style={{ maxWidth: 360, textAlign: 'center' }}>
        {'logo' in etape && etape.logo
          ? <Logo taille={64} style={{ margin: '0 auto 8px', borderRadius: 16 }} />
          : <div style={{ fontSize: 52, marginBottom: 8 }}>{etape.icone}</div>}
        <div className="police-titre" style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{etape.titre}</div>
        <p style={{ fontSize: 14, color: 'var(--attenue)', lineHeight: 1.5, margin: '0 0 18px' }}>{etape.texte}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 18 }}>
          {ETAPES.map((_, k) => (
            <span key={k} style={{ width: k === i ? 22 : 7, height: 7, borderRadius: 4, background: k === i ? 'var(--marque)' : 'var(--trait)', transition: 'all .2s' }} />
          ))}
        </div>
        <div className="fenetre-actions">
          <button className="bouton-annuler" onClick={terminer}>Passer</button>
          <button className="bouton-valider" onClick={() => (derniere ? terminer() : definirI(i + 1))}>{derniere ? '🚀 Commencer' : 'Suivant'}</button>
        </div>
      </div>
    </div>
  )
}
