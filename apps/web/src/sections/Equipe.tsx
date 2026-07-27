import { useEffect, useState } from 'react'
import { Members as Api, ALL_PERMS, type Member } from '../lib/api'
import { confirmAsync } from '../lib/toast'

const PERM_LABELS: Record<string, string> = {
  vente: '💳 Vente', stock: '📦 Stock', categories: '🏷️ Catégories', rapports: '📈 Chiffres',
  caisse: '💰 Caisse', credits: '📝 Crédits/Retours', clients: '👤 Clients',
  fournisseurs: '🚚 Fournisseurs', commandes: '📋 Commandes', livraisons: '🚚 Livraisons',
}

export default function Equipe() {
  const [members, setMembers] = useState<Member[]>([])
  const [showModal, setShowModal] = useState(false)

  const load = () => Api.list().then(setMembers)
  useEffect(() => { load() }, [])

  const remove = async (m: Member) => { if (await confirmAsync(`Retirer ${m.email} ?`)) { await Api.remove(m.id); load() } }
  const togglePerm = async (m: Member, key: string) => {
    const perms = { ...m.permissions, [key]: !m.permissions[key] }
    await Api.update(m.id, { permissions: perms }); load()
  }

  return (
    <>
      <div className="page-header"><h2>👥 Mon Équipe</h2><button className="btn-primary" onClick={() => setShowModal(true)}>+ Inviter</button></div>

      {members.length === 0 && <div className="empty-state"><div className="empty-icon">👥</div><div className="empty-text">Aucun membre</div><div className="empty-sub">Invitez un employé par email</div></div>}

      {members.map((m) => (
        <div key={m.id} className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="produit-name">{m.email}</div>
              <div className="produit-desc">{m.role === 'gerant' ? '👔 Gérant' : '🧑‍💼 Employé'} ·{' '}
                <span style={{ color: m.status === 'accepted' ? 'var(--green)' : 'var(--orange)' }}>
                  {m.status === 'accepted' ? 'Actif' : m.status === 'pending' ? 'Invitation en attente' : m.status}
                </span>
              </div>
            </div>
            <button className="prd-btn prd-btn-del" onClick={() => remove(m)}>🗑️</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {ALL_PERMS.map((key) => (
              <button key={key} onClick={() => togglePerm(m, key)}
                className="cat-badge"
                style={{ cursor: 'pointer', background: m.permissions[key] ? '#ECFDF5' : '#F3F4F6', color: m.permissions[key] ? 'var(--green)' : 'var(--muted)' }}>
                {m.permissions[key] ? '✓' : '✗'} {PERM_LABELS[key]}
              </button>
            ))}
          </div>
        </div>
      ))}

      {showModal && <InviteModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />}
    </>
  )
}

function InviteModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('employe')
  const [saving, setSaving] = useState(false)
  const [link, setLink] = useState<string | null>(null)

  const invite = async () => {
    if (!email.trim()) return alert('Email requis')
    setSaving(true)
    try {
      const d = await Api.invite(email.trim(), role)
      setLink(d.invite_link || d.invite_token)
    } catch (e: any) { alert(e?.response?.data?.message || e?.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">👥 Inviter un membre</div>
        {link ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Invitation créée ! Partagez ce lien/token avec l'employé :</p>
            <div style={{ background: 'var(--bg)', padding: 10, borderRadius: 10, fontSize: 12, wordBreak: 'break-all', marginBottom: 12 }}>{link}</div>
            <button className="btn-confirm" style={{ width: '100%' }} onClick={onSaved}>Terminé</button>
          </>
        ) : (
          <>
            <div className="form-group"><label>Email de l'employé</label><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="employe@exemple.sn" /></div>
            <div className="form-group"><label>Rôle</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="employe">Employé (vente uniquement par défaut)</option>
                <option value="gerant">Gérant (toutes permissions)</option>
              </select>
            </div>
            <div className="modal-actions"><button className="btn-cancel" onClick={onClose}>Annuler</button><button className="btn-confirm" onClick={invite} disabled={saving}>Inviter</button></div>
          </>
        )}
      </div>
    </div>
  )
}
