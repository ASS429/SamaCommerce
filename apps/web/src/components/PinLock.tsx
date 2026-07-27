import { useEffect, useRef, useState } from 'react'
import { hasPin, verifyPin, getLockDelayMin } from '../lib/pinLock'
import { toast } from '../lib/toast'

/**
 * S11 — Gère le verrouillage par PIN : détecte l'inactivité, affiche l'écran de
 * déverrouillage. À monter une seule fois quand l'utilisateur est connecté.
 */
export default function PinLock() {
  const [locked, setLocked] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!hasPin()) return

    const arm = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setLocked(true), getLockDelayMin() * 60_000)
    }
    const onActivity = () => { if (!locked) arm() }
    const onHidden = () => { if (document.visibilityState === 'hidden' && hasPin()) setLocked(true) }

    const events = ['pointerdown', 'keydown', 'touchstart', 'mousemove'] as const
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    document.addEventListener('visibilitychange', onHidden)
    arm()

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', onHidden)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [locked])

  if (!locked) return null
  return <UnlockScreen onUnlock={() => setLocked(false)} />
}

function UnlockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [digits, setDigits] = useState('')

  const submit = async (code: string) => {
    if (await verifyPin(code)) {
      onUnlock()
    } else {
      toast('Code incorrect', 'error')
      setDigits('')
    }
  }

  const press = (d: string) => {
    const next = (digits + d).slice(0, 4)
    setDigits(next)
    if (next.length === 4) setTimeout(() => submit(next), 120)
  }

  return (
    <div className="pin-overlay" role="dialog" aria-modal="true" aria-label="Boutique verrouillée">
      <div className="pin-card">
        <div className="pin-lock-icon" aria-hidden="true">🔒</div>
        <div className="pin-title sora">Boutique verrouillée</div>
        <div className="pin-sub">Entrez votre code pour continuer</div>
        <div className="pin-dots">
          {[0, 1, 2, 3].map((i) => <span key={i} className={`pin-dot ${i < digits.length ? 'on' : ''}`} />)}
        </div>
        <div className="pin-pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
            <button key={n} className="pin-key" onClick={() => press(n)}>{n}</button>
          ))}
          <span />
          <button className="pin-key" onClick={() => press('0')}>0</button>
          <button className="pin-key pin-del" aria-label="Effacer" onClick={() => setDigits(digits.slice(0, -1))}>⌫</button>
        </div>
      </div>
    </div>
  )
}
