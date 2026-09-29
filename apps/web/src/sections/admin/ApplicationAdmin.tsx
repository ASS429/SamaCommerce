import { useEffect, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { Admin, fcfa, type Utilisateur } from '../../outils/api'
import { demanderConfirmation } from '../../outils/bulles'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

// Les classes de mise en forme de l'administration sont celles de Tailwind
// (bibliothèque tierce) : elles gardent leur nom anglais.

type Rubrique = 'tableau' | 'abonnes' | 'revenus' | 'comptes' | 'parametres'

const LIENS: { id: Rubrique; emoji: string; libelle: string }[] = [
  { id: 'tableau', emoji: '📊', libelle: 'Tableau de bord' },
  { id: 'abonnes', emoji: '👥', libelle: 'Abonnés' },
  { id: 'revenus', emoji: '💰', libelle: 'Revenus' },
  { id: 'comptes', emoji: '🏦', libelle: 'Mes Comptes' },
  { id: 'parametres', emoji: '⚙️', libelle: 'Paramètres' },
]

export default function ApplicationAdmin({ utilisateur, surDeconnexion }: { utilisateur: Utilisateur | null; surDeconnexion: () => void }) {
  const [rubrique, definirRubrique] = useState<Rubrique>('tableau')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-40 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-white font-bold">B</div>
          <h1 className="text-lg font-semibold text-gray-800">BOUTIQUE GESTION — Admin</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-600 text-sm">{utilisateur?.identifiant}</span>
          <button onClick={surDeconnexion} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm">Déconnexion</button>
        </div>
      </header>

      <div className="flex">
        <aside className="w-56 bg-gradient-to-b from-gray-100 to-gray-200 min-h-screen p-4 hidden md:block">
          <nav className="space-y-2 mt-4">
            {LIENS.map((l) => (
              <button key={l.id} onClick={() => definirRubrique(l.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-left ${rubrique === l.id ? 'bg-white text-violet-600 shadow' : 'text-gray-700 hover:text-violet-600'}`}>
                <span className="text-lg">{l.emoji}</span> {l.libelle}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8">
          {/* Navigation mobile */}
          <div className="flex gap-2 overflow-x-auto mb-4 md:hidden">
            {LIENS.map((l) => (
              <button key={l.id} onClick={() => definirRubrique(l.id)}
                className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${rubrique === l.id ? 'bg-violet-600 text-white' : 'bg-white'}`}>{l.emoji} {l.libelle}</button>
            ))}
          </div>

          {rubrique === 'tableau' && <TableauDeBord />}
          {rubrique === 'abonnes' && <Abonnes />}
          {rubrique === 'revenus' && <Revenus />}
          {rubrique === 'comptes' && <Comptes />}
          {rubrique === 'parametres' && <Parametres />}
        </main>
      </div>
    </div>
  )
}

function TableauDeBord() {
  const [vue, definirVue] = useState<any>(null)
  const [evolution, definirEvolution] = useState<any[]>([])
  useEffect(() => { Admin.vueEnsemble().then(definirVue); Admin.evolution().then(definirEvolution) }, [])
  if (!vue) return <p className="text-gray-500">Chargement…</p>
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Indicateur titre="Total Utilisateurs" valeur={vue.total_utilisateurs} emoji="👥" fond="bg-blue-100" />
        <Indicateur titre="Abonnés Actifs" valeur={vue.premium_actifs} emoji="✅" fond="bg-green-100" />
        <Indicateur titre="Revenus Totaux" valeur={fcfa(vue.revenus)} emoji="💰" fond="bg-violet-100" />
        <Indicateur titre="En Attente" valeur={vue.en_attente} emoji="⚠️" fond="bg-red-100" rouge />
      </div>
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-6 py-4 border-b"><h2 className="text-lg font-semibold text-gray-800">Évolution des Revenus</h2></div>
        <div className="p-6">
          <Line data={{
            labels: evolution.map((e) => e.mois),
            datasets: [{ label: 'Revenus', data: evolution.map((e) => Number(e.total)), borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,.15)', tension: 0.3, fill: true }],
          }} options={{ plugins: { legend: { display: false } } }} />
          {evolution.length === 0 && <p className="text-center text-gray-400 text-sm mt-2">Aucune donnée de revenus pour le moment</p>}
        </div>
      </div>
    </div>
  )
}

function Abonnes() {
  const [utilisateurs, definirUtilisateurs] = useState<any[]>([])
  const [recherche, definirRecherche] = useState('')
  const charger = () => Admin.utilisateurs().then(definirUtilisateurs)
  useEffect(() => { charger() }, [])

  const agir = async (action: Promise<any>) => { await action; charger() }
  const filtres = utilisateurs.filter((u) => u.identifiant.toLowerCase().includes(recherche.toLowerCase()))

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Gestion des Abonnés</h1>
      <input value={recherche} onChange={(e) => definirRecherche(e.target.value)} placeholder="Rechercher un abonné..."
        className="w-full md:w-96 px-4 py-2 border rounded-lg mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtres.map((u) => (
          <div key={u.id} className="bg-white rounded-xl shadow-sm border p-5">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-gray-800">{u.nom_commerce || u.identifiant}</div>
                <div className="text-sm text-gray-500">{u.identifiant}</div>
                <div className="text-sm text-gray-500">{u.telephone || '—'}</div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${u.statut === 'Bloqué' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{u.statut}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-3 text-xs">
              <span className={`px-2 py-1 rounded-full ${u.plan === 'Premium' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'}`}>{u.plan}</span>
              <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600">{u.statut_demande_premium}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {u.statut_demande_premium === 'en attente' && (
                <>
                  <button onClick={() => agir(Admin.validerPassagePremium(u.id))} className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm">✅ Approuver</button>
                  <button onClick={() => agir(Admin.refuserPassagePremium(u.id))} className="bg-orange-500 text-white px-3 py-1 rounded-lg text-sm">✖ Rejeter</button>
                </>
              )}
              {u.statut === 'Bloqué'
                ? <button onClick={() => agir(Admin.activer(u.id))} className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-sm">Activer</button>
                : <button onClick={() => agir(Admin.bloquer(u.id))} className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-lg text-sm">Bloquer</button>}
              <button onClick={async () => await demanderConfirmation(`Supprimer ${u.identifiant} ?`) && agir(Admin.supprimerUtilisateur(u.id))} className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-sm">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Revenus() {
  const [periode, definirPeriode] = useState('mois')
  const [revenus, definirRevenus] = useState<any>(null)
  const [transactions, definirTransactions] = useState<any[]>([])
  const [montant, definirMontant] = useState('')
  const [moyen, definirMoyen] = useState('wave')

  const charger = () => { Admin.revenus(periode).then(definirRevenus); Admin.transactions(10).then(definirTransactions) }
  useEffect(charger, [periode])

  const retirer = async () => {
    if (!montant) return
    await Admin.retirer(Number(montant), moyen); definirMontant(''); alert('Retrait enregistré'); charger()
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Revenus</h1>
        <select value={periode} onChange={(e) => definirPeriode(e.target.value)} className="px-3 py-2 border rounded-lg bg-white text-sm">
          <option value="tout">Tous</option><option value="jour">Journalier</option>
          <option value="semaine">Hebdo</option><option value="mois">Mensuel</option>
        </select>
      </div>
      {revenus && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <CarteDegrade degrade="from-violet-500 to-violet-600" titre="Solde Principal" valeur={fcfa(revenus.solde)} emoji="💳" />
          <CarteDegrade degrade="from-green-500 to-violet-600" titre="Revenus période" valeur={fcfa(revenus.total_periode)} emoji="📈" />
          <CarteDegrade degrade="from-orange-500 to-red-500" titre="En Attente" valeur={fcfa(revenus.en_attente)} emoji="⏳" />
        </div>
      )}

      <div className="bg-white rounded-xl border p-5 mb-8">
        <h3 className="font-semibold mb-3">💸 Effectuer un retrait</h3>
        <div className="flex flex-wrap gap-2">
          <input type="number" value={montant} onChange={(e) => definirMontant(e.target.value)} placeholder="Montant" className="px-3 py-2 border rounded-lg" />
          <select value={moyen} onChange={(e) => definirMoyen(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="wave">Wave</option><option value="orange">Orange</option><option value="especes">Espèces</option>
          </select>
          <button onClick={retirer} className="bg-violet-600 text-white px-4 py-2 rounded-lg">Confirmer</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-6 py-4 border-b"><h2 className="text-lg font-semibold text-gray-800">Transactions Récentes</h2></div>
        <div className="divide-y">
          {transactions.length === 0 && <p className="p-6 text-gray-400 text-sm">Aucune transaction</p>}
          {transactions.map((t) => (
            <div key={t.id} className="px-6 py-3 flex justify-between text-sm">
              <span>{t.identifiant}</span>
              <span className="text-gray-500">{t.moyen_paiement || '—'}</span>
              <span className="font-bold">{fcfa(Number(t.montant))}</span>
              <span className={t.statut_demande_premium === 'validé' ? 'text-green-600' : 'text-orange-500'}>{t.statut_demande_premium}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Comptes() {
  const [comptes, definirComptes] = useState<any>(null)
  const [source, definirSource] = useState('especes')
  const [destination, definirDestination] = useState('wave')
  const [montant, definirMontant] = useState('')
  const charger = () => Admin.comptes().then(definirComptes)
  useEffect(() => { charger() }, [])

  const transferer = async () => {
    if (!montant || source === destination) return alert('Vérifiez les comptes/montant')
    await Admin.transferer(source, destination, Number(montant)); definirMontant(''); charger()
  }
  if (!comptes) return <p className="text-gray-500">Chargement…</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Mes Comptes</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <CarteDegrade degrade="from-orange-500 to-orange-600" titre="Orange Money" valeur={fcfa(comptes.comptes.orange)} emoji="🟠" />
        <CarteDegrade degrade="from-blue-500 to-blue-600" titre="Wave" valeur={fcfa(comptes.comptes.wave)} emoji="🌊" />
        <CarteDegrade degrade="from-green-500 to-green-600" titre="Espèces" valeur={fcfa(comptes.comptes.especes)} emoji="💵" />
      </div>

      <div className="bg-white rounded-xl border p-6 mb-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div><div className="text-2xl font-bold text-gray-800">{fcfa(comptes.total)}</div><div className="text-sm text-gray-500">Total Disponible</div></div>
        <div><div className="text-2xl font-bold text-green-600">{fcfa(comptes.entrees)}</div><div className="text-sm text-gray-500">Entrées Aujourd'hui</div></div>
        <div><div className="text-2xl font-bold text-red-600">{fcfa(comptes.retraits)}</div><div className="text-sm text-gray-500">Sorties Aujourd'hui</div></div>
        <div><div className="text-2xl font-bold text-violet-600">{fcfa(comptes.net)}</div><div className="text-sm text-gray-500">Bénéfice Net</div></div>
      </div>

      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold mb-3">🔄 Transfert entre comptes</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={source} onChange={(e) => definirSource(e.target.value)} className="px-3 py-2 border rounded-lg"><option value="especes">Espèces</option><option value="wave">Wave</option><option value="orange">Orange</option></select>
          <span>→</span>
          <select value={destination} onChange={(e) => definirDestination(e.target.value)} className="px-3 py-2 border rounded-lg"><option value="wave">Wave</option><option value="orange">Orange</option><option value="especes">Espèces</option></select>
          <input type="number" value={montant} onChange={(e) => definirMontant(e.target.value)} placeholder="Montant" className="px-3 py-2 border rounded-lg" />
          <button onClick={transferer} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Transférer</button>
        </div>
      </div>
    </div>
  )
}

function Parametres() {
  const [parametres, definirParametres] = useState<any>(null)
  useEffect(() => { Admin.parametres().then(definirParametres) }, [])
  const basculerDouble = async () => { const r = await Admin.basculerDoubleFacteur(); definirParametres((p: any) => ({ ...p, double_facteur_actif: r.actif })) }
  if (!parametres) return <p className="text-gray-500">Chargement…</p>
  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Paramètres</h1>
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold">Sécurité</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Authentification 2FA</span>
          <button onClick={basculerDouble} className={`px-4 py-2 rounded-lg text-white ${parametres.double_facteur_actif ? 'bg-green-600' : 'bg-gray-400'}`}>
            {parametres.double_facteur_actif ? 'Activée' : 'Désactivée'}
          </button>
        </div>
        <p className="text-xs text-gray-500">Quand la 2FA est active, un code est requis à la connexion admin.</p>
      </div>
    </div>
  )
}

function Indicateur({ titre, valeur, emoji, fond, rouge }: { titre: string; valeur: any; emoji: string; fond: string; rouge?: boolean }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{titre}</p>
          <p className={`text-2xl font-bold mt-1 ${rouge ? 'text-red-600' : 'text-gray-800'}`}>{valeur}</p>
        </div>
        <div className={`w-12 h-12 ${fond} rounded-lg flex items-center justify-center text-xl`}>{emoji}</div>
      </div>
    </div>
  )
}

function CarteDegrade({ degrade, titre, valeur, emoji }: { degrade: string; titre: string; valeur: string; emoji: string }) {
  return (
    <div className={`bg-gradient-to-r ${degrade} rounded-xl p-6 text-white`}>
      <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">{titre}</h3><span className="text-2xl">{emoji}</span></div>
      <p className="text-3xl font-bold">{valeur}</p>
    </div>
  )
}
