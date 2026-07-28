import { useState } from 'react'
import Logo from './Logo'

const KEY = 'samacommerce_onboarded'

const STEPS = [
  { icon: '', logo: true, title: 'Bienvenue sur SamaCommerce', text: 'Gérez votre commerce simplement : ventes, stock, crédits et chiffres, même hors-ligne.' },
  { icon: '💳', title: 'Vendre en 2 clics', text: 'Touchez le bouton violet central, choisissez vos produits, encaissez (espèces, Wave, Orange ou crédit).' },
  { icon: '📦', title: 'Suivre le stock', text: 'Ajoutez vos produits, ajustez les quantités avec + / − et recevez des alertes de stock faible.' },
  { icon: '📝', title: 'Gérer les crédits', text: 'Notez les ventes à crédit de vos clients et marquez-les remboursées en un geste.' },
  { icon: '📈', title: 'Voir vos chiffres', text: 'Chiffre d\'affaires du jour, top produits, caisse… exportables en PDF.' },
]

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const finish = () => { localStorage.setItem(KEY, '1'); onDone() }
  const step = STEPS[i]
  const last = i === STEPS.length - 1

  return (
    <div className="modal-overlay" style={{ zIndex: 200 }}>
      <div className="modal-box" style={{ maxWidth: 360, textAlign: 'center' }}>
        {'logo' in step && step.logo
          ? <Logo size={64} style={{ margin: '0 auto 8px', borderRadius: 16 }} />
          : <div style={{ fontSize: 52, marginBottom: 8 }}>{step.icon}</div>}
        <div className="sora" style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{step.title}</div>
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 18px' }}>{step.text}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 18 }}>
          {STEPS.map((_, k) => (
            <span key={k} style={{ width: k === i ? 22 : 7, height: 7, borderRadius: 4, background: k === i ? 'var(--brand)' : 'var(--line)', transition: 'all .2s' }} />
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={finish}>Passer</button>
          <button className="btn-confirm" onClick={() => (last ? finish() : setI(i + 1))}>{last ? '🚀 Commencer' : 'Suivant'}</button>
        </div>
      </div>
    </div>
  )
}
