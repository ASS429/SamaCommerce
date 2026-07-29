import { useEffect, useState } from 'react'
import { Members as Api, ALL_PERMS, boutiqueIdentity, type Member } from '../lib/api'
import { confirmAsync, toast } from '../lib/toast'
import { SkeletonList } from '../components/Skeleton'
import Avatar from '../components/Avatar'
import PhotoPicker from '../components/PhotoPicker'
import { inviteMessage, openWhatsapp, telLink } from '../lib/whatsapp'

/* Chaque permission porte un pictogramme identique à celui de la section
   correspondante : le patron retrouve visuellement « ce que l'employé a le
   droit d'ouvrir », sans lire la liste. */
const PERM_LABELS: Record<string, string> = {
  vente: '💳 Vente', stock: '📦 Stock', categories: '🏷️ Catégories', rapports: '📈 Chiffres',
  caisse: '💰 Caisse', credits: '📝 Crédits/Retours', clients: '👤 Clients',
  fournisseurs: '🚚 Fournisseurs', commandes: '📋 Commandes', livraisons: '🛵 Livraisons',
}

const ROLE = {
  gerant: { icon: '👔', label: 'Gérant' },
  employe: { icon: '🧑‍💼', label: 'Employé' },
} as const

const STATUS: Record<string, { icon: string; label: string; cls: string }> = {
  accepted: { icon: '✅', label: 'Actif', cls: 'pill-ok' },
  pending: { icon: '⏳', label: 'Invitation envoyée', cls: 'pill-low' },
  rejected: { icon: '⛔', label: 'Refusée', cls: 'pill-critical' },
}

/** Nom affiché : fiche saisie par le patron, sinon compte lié, sinon email. */
const displayName = (m: Member) => m.name || m.user_company_name || m.email.split('@')[0]
const displayPhone = (m: Member) => m.phone || m.user_phone || null

