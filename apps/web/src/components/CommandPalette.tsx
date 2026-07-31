import { useEffect, useMemo, useRef, useState } from 'react'

/* Design 3.6 — Command palette desktop (Ctrl/Cmd+K) : recherche/actions
 * universelle avec animation de spotlight. Navigation clavier complète. */

export type Command = { id: string; label: string; icon: string; hint?: string; run: () => void }

/* Replie les accents et la casse. Sans cela, « equipe » ne trouvait pas
   « Équipe » et « reappro » ne trouvait pas « Réappro IA » : sur un clavier de
   téléphone, personne ne va chercher les accents. Même normalisation que pour
   les pictogrammes de produits (lib/productIcon). */
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export default function CommandPalette({ commands }: { commands: Command[] }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 40) }
  }, [open])

  const filtered = useMemo(() => {
    const s = fold(q.trim())
    return s ? commands.filter((c) => fold(c.label).includes(s)) : commands
  }, [q, commands])

  if (!open) return null

  const run = (c: Command | undefined) => { if (!c) return; setOpen(false); c.run() }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return setOpen(false)
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(filtered.length - 1, i + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)) }
    if (e.key === 'Enter') { e.preventDefault(); run(filtered[idx]) }
  }

  return (
    <div className="cmdk-overlay" onClick={() => setOpen(false)}>
      <div className="cmdk-box" role="dialog" aria-modal="true" aria-label="Palette de commandes" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="Rechercher une action, une section… (ex. « vendre », « chiffres »)"
          value={q}
          onChange={(e) => { setQ(e.target.value); setIdx(0) }}
          onKeyDown={onKeyDown}
        />
        <div className="cmdk-list">
          {filtered.length === 0
            ? <div className="cmdk-empty">Aucun résultat pour « {q} »</div>
            : filtered.map((c, i) => (
              <button key={c.id} className={`cmdk-item ${i === idx ? 'active' : ''}`} onMouseEnter={() => setIdx(i)} onClick={() => run(c)}>
                <span className="ci" aria-hidden="true">{c.icon}</span>
                <span style={{ flex: 1 }}>{c.label}</span>
                {c.hint && <span style={{ color: 'var(--muted2)', fontSize: 12 }}>{c.hint}</span>}
              </button>
            ))}
        </div>
        <div className="cmdk-hint">
          <span><span className="cmdk-kbd">↑↓</span> naviguer</span>
          <span><span className="cmdk-kbd">↵</span> ouvrir</span>
          <span><span className="cmdk-kbd">Esc</span> fermer</span>
        </div>
      </div>
    </div>
  )
}
