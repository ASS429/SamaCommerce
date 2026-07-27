/* Skeleton loaders (shimmer) — affichés pendant les chargements. */

export function SkeletonLine({ w = '100%', h = 12 }: { w?: string | number; h?: number }) {
  return <div className="skeleton" style={{ width: w, height: h }} />
}

/** Liste de cartes (Stock, Clients, Crédits…). */
export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div className="sk-card" key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <SkeletonLine w={120} h={14} />
            <SkeletonLine w={56} h={20} />
          </div>
          <SkeletonLine w="70%" h={12} />
          <div style={{ marginTop: 8 }}><SkeletonLine w={90} h={18} /></div>
        </div>
      ))}
    </div>
  )
}

/** Grille de produits (Vente, Catégories…). */
export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="vente-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div className="sk-card" key={i} style={{ marginBottom: 0 }}>
          <SkeletonLine w="80%" h={14} />
          <div style={{ marginTop: 8 }}><SkeletonLine w={70} h={18} /></div>
          <div style={{ marginTop: 6 }}><SkeletonLine w={50} h={11} /></div>
        </div>
      ))}
    </div>
  )
}
