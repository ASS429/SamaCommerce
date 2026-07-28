import { useState } from 'react'
import { api } from '../lib/api'
import { PAY_METHODS } from '../lib/payments'

export default function Premium({ onClose, onUpgraded }: { onClose: () => void; onUpgraded: () => void }) {
  const [phone, setPhone] = useState('')
  const [method, setMethod] = useState('')
  const [saving, setSaving] = useState(false)

  // Expiration = +1 mois
  const expiration = new Date()
  expiration.setMonth(expiration.getMonth() + 1)
  const expStr = expiration.toISOString().slice(0, 10)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone || !method) return alert('Renseignez le téléphone et le moyen de paiement')
    setSaving(true)
    try {
      await api.put('/auth/upgrade', { phone, payment_method: method, amount: 5000, expiration: expStr })
      alert('Demande envoyée ! Un administrateur validera votre passage en Premium.')
      onUpgraded()
      onClose()
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erreur')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full text-center">
        <h2 className="text-xl font-bold mb-2">🚀 Passer en Premium</h2>
        <p className="text-gray-600 mb-4 text-sm">
          Le plan <b>Free</b> est limité à <b>5 produits</b>. Passez en <b>Premium</b> pour un nombre illimité.
        </p>
        <form onSubmit={submit} className="space-y-3 text-left">
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="Numéro de téléphone (WhatsApp de préférence)" className="w-full border rounded-lg px-3 py-2" />
          {/* Choix illustré plutôt qu'une liste déroulante : les logos des
              opérateurs sont reconnus d'un coup d'œil. */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Moyen de paiement</label>
            <div className="pay-list">
              {PAY_METHODS.map((m) => (
                <button key={m.id} type="button"
                  className={`pay-opt${m.tone ? ' pay-opt-' + m.tone : ''}${method === m.id ? ' pay-opt-selected' : ''}`}
                  aria-pressed={method === m.id}
                  onClick={() => setMethod(m.id)}>
                  {m.logo
                    ? <img className="pay-logo" src={m.logo} alt="" width={40} height={40} loading="lazy" />
                    : <span className="pay-logo pay-logo-emoji">{m.emoji}</span>}
                  <span className="pay-opt-text"><b>{m.label}</b><small>{m.sub}</small></span>
                  <span className="pay-opt-go">{method === m.id ? '✓' : '›'}</span>
                </button>
              ))}
            </div>
          </div>
          <input value="5000 F CFA" readOnly className="w-full border rounded-lg px-3 py-2 bg-gray-100" />
          <input value={`Expire le ${expStr}`} readOnly className="w-full border rounded-lg px-3 py-2 bg-gray-100" />
          <button disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold w-full disabled:opacity-60">Envoyer</button>
        </form>
        <div className="mt-4 text-xs text-gray-600">
          📞 Pour valider : <b>+221 78 157 10 09</b> ou <b>+221 77 348 57 91</b>
        </div>
        <button onClick={onClose} className="mt-3 text-gray-500 text-sm">Annuler</button>
      </div>
    </div>
  )
}