export default function Equipe() {
  const [members, setMembers] = useState<Member[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => Api.list().then(setMembers).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const remove = async (m: Member) => { if (await confirmAsync(`Retirer ${displayName(m)} de l'équipe ?`)) { await Api.remove(m.id); load() } }
  const togglePerm = async (m: Member, key: string) => {
    const perms = { ...m.permissions, [key]: !m.permissions[key] }
    setMembers((list) => list.map((x) => x.id === m.id ? { ...x, permissions: perms } : x))
    try { await Api.update(m.id, { permissions: perms }) } catch { toast('Modification non enregistrée', 'error'); load() }
  }

  return (
    <>
      <div className="page-header"><h2>👥 Mon Équipe</h2><button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>+ Inviter</button></div>

      {loading && <SkeletonList count={2} />}
      {!loading && members.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <div className="empty-text">Aucun membre</div>
          <div className="empty-sub">Invitez un employé : il vend, vous gardez la main sur les prix</div>
        </div>
      )}

      {!loading && members.map((m) => {
        const role = ROLE[m.role as keyof typeof ROLE] || ROLE.employe
        const st = STATUS[m.status] || { icon: '•', label: m.status, cls: 'pill-low' }
        const phone = displayPhone(m)
        const tel = telLink(phone)
        return (
          <div key={m.id} className="card fiche">
            <div className="fiche-head">
              <Avatar photo={m.photo} icon={m.photo ? undefined : role.icon} name={displayName(m)} size={52} />
              <div className="fiche-id">
                <div className="fiche-name">{displayName(m)}</div>
                <div className="fiche-sub">{role.icon} {role.label}</div>
                <div className="fiche-sub">✉️ {m.email}</div>
                {phone && <div className="fiche-sub">📞 {phone}</div>}
              </div>
              <div className="fiche-tools">
                <button className="prd-btn prd-btn-edit" aria-label="Modifier" onClick={() => { setEditing(m); setShowModal(true) }}>✏️</button>
                <button className="prd-btn prd-btn-del" aria-label="Retirer" onClick={() => remove(m)}>🗑️</button>
              </div>
            </div>

            <span className={`produit-stock-pill ${st.cls}`} style={{ display: 'inline-block', marginBottom: 10 }}>{st.icon} {st.label}</span>

            {phone && (
              <div className="fiche-actions">
                {tel && <a className="fa-btn fa-call" href={tel}>📞 Appeler</a>}
                <button className="fa-btn fa-wa" onClick={() => openWhatsapp(phone, `👋 Bonjour ${displayName(m)},\n\n🏪 *${boutiqueIdentity().nom}*`)}>💬 WhatsApp</button>
              </div>
            )}

            <div className="perm-label">🔑 Ce qu'il peut ouvrir</div>
            <div className="perm-grid">
              {ALL_PERMS.map((key) => (
                <button key={key} onClick={() => togglePerm(m, key)}
                  className={`perm-chip ${m.permissions?.[key] ? 'on' : ''}`}
                  aria-pressed={!!m.permissions?.[key]}>
                  <span aria-hidden="true">{m.permissions?.[key] ? '✅' : '🚫'}</span> {PERM_LABELS[key]}
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {showModal && <MemberModal member={editing} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />}
    </>
  )
}

function MemberModal({ member, onClose, onSaved }: { member: Member | null; onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState(member?.email ?? '')
  const [name, setName] = useState(member?.name ?? '')
  const [phone, setPhone] = useState(member?.phone ?? '')
  const [photo, setPhoto] = useState<string | null>(member?.photo ?? null)
  const [role, setRole] = useState(member?.role ?? 'employe')
  const [saving, setSaving] = useState(false)
  const [link, setLink] = useState<string | null>(null)

  const submit = async () => {
    setSaving(true)
    try {
      if (member) {
        await Api.update(member.id, { role, name: name || null, phone: phone || null, photo })
        toast('Fiche mise à jour', 'success')
        onSaved()
        return
      }
      if (!email.trim()) return alert('Email requis')
      const d = await Api.invite({ email: email.trim(), role, name: name || null, phone: phone || null, photo })
      setLink(d.invite_link || d.invite_token)
    } catch (e: any) { alert(e?.response?.data?.message || e?.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  /* L'invitation par email n'atteint pas nos utilisateurs : au Sénégal, on
     partage un lien par WhatsApp. Le message explique la marche à suivre en
     trois étapes numérotées. */
  const sendWhatsapp = () => {
    if (!link) return
    openWhatsapp(phone, inviteMessage(boutiqueIdentity(), { lien: link, role }))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{member ? '✏️ Fiche employé' : '👥 Inviter un membre'}</div>
        {link ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>✅ Invitation créée. Partagez ce lien avec l'employé :</p>
            <div className="wa-preview" style={{ wordBreak: 'break-all' }}>{link}</div>
            <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
              <button className="fa-btn fa-wa" style={{ flex: 1 }} onClick={sendWhatsapp}>💬 Envoyer par WhatsApp</button>
              <button className="fa-btn fa-call" style={{ flex: 1 }} onClick={() => { navigator.clipboard?.writeText(link); toast('Lien copié 📋', 'success') }}>📋 Copier</button>
            </div>
            <button className="btn-confirm" style={{ width: '100%' }} onClick={onSaved}>Terminé</button>
          </>
        ) : (
          <>
            <PhotoPicker value={photo} onChange={setPhoto} name={name || email} icon="🧑‍💼" label="📷 Photo de l'employé (facultatif)" />
            <div className="form-group"><label>Nom / prénom</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Awa Ndiaye" /></div>
            {!member && <div className="form-group"><label>✉️ Email de l'employé</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="employe@exemple.sn" /></div>}
            <div className="form-group"><label>📞 Téléphone (WhatsApp)</label><input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="77 123 45 67" /></div>
            <div className="form-group"><label>👔 Rôle</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="employe">🧑‍💼 Employé (vente uniquement par défaut)</option>
                <option value="gerant">👔 Gérant (toutes permissions)</option>
              </select>
            </div>
            <div className="modal-actions"><button className="btn-cancel" onClick={onClose}>Annuler</button><button className="btn-confirm" onClick={submit} disabled={saving}>{member ? 'Enregistrer' : 'Inviter'}</button></div>
          </>
        )}
      </div>
    </div>
  )
}
