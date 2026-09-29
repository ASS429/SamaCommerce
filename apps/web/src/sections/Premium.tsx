import { useState } from 'react'
import { api } from '../outils/api'
import { MOYENS_PAIEMENT } from '../outils/paiements'

export default function Premium({ surFermeture, surDemandeEnvoyee }: { surFermeture: () => void; surDemandeEnvoyee: () => void }) {
  const [telephone, definirTelephone] = useState('')
  const [moyen, definirMoyen] = useState('')
  const [envoi, definirEnvoi] = useState(false)

  // Expiration = +1 mois
  const expiration = new Date()
  expiration.setMonth(expiration.getMonth() + 1)
  const dateExpiration = expiration.toISOString().slice(0, 10)

  const valider = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!telephone || !moyen) return alert('Renseignez le téléphone et le moyen de paiement')
    definirEnvoi(true)
    try {
      await api.put('/auth/passage-premium', { telephone, moyen_paiement: moyen, montant: 5000, expiration: dateExpiration })
      alert('Demande envoyée ! Un administrateur validera votre passage en Premium.')
      surDemandeEnvoyee()
      surFermeture()
    } catch (err: any) {
      alert(err?.response?.data?.erreur || 'Erreur')
    } finally { definirEnvoi(false) }
  }

  // Les classes de mise en forme de cette fenêtre sont celles de Tailwind
  // (bibliothèque tierce) : elles gardent leur nom anglais.
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full text-center">
        <h2 className="text-xl font-bold mb-2">🚀 Passer en Premium</h2>
        <p className="text-gray-600 mb-4 text-sm">
          Le plan <b>Gratuit</b> est limité à <b>5 produits</b>. Passez en <b>Premium</b> pour un nombre illimité.
        </p>
        <form onSubmit={valider} className="space-y-3 text-left">
          <input type="tel" value={telephone} onChange={(e) => definirTelephone(e.target.value)}
            placeholder="Numéro de téléphone (WhatsApp de préférence)" className="w-full border rounded-lg px-3 py-2" />
          {/* Choix illustré plutôt qu'une liste déroulante : les logos des
              opérateurs sont reconnus d'un coup d'œil. */}
          <div className="groupe-champ" style={{ marginBottom: 0 }}>
            <label>Moyen de paiement</label>
            <div className="paiement-liste">
              {MOYENS_PAIEMENT.map((m) => (
                <button key={m.id} type="button"
                  className={`paiement-option${m.teinte ? ' paiement-option-' + m.teinte : ''}${moyen === m.id ? ' paiement-option-choisie' : ''}`}
                  aria-pressed={moyen === m.id}
                  onClick={() => definirMoyen(m.id)}>
                  {m.logo
                    ? <img className="paiement-logo" src={m.logo} alt="" width={40} height={40} loading="lazy" />
                    : <span className="paiement-logo paiement-logo-emoji">{m.emoji}</span>}
                  <span className="paiement-option-texte"><b>{m.libelle}</b><small>{m.sousTitre}</small></span>
                  <span className="paiement-option-aller">{moyen === m.id ? '✓' : '›'}</span>
                </button>
              ))}
            </div>
          </div>
          <input value="5000 F CFA" readOnly className="w-full border rounded-lg px-3 py-2 bg-gray-100" />
          <input value={`Expire le ${dateExpiration}`} readOnly className="w-full border rounded-lg px-3 py-2 bg-gray-100" />
          <button disabled={envoi} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold w-full disabled:opacity-60">Envoyer</button>
        </form>
        <div className="mt-4 text-xs text-gray-600">
          📞 Pour valider : <b>+221 78 157 10 09</b> ou <b>+221 77 348 57 91</b>
        </div>
        <button onClick={surFermeture} className="mt-3 text-gray-500 text-sm">Annuler</button>
      </div>
    </div>
  )
}
