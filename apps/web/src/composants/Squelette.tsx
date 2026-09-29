/* Squelettes de chargement (miroitement) — affichés pendant les chargements. */

export function LigneSquelette({ l = '100%', h = 12 }: { l?: string | number; h?: number }) {
  return <div className="squelette" style={{ width: l, height: h }} />
}

/** Liste de cartes (Stock, Clients, Crédits…). */
export function ListeSquelette({ nombre = 4 }: { nombre?: number }) {
  return (
    <div>
      {Array.from({ length: nombre }).map((_, i) => (
        <div className="squelette-carte" key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <LigneSquelette l={120} h={14} />
            <LigneSquelette l={56} h={20} />
          </div>
          <LigneSquelette l="70%" h={12} />
          <div style={{ marginTop: 8 }}><LigneSquelette l={90} h={18} /></div>
        </div>
      ))}
    </div>
  )
}

/** Grille de produits (Vente, Catégories…). */
export function GrilleSquelette({ nombre = 6 }: { nombre?: number }) {
  return (
    <div className="vente-grille">
      {Array.from({ length: nombre }).map((_, i) => (
        <div className="squelette-carte" key={i} style={{ marginBottom: 0 }}>
          <LigneSquelette l="80%" h={14} />
          <div style={{ marginTop: 8 }}><LigneSquelette l={70} h={18} /></div>
          <div style={{ marginTop: 6 }}><LigneSquelette l={50} h={11} /></div>
        </div>
      ))}
    </div>
  )
}
