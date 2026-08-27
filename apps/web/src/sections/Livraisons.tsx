import { Fragment, useEffect, useState } from 'react'
import { Livraisons as Api, Commandes, boutiqueIdentity, fcfa } from '../lib/api'
import { confirmAsync, toast } from '../lib/toast'
import { SkeletonList } from '../components/Skeleton'
import Avatar from '../components/Avatar'
import { deliveryMessage, openWhatsapp } from '../lib/whatsapp'
import LoadError from '../components/LoadError'
import { useLoadError } from '../lib/loadError'

/* Une livraison, c'est un trajet : ⏳ pas encore parti → 🛵 en route → ✅ arrivé.
   Trois images qui racontent l'étape, la couleur confirme (orange → vert). */
const STATUS: Record<string, { icon: string; label: string; cls: string }> = {
  en_attente: { icon: '⏳', label: 'En attente', cls: 'pill-low' },
  en_cours: { icon: '🛵', label: 'En route', cls: 'pill-low' },
  livree: { icon: '✅', label: 'Livrée', cls: 'pill-ok' },
}

/** Les trois étapes du trajet, dans l'ordre. `ORDER` donne le rang atteint. */
const STEPS = [
  { key: 'en_attente', icon: '📦', label: 'Préparée' },
  { key: 'en_cours', icon: '🛵', label: 'En route' },
  { key: 'livree', icon: '🏠', label: 'Livrée' },
] as const
const ORDER = STEPS.map((s) => s.key) as readonly string[]

export default function Livraisons() {
  const [list, setList] = useState<any[]>([])
  const [commandes, setCommandes] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const { error, watch, reset } = useLoadError()

  const load = () => {
    reset()
    watch(Api.list().then(setList)).finally(() => setLoading(false))
    Commandes.list().then(setCommandes).catch(() => {}) // alimente le formulaire : secondaire
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* Suivi ET réception étaient dissociés : on pouvait marquer « Livrée » sans
     que le stock bouge. Désormais, si la livraison porte une commande encore
     en attente, on propose de l'ajouter au stock dans la foulée. */
  const advance = async (l: any) => {
    const next = l.status === 'en_attente' ? 'en_cours' : 'livree'
    setList((xs) => xs.map((x) => x.id === l.id ? { ...x, status: next } : x))
    const res = await Api.setStatus(l.id, next)
    if (res?.commande_a_recevoir) {
      if (await confirmAsync('Livraison arrivée ✅\n\nAjouter les articles de la commande à votre stock ?', 'Ajouter au stock')) {
        const done = await Api.setStatus(l.id, 'livree', true)
        toast(done?.message || 'Stock mis à jour', 'success')
      }
    }
    load()
  }
  const remove = async (l: any) => { if (await confirmAsync('Supprimer cette livraison ?')) { await Api.remove(l.id); load() } }

  return (
    <>
      <div className="page-header"><h2>🛵 Livraisons</h2><button className="btn-primary" onClick={() => setShowModal(true)}>+ Suivre</button></div>

      {loading && <SkeletonList count={3} />}
      {!loading && error && <LoadError error={error} onRetry={load} />}
      {!loading && !error && list.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🛵</div>
          <div className="empty-text">Aucune livraison</div>
          <div className="empty-sub">Suivez la livraison d'une commande</div>
        </div>
      )}

      {!loading && list.map((l) => {
        const st = STATUS[l.status] || { icon: '•', label: l.status, cls: 'pill-low' }
        return (
          <div key={l.id} className="card fiche">
            <div className="fiche-head">
              <Avatar icon={st.icon} name={l.fournisseur_name || 'Livraison'} size={48} />
              <div className="fiche-id">
                <div className="fiche-name">{l.fournisseur_name || 'Livraison'}</div>
                {l.commande_total ? <div className="fiche-sub">💰 {fcfa(Number(l.commande_total))}</div> : null}
                {l.tracking_note && <div className="fiche-sub">📍 {l.tracking_note}</div>}
                {l.delivered_at && <div className="fiche-sub">✅ Livrée le {(l.delivered_at || '').slice(0, 10)}</div>}
              </div>
              <span className={`produit-stock-pill ${st.cls}`}>{st.icon} {st.label}</span>
            </div>

            {/* Le trajet est dessiné : préparée → en route → livrée. Une simple
                pastille de statut ne dit pas ce qui vient ensuite ; ici on voit
                d'un coup où en est le fournisseur et ce qu'il reste à faire. */}
            <div className="dsteps" aria-hidden="true">
              {STEPS.map((step, i) => {
                const rang = ORDER.indexOf(l.status)
                const etat = i < rang ? 'done' : i === rang ? 'now' : ''
                return (
                  <Fragment key={step.key}>
                    {i > 0 && <span className={`dstep-bar ${i <= rang ? 'done' : ''}`} />}
                    <span className={`dstep ${etat}`}>
                      <span className="dstep-dot">{i < rang ? '✓' : step.icon}</span>
                      <span className="dstep-l">{step.label}</span>
                    </span>
                  </Fragment>
                )
              })}
            </div>
            <span className="sr-only">Étape : {st.label}</span>

            <div className="fiche-actions">
              {l.status !== 'livree' && (
                <button className="fa-btn fa-ok" onClick={() => advance(l)}>
                  {l.status === 'en_attente' ? '▶️ Démarrer' : '✅ Marquer livrée'}
                </button>
              )}
              {l.fournisseur_phone && (
                <button className="fa-btn fa-wa" onClick={() => openWhatsapp(l.fournisseur_phone, deliveryMessage(boutiqueIdentity(), {
                  reference: l.commande_id, statut: l.status, note: l.tracking_note,
                }))}>💬 Demander où ça en est</button>
              )}
              <button className="fa-btn fa-del" onClick={() => remove(l)}>🗑️</button>
            </div>
          </div>
        )
      })}

      {showModal && <LivraisonModal commandes={commandes} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />}
    </>
  )
}

function LivraisonModal({ commandes, onClose, onSaved }: { commandes: any[]; onClose: () => void; onSaved: () => void }) {
  const [cid, setCid] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try { await Api.create(cid ? Number(cid) : null, note || undefined); onSaved() }
    catch (e: any) { alert(e?.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">🛵 Suivre une livraison</div>
        <div className="form-group"><label>📋 Commande liée</label>
          <select value={cid} onChange={(e) => setCid(e.target.value)}>
            <option value="">Aucune</option>
            {commandes.map((c) => <option key={c.id} value={c.id}>#{c.id} · {c.fournisseur_name || 'Sans fournisseur'} · {fcfa(Number(c.total))}</option>)}
          </select>
        </div>
        <div className="form-group"><label>📍 Note de suivi</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Transporteur, n° de suivi..." /></div>
        <div className="modal-actions"><button className="btn-cancel" onClick={onClose}>Annuler</button><button className="btn-confirm" onClick={save} disabled={saving}>Créer</button></div>
      </div>
    </div>
  )
}
