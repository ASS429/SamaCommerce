import { useEffect, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { Admin, fcfa, type User } from '../../lib/api'
import { confirmAsync } from '../../lib/toast'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

type Sec = 'dashboard' | 'subscribers' | 'revenue' | 'accounts' | 'settings'

const LINKS: { id: Sec; emoji: string; label: string }[] = [
  { id: 'dashboard', emoji: '📊', label: 'Tableau de bord' },
  { id: 'subscribers', emoji: '👥', label: 'Abonnés' },
  { id: 'revenue', emoji: '💰', label: 'Revenus' },
  { id: 'accounts', emoji: '🏦', label: 'Mes Comptes' },
  { id: 'settings', emoji: '⚙️', label: 'Paramètres' },
]

export default function AdminApp({ user, onLogout }: { user: User | null; onLogout: () => void }) {
  const [sec, setSec] = useState<Sec>('dashboard')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-40 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-white font-bold">B</div>
          <h1 className="text-lg font-semibold text-gray-800">BOUTIQUE GESTION — Admin</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-600 text-sm">{user?.username}</span>
          <button onClick={onLogout} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm">Déconnexion</button>
        </div>
      </header>

      <div className="flex">
        <aside className="w-56 bg-gradient-to-b from-gray-100 to-gray-200 min-h-screen p-4 hidden md:block">
          <nav className="space-y-2 mt-4">
            {LINKS.map((l) => (
              <button key={l.id} onClick={() => setSec(l.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-left ${sec === l.id ? 'bg-white text-violet-600 shadow' : 'text-gray-700 hover:text-violet-600'}`}>
                <span className="text-lg">{l.emoji}</span> {l.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8">
          {/* Nav mobile */}
          <div className="flex gap-2 overflow-x-auto mb-4 md:hidden">
            {LINKS.map((l) => (
              <button key={l.id} onClick={() => setSec(l.id)}
                className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${sec === l.id ? 'bg-violet-600 text-white' : 'bg-white'}`}>{l.emoji} {l.label}</button>
            ))}
          </div>

          {sec === 'dashboard' && <Dashboard />}
          {sec === 'subscribers' && <Subscribers />}
          {sec === 'revenue' && <Revenue />}
          {sec === 'accounts' && <Accounts />}
          {sec === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  )
}

function Dashboard() {
  const [ov, setOv] = useState<any>(null)
  const [evo, setEvo] = useState<any[]>([])
  useEffect(() => { Admin.overview().then(setOv); Admin.evolution().then(setEvo) }, [])
  if (!ov) return <p className="text-gray-500">Chargement…</p>
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Stat title="Total Utilisateurs" value={ov.totalUsers} emoji="👥" bg="bg-blue-100" />
        <Stat title="Abonnés Actifs" value={ov.activePremium} emoji="✅" bg="bg-green-100" />
        <Stat title="Revenus Totaux" value={fcfa(ov.revenues)} emoji="💰" bg="bg-violet-100" />
        <Stat title="En Attente" value={ov.pending} emoji="⚠️" bg="bg-red-100" red />
      </div>
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-6 py-4 border-b"><h2 className="text-lg font-semibold text-gray-800">Évolution des Revenus</h2></div>
        <div className="p-6">
          <Line data={{
            labels: evo.map((e) => e.mois),
            datasets: [{ label: 'Revenus', data: evo.map((e) => Number(e.total)), borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,.15)', tension: 0.3, fill: true }],
          }} options={{ plugins: { legend: { display: false } } }} />
          {evo.length === 0 && <p className="text-center text-gray-400 text-sm mt-2">Aucune donnée de revenus pour le moment</p>}
        </div>
      </div>
    </div>
  )
}

function Subscribers() {
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const load = () => Admin.users().then(setUsers)
  useEffect(() => { load() }, [])

  const act = async (fn: Promise<any>) => { await fn; load() }
  const filtered = users.filter((u) => u.username.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Gestion des Abonnés</h1>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un abonné..."
        className="w-full md:w-96 px-4 py-2 border rounded-lg mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((u) => (
          <div key={u.id} className="bg-white rounded-xl shadow-sm border p-5">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-gray-800">{u.company_name || u.username}</div>
                <div className="text-sm text-gray-500">{u.username}</div>
                <div className="text-sm text-gray-500">{u.phone || '—'}</div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${u.status === 'Bloqué' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{u.status}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-3 text-xs">
              <span className={`px-2 py-1 rounded-full ${u.plan === 'Premium' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'}`}>{u.plan}</span>
              <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600">{u.upgrade_status}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {u.upgrade_status === 'en attente' && (
                <>
                  <button onClick={() => act(Admin.approve(u.id))} className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm">✅ Approuver</button>
                  <button onClick={() => act(Admin.reject(u.id))} className="bg-orange-500 text-white px-3 py-1 rounded-lg text-sm">✖ Rejeter</button>
                </>
              )}
              {u.status === 'Bloqué'
                ? <button onClick={() => act(Admin.activate(u.id))} className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-sm">Activer</button>
                : <button onClick={() => act(Admin.block(u.id))} className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-lg text-sm">Bloquer</button>}
              <button onClick={async () => await confirmAsync(`Supprimer ${u.username} ?`) && act(Admin.deleteUser(u.id))} className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-sm">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Revenue() {
  const [period, setPeriod] = useState('monthly')
  const [rev, setRev] = useState<any>(null)
  const [tx, setTx] = useState<any[]>([])
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('wave')

  const load = () => { Admin.revenus(period).then(setRev); Admin.transactions(10).then(setTx) }
  useEffect(load, [period])

  const withdraw = async () => {
    if (!amount) return
    await Admin.withdraw(Number(amount), method); setAmount(''); alert('Retrait enregistré'); load()
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Revenus</h1>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="px-3 py-2 border rounded-lg bg-white text-sm">
          <option value="all">Tous</option><option value="daily">Journalier</option>
          <option value="weekly">Hebdo</option><option value="monthly">Mensuel</option>
        </select>
      </div>
      {rev && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card grad="from-violet-500 to-violet-600" title="Solde Principal" value={fcfa(rev.balance)} emoji="💳" />
          <Card grad="from-green-500 to-violet-600" title="Revenus période" value={fcfa(rev.periodTotal)} emoji="📈" />
          <Card grad="from-orange-500 to-red-500" title="En Attente" value={fcfa(rev.pending)} emoji="⏳" />
        </div>
      )}

      <div className="bg-white rounded-xl border p-5 mb-8">
        <h3 className="font-semibold mb-3">💸 Effectuer un retrait</h3>
        <div className="flex flex-wrap gap-2">
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Montant" className="px-3 py-2 border rounded-lg" />
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="wave">Wave</option><option value="orange">Orange</option><option value="cash">Espèces</option>
          </select>
          <button onClick={withdraw} className="bg-violet-600 text-white px-4 py-2 rounded-lg">Confirmer</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-6 py-4 border-b"><h2 className="text-lg font-semibold text-gray-800">Transactions Récentes</h2></div>
        <div className="divide-y">
          {tx.length === 0 && <p className="p-6 text-gray-400 text-sm">Aucune transaction</p>}
          {tx.map((t) => (
            <div key={t.id} className="px-6 py-3 flex justify-between text-sm">
              <span>{t.username}</span>
              <span className="text-gray-500">{t.payment_method || '—'}</span>
              <span className="font-bold">{fcfa(Number(t.amount))}</span>
              <span className={t.upgrade_status === 'validé' ? 'text-green-600' : 'text-orange-500'}>{t.upgrade_status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Accounts() {
  const [acc, setAcc] = useState<any>(null)
  const [from, setFrom] = useState('cash')
  const [to, setTo] = useState('wave')
  const [amount, setAmount] = useState('')
  const load = () => Admin.accounts().then(setAcc)
  useEffect(() => { load() }, [])

  const transfer = async () => {
    if (!amount || from === to) return alert('Vérifiez les comptes/montant')
    await Admin.transfer(from, to, Number(amount)); setAmount(''); load()
  }
  if (!acc) return <p className="text-gray-500">Chargement…</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Mes Comptes</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card grad="from-orange-500 to-orange-600" title="Orange Money" value={fcfa(acc.accounts.orange)} emoji="🟠" />
        <Card grad="from-blue-500 to-blue-600" title="Wave" value={fcfa(acc.accounts.wave)} emoji="🌊" />
        <Card grad="from-green-500 to-green-600" title="Espèces" value={fcfa(acc.accounts.cash)} emoji="💵" />
      </div>

      <div className="bg-white rounded-xl border p-6 mb-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div><div className="text-2xl font-bold text-gray-800">{fcfa(acc.total)}</div><div className="text-sm text-gray-500">Total Disponible</div></div>
        <div><div className="text-2xl font-bold text-green-600">{fcfa(acc.entries)}</div><div className="text-sm text-gray-500">Entrées Aujourd'hui</div></div>
        <div><div className="text-2xl font-bold text-red-600">{fcfa(acc.withdrawals)}</div><div className="text-sm text-gray-500">Sorties Aujourd'hui</div></div>
        <div><div className="text-2xl font-bold text-violet-600">{fcfa(acc.net)}</div><div className="text-sm text-gray-500">Bénéfice Net</div></div>
      </div>

      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold mb-3">🔄 Transfert entre comptes</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border rounded-lg"><option value="cash">Espèces</option><option value="wave">Wave</option><option value="orange">Orange</option></select>
          <span>→</span>
          <select value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border rounded-lg"><option value="wave">Wave</option><option value="orange">Orange</option><option value="cash">Espèces</option></select>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Montant" className="px-3 py-2 border rounded-lg" />
          <button onClick={transfer} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Transférer</button>
        </div>
      </div>
    </div>
  )
}

function Settings() {
  const [s, setS] = useState<any>(null)
  useEffect(() => { Admin.settings().then(setS) }, [])
  const toggle2fa = async () => { const r = await Admin.toggle2fa(); setS((p: any) => ({ ...p, twofa_enabled: r.enabled })) }
  if (!s) return <p className="text-gray-500">Chargement…</p>
  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Paramètres</h1>
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold">Sécurité</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Authentification 2FA</span>
          <button onClick={toggle2fa} className={`px-4 py-2 rounded-lg text-white ${s.twofa_enabled ? 'bg-green-600' : 'bg-gray-400'}`}>
            {s.twofa_enabled ? 'Activée' : 'Désactivée'}
          </button>
        </div>
        <p className="text-xs text-gray-500">Quand la 2FA est active, un code est requis à la connexion admin.</p>
      </div>
    </div>
  )
}

function Stat({ title, value, emoji, bg, red }: { title: string; value: any; emoji: string; bg: string; red?: boolean }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${red ? 'text-red-600' : 'text-gray-800'}`}>{value}</p>
        </div>
        <div className={`w-12 h-12 ${bg} rounded-lg flex items-center justify-center text-xl`}>{emoji}</div>
      </div>
    </div>
  )
}

function Card({ grad, title, value, emoji }: { grad: string; title: string; value: string; emoji: string }) {
  return (
    <div className={`bg-gradient-to-r ${grad} rounded-xl p-6 text-white`}>
      <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">{title}</h3><span className="text-2xl">{emoji}</span></div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  )
}
